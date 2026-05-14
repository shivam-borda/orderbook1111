/**
 * server.js — Garment Order Form backend
 *
 * Endpoints:
 *   GET    /api/orders          → return all orders
 *   GET    /api/orders/:id      → return one order by id
 *   POST   /api/orders          → save a new order
 *   PUT    /api/orders/:id      → update an existing order
 *   DELETE /api/orders/:id      → delete an order
 *
 * Data is stored in data/orders.json (plain file, no database needed).
 * Frontend files are served from the public/ folder.
 *
 * Usage:
 *   npm install        (first time only)
 *   node server.js     (then open http://localhost:3000)
 */

const http    = require('http');
const fs      = require('fs');
const path    = require('path');
const url     = require('url');
const { createClient } = require('@supabase/supabase-js');

const PORT       = 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');

// Load environment variables from .env file manually
function loadEnv() {
  const envPath = path.join(__dirname, '.env');
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf8');
    content.split('\n').forEach(line => {
      const parts = line.split('=');
      if (parts.length === 2) {
        process.env[parts[0].trim()] = parts[1].trim();
      }
    });
  }
}
loadEnv();

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

/* ─────────────────────────────────────────
   FILE HELPERS
───────────────────────────────────────── */
function readOrders() {
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    return [];
  }
}

function writeOrders(orders) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(orders, null, 2), 'utf8');
}

/* ─────────────────────────────────────────
   STATIC FILE SERVER
───────────────────────────────────────── */
const MIME = {
  '.html': 'text/html',
  '.css':  'text/css',
  '.js':   'application/javascript',
  '.json': 'application/json',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.ico':  'image/x-icon',
};

function serveStatic(req, res) {
  const parsed = url.parse(req.url, true);
  const pathname = parsed.pathname;
  let filePath = path.join(PUBLIC_DIR, pathname === '/' ? 'index.html' : pathname);
  const ext  = path.extname(filePath);
  const mime = MIME[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': mime });
    res.end(data);
  });
}

/* ─────────────────────────────────────────
   JSON RESPONSE HELPERS
───────────────────────────────────────── */
function jsonOk(res, data) {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

function jsonError(res, status, msg) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: msg }));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end',  ()    => {
      try { resolve(JSON.parse(body)); }
      catch (e) { reject(e); }
    });
    req.on('error', reject);
  });
}

