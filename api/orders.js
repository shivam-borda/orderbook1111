const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

module.exports = async (req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  // Check if Supabase is configured
  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'Supabase not configured. Set SUPABASE_URL and SUPABASE_ANON_KEY environment variables.' });
  }

  try {
    // Parse path: /api/orders or /api/orders/:id
    const urlPath = req.url.split('?')[0];
    const pathAfterOrders = urlPath.replace(/^\/api\/orders\/?/, '');
    const id = pathAfterOrders || null;

    // GET /api/orders — list all
    if (req.method === 'GET' && !id) {
      const q = (req.query && req.query.q) || '';

      let query;
      let hasHandwork = true;
      try {
        query = supabase
          .from('orders')
          .select('*, fabric_rows(*), emb_rows(*), stitch_rows(*), handwork_rows(*)')
          .order('saved_at', { ascending: false });
        if (q) query = query.ilike('d_no', `%${q}%`);
        var { data, error } = await query;
        if (error) throw error;
      } catch (e) {
        hasHandwork = false;
        query = supabase
          .from('orders')
          .select('*, fabric_rows(*), emb_rows(*), stitch_rows(*)')
          .order('saved_at', { ascending: false });
        if (q) query = query.ilike('d_no', `%${q}%`);
        var { data, error } = await query;
        if (error) throw error;
      }

      const mapped = data.map(o => ({
        id: o.id,
        orderNo: o.order_no,
        savedAt: o.saved_at,
        dNo: o.d_no,
        fabric: o.fabric,
        date: o.date,
        image: o.image,
        type: o.type || 'pipeline',
        status: o.status || 'open',
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
        handworkRows: hasHandwork && o.handwork_rows ? o.handwork_rows.map(r => ({
          partyName: r.party_name,
          sentDate: r.sent_date,
          colour: r.colour,
          expectedPcs: r.expected_pcs,
          receivedPcs: r.received_pcs
        })) : [],
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

      return res.status(200).json(mapped);
    }

    // GET /api/orders/:id — get one
    if (req.method === 'GET' && id) {
      let data, error, hasHandwork = true;
      try {
        const res = await supabase
          .from('orders')
          .select('*, fabric_rows(*), emb_rows(*), stitch_rows(*), handwork_rows(*)')
          .eq('id', id)
          .single();
        data = res.data;
        error = res.error;
        if (error) throw error;
      } catch (e) {
        hasHandwork = false;
        const res = await supabase
          .from('orders')
          .select('*, fabric_rows(*), emb_rows(*), stitch_rows(*)')
          .eq('id', id)
          .single();
        data = res.data;
        error = res.error;
      }

      if (error) return res.status(404).json({ error: 'Not found' });

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
        handworkRows: hasHandwork && data.handwork_rows ? data.handwork_rows.map(r => ({
          partyName: r.party_name,
          sentDate: r.sent_date,
          colour: r.colour,
          expectedPcs: r.expected_pcs,
          receivedPcs: r.received_pcs
        })) : [],
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

      return res.status(200).json(mapped);
    }

    // POST /api/orders — create new order
    if (req.method === 'POST') {
      const body = req.body;

      const insertObj = {
        d_no: body.dNo,
        fabric: body.fabric,
        date: body.date,
        image: body.image,
        type: body.type || 'pipeline',
        status: body.status || 'open'
      };
      if (body.orderNo) {
        insertObj.order_no = body.orderNo;
      }

      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .insert([insertObj])
        .select()
        .single();

      if (orderError) throw orderError;

      const orderId = orderData.id;

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

      if (body.handworkRows && body.handworkRows.length > 0) {
        try {
          const mappedRows = body.handworkRows.map(r => ({
            order_id: orderId,
            party_name: r.partyName,
            sent_date: r.sentDate,
            colour: r.colour,
            expected_pcs: r.expectedPcs,
            received_pcs: r.receivedPcs
          }));
          await supabase.from('handwork_rows').insert(mappedRows);
        } catch (e) {
          console.warn("handworkRows post failed on lambda:", e);
        }
      }

      return res.status(201).json({
        ...body,
        id: orderId,
        orderNo: orderData.order_no,
        savedAt: orderData.saved_at
      });
    }

    // PUT /api/orders/:id — update order
    if (req.method === 'PUT' && id) {
      const body = req.body;

      const updateObj = {
        d_no: body.dNo,
        fabric: body.fabric,
        date: body.date,
        image: body.image,
        type: body.type || 'pipeline'
      };
      if (body.status !== undefined) {
        updateObj.status = body.status;
      }
      if (body.orderNo) {
        updateObj.order_no = body.orderNo;
      }

      const { error: orderError } = await supabase
        .from('orders')
        .update(updateObj)
        .eq('id', id);

      if (orderError) throw orderError;

      // Delete and re-insert child rows
      await supabase.from('fabric_rows').delete().eq('order_id', id);
      await supabase.from('emb_rows').delete().eq('order_id', id);
      await supabase.from('stitch_rows').delete().eq('order_id', id);
      try {
        await supabase.from('handwork_rows').delete().eq('order_id', id);
      } catch (e) {}

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

      if (body.handworkRows && body.handworkRows.length > 0) {
        try {
          const mappedRows = body.handworkRows.map(r => ({
            order_id: id,
            party_name: r.partyName,
            sent_date: r.sentDate,
            colour: r.colour,
            expected_pcs: r.expectedPcs,
            received_pcs: r.receivedPcs
          }));
          await supabase.from('handwork_rows').insert(mappedRows);
        } catch (e) {
          console.warn("handworkRows put failed on lambda:", e);
        }
      }

      return res.status(200).json({ ...body, id });
    }

    // DELETE /api/orders/:id — delete order
    if (req.method === 'DELETE' && id) {
      const { error } = await supabase
        .from('orders')
        .delete()
        .eq('id', id);

      if (error) throw error;

      return res.status(200).json({ deleted: id });
    }

    return res.status(405).json({ error: 'Method not allowed' });

  } catch (err) {
    console.error('API Error:', err);
    return res.status(500).json({ error: 'Server error: ' + err.message });
  }
};
