const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

function jsonResponse(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
    body: JSON.stringify(body),
  };
}

exports.handler = async (event) => {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
      body: '',
    };
  }

  try {
    const pathParts = event.path.replace('/.netlify/functions/api/', '').replace('/api/', '').split('/').filter(Boolean);
    const resource = pathParts[0]; // 'orders'
    const id = pathParts[1] || null;

    if (resource !== 'orders') {
      return jsonResponse(404, { error: 'Not found' });
    }

    // GET /api/orders — list all (with optional search)
    if (event.httpMethod === 'GET' && !id) {
      const q = (event.queryStringParameters && event.queryStringParameters.q) || '';
      
      let query = supabase
        .from('orders')
        .select('*, fabric_rows(*), emb_rows(*), stitch_rows(*)')
        .order('saved_at', { ascending: false });

      if (q) {
        query = query.ilike('d_no', `%${q}%`);
      }

      const { data, error } = await query;

      if (error) throw error;

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

      return jsonResponse(200, mapped);
    }

    // GET /api/orders/:id — get one
    if (event.httpMethod === 'GET' && id) {
      const { data, error } = await supabase
        .from('orders')
        .select('*, fabric_rows(*), emb_rows(*), stitch_rows(*)')
        .eq('id', id)
        .single();

      if (error) return jsonResponse(404, { error: 'Not found' });

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

      return jsonResponse(200, mapped);
    }

    // POST /api/orders — create new order
    if (event.httpMethod === 'POST') {
      const body = JSON.parse(event.body);
      
      // 1. Insert order (let DB handle order_no and saved_at)
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

      if (orderError) throw orderError;

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
        if (error) throw error;
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
        if (error) throw error;
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
        if (error) throw error;
      }

      return jsonResponse(201, { 
        ...body, 
        id: orderId, 
        orderNo: orderData.order_no, 
        savedAt: orderData.saved_at 
      });
    }

    // PUT /api/orders/:id — update order
    if (event.httpMethod === 'PUT' && id) {
      const body = JSON.parse(event.body);

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

      if (orderError) throw orderError;

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

      return jsonResponse(200, { ...body, id });
    }

    // DELETE /api/orders/:id — delete order
    if (event.httpMethod === 'DELETE' && id) {
      // Due to CASCADE delete, we only need to delete from orders table
      const { error } = await supabase
        .from('orders')
        .delete()
        .eq('id', id);

      if (error) throw error;

      return jsonResponse(200, { deleted: id });
    }

    return jsonResponse(405, { error: 'Method not allowed' });

  } catch (err) {
    console.error('API Error:', err);
    return jsonResponse(500, { error: 'Server error: ' + err.message });
  }
};