/* ─────────────────────────────────────────
   ROUTER
───────────────────────────────────────── */
const server = http.createServer(async (req, res) => {
  // CORS headers (allows the browser to call the API)
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  const parsed  = url.parse(req.url, true);
  const pathname = parsed.pathname;

  // ── API routes ──────────────────────────
  if (pathname.startsWith('/api/orders')) {
    const parts = pathname.split('/').filter(Boolean); // ['api','orders','<id>']
    const id    = parts[2] || null;

    try {
      // GET /api/orders
      if (req.method === 'GET' && !id) {
        const q = (parsed.query.q || '').toLowerCase();
        
        let query = supabase
          .from('orders')
          .select('*, fabric_rows(*), emb_rows(*), stitch_rows(*)')
          .order('saved_at', { ascending: false });

        if (q) {
          query = query.ilike('d_no', `%${q}%`);
        }

        const { data, error } = await query;

        if (error) return jsonError(res, 500, error.message);

        // Map to camelCase for frontend
        const mapped = data.map(o => ({
          id: o.id,
          orderNo: o.order_no,
          savedAt: o.saved_at,
          dNo: o.d_no,
          fabric: o.fabric,
          date: o.date,
          image: o.image,
          fabricRows: o.fabric_rows.map(r => ({
            partyName: r.party_name,
            fabricName: r.fabric_name,
            colour: r.colour,
            totalFab: r.total_fab,
            workFab: r.work_fab,
            plainFab: r.plain_fab,
            receivedFab: r.received_fab,
            workPcs: r.work_pcs
          })),
          embRows: o.emb_rows.map(r => ({
            partyName: r.party_name,
            date: r.date,
            sentFront: r.sent_front,
            sentBack: r.sent_back,
            sentSleeve: r.sent_sleeve,
            returnFront: r.return_front,
            returnBack: r.return_back,
            returnSleeve: r.return_sleeve
          })),
          stitchRows: o.stitch_rows.map(r => ({
            partyName: r.party_name,
            sentDate: r.sent_date,
            expectedPcs: r.expected_pcs,
            receivedPcs: r.received_pcs
          }))
        }));

        return jsonOk(res, mapped);
      }

      // GET /api/orders/:id
      if (req.method === 'GET' && id) {
        const { data, error } = await supabase
          .from('orders')
          .select('*, fabric_rows(*), emb_rows(*), stitch_rows(*)')
          .eq('id', id)
          .single();

        if (error) return jsonError(res, 404, 'Not found');

        const mapped = {
          id: data.id,
          orderNo: data.order_no,
          savedAt: data.saved_at,
          dNo: data.d_no,
          fabric: data.fabric,
          date: data.date,
          image: data.image,
          fabricRows: data.fabric_rows.map(r => ({
            partyName: r.party_name,
            fabricName: r.fabric_name,
            colour: r.colour,
            totalFab: r.total_fab,
            workFab: r.work_fab,
            plainFab: r.plain_fab,
            receivedFab: r.received_fab,
            workPcs: r.work_pcs
          })),
          embRows: data.emb_rows.map(r => ({
            partyName: r.party_name,
            date: r.date,
            sentFront: r.sent_front,
            sentBack: r.sent_back,
            sentSleeve: r.sent_sleeve,
            returnFront: r.return_front,
            returnBack: r.return_back,
            returnSleeve: r.return_sleeve
          })),
          stitchRows: data.stitch_rows.map(r => ({
            partyName: r.party_name,
            sentDate: r.sent_date,
            expectedPcs: r.expected_pcs,
            receivedPcs: r.received_pcs
          }))
        };

        return jsonOk(res, mapped);
      }

      // POST /api/orders
      if (req.method === 'POST') {
        const body = await readBody(req);
        
        // 1. Insert order
        const { data: orderData, error: orderError } = await supabase
          .from('orders')
          .insert([{
            d_no: body.dNo,
            fabric: body.fabric,
            date: body.date,
            image: body.image
          }])
          .select()
          .single();

        if (orderError) return jsonError(res, 500, orderError.message);

        const orderId = orderData.id;

        // 2. Insert child rows
        if (body.fabricRows && body.fabricRows.length > 0) {
          const mappedRows = body.fabricRows.map(r => ({
            order_id: orderId,
            party_name: r.partyName,
            fabric_name: r.fabricName,
            colour: r.colour,
            total_fab: r.totalFab,
            work_fab: r.workFab,
            plain_fab: r.plainFab,
            received_fab: r.receivedFab,
            work_pcs: r.workPcs
          }));
          const { error } = await supabase.from('fabric_rows').insert(mappedRows);
          if (error) return jsonError(res, 500, error.message);
        }

        if (body.embRows && body.embRows.length > 0) {
          const mappedRows = body.embRows.map(r => ({
            order_id: orderId,
            party_name: r.partyName,
            date: r.date,
            sent_front: r.sentFront,
            sent_back: r.sentBack,
            sent_sleeve: r.sentSleeve,
            return_front: r.returnFront,
            return_back: r.returnBack,
            return_sleeve: r.returnSleeve
          }));
          const { error } = await supabase.from('emb_rows').insert(mappedRows);
          if (error) return jsonError(res, 500, error.message);
        }

        if (body.stitchRows && body.stitchRows.length > 0) {
          const mappedRows = body.stitchRows.map(r => ({
            order_id: orderId,
            party_name: r.partyName,
            sent_date: r.sentDate,
            expected_pcs: r.expectedPcs,
            received_pcs: r.receivedPcs
          }));
          const { error } = await supabase.from('stitch_rows').insert(mappedRows);
          if (error) return jsonError(res, 500, error.message);
        }

        res.writeHead(201, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ 
          ...body, 
          id: orderId, 
          orderNo: orderData.order_no, 
          savedAt: orderData.saved_at 
        }));
      }

      // PUT /api/orders/:id
      if (req.method === 'PUT' && id) {
        const body = await readBody(req);

        // 1. Update order
        const { error: orderError } = await supabase
          .from('orders')
          .update({
            d_no: body.dNo,
            fabric: body.fabric,
            date: body.date,
            image: body.image
          })
          .eq('id', id);

        if (orderError) return jsonError(res, 500, orderError.message);

        // 2. Update child rows (delete and re-insert)
        await supabase.from('fabric_rows').delete().eq('order_id', id);
        await supabase.from('emb_rows').delete().eq('order_id', id);
        await supabase.from('stitch_rows').delete().eq('order_id', id);

        // Re-insert
        if (body.fabricRows && body.fabricRows.length > 0) {
          const mappedRows = body.fabricRows.map(r => ({
            order_id: id,
            party_name: r.partyName,
            fabric_name: r.fabricName,
            colour: r.colour,
            total_fab: r.totalFab,
            work_fab: r.workFab,
            plain_fab: r.plainFab,
            received_fab: r.receivedFab,
            work_pcs: r.workPcs
          }));
          await supabase.from('fabric_rows').insert(mappedRows);
        }

        if (body.embRows && body.embRows.length > 0) {
          const mappedRows = body.embRows.map(r => ({
            order_id: id,
            party_name: r.partyName,
            date: r.date,
            sent_front: r.sentFront,
            sent_back: r.sentBack,
            sent_sleeve: r.sentSleeve,
            return_front: r.returnFront,
            return_back: r.returnBack,
            return_sleeve: r.returnSleeve
          }));
          await supabase.from('emb_rows').insert(mappedRows);
        }

        if (body.stitchRows && body.stitchRows.length > 0) {
          const mappedRows = body.stitchRows.map(r => ({
            order_id: id,
            party_name: r.partyName,
            sent_date: r.sentDate,
            expected_pcs: r.expectedPcs,
            received_pcs: r.receivedPcs
          }));
          await supabase.from('stitch_rows').insert(mappedRows);
        }

        return jsonOk(res, { ...body, id });
      }

      // DELETE /api/orders/:id
      if (req.method === 'DELETE' && id) {
        const { error } = await supabase
          .from('orders')
          .delete()
          .eq('id', id);

        if (error) return jsonError(res, 500, error.message);

        return jsonOk(res, { deleted: id });
      }

      jsonError(res, 405, 'Method not allowed');

    } catch (err) {
      console.error(err);
      jsonError(res, 500, 'Server error');
    }

    return;
  }

  // ── Static files ────────────────────────
  serveStatic(req, res);
});

server.listen(PORT, () => {
  console.log('');
  console.log('  Garment Order Form is running!');
  console.log('  Open in browser: http://localhost:' + PORT);
  console.log('  On your local network, others can use: http://<your-ip>:' + PORT);
  console.log('  Press Ctrl+C to stop.');
  console.log('');
});
