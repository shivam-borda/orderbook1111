/**
 * storage.js
 * Handles: Supabase direct CRUD, submit, edit, cancel, delete
 * Uses Supabase JS client directly from the browser (no backend API needed)
 */

// ─── SUPABASE CONFIG ───
var SUPABASE_URL = 'https://uwpqzrmwgjgqidngrujn.supabase.co';
var SUPABASE_ANON_KEY = 'sb_publishable_40gypcG5IwRv1D4SS36SQQ_GzeXmJf2';
// ────────────────────────

var currentEditId = null;

/* ─────────────────────────────────────────
   SUPABASE CLIENT (using REST API directly)
───────────────────────────────────────── */
function sbFetch(path, options) {
  var url = SUPABASE_URL + '/rest/v1/' + path;
  var headers = {
    'apikey': SUPABASE_ANON_KEY,
    'Authorization': 'Bearer ' + SUPABASE_ANON_KEY,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
  };
  if (options && options.headers) {
    Object.keys(options.headers).forEach(function (k) { headers[k] = options.headers[k]; });
  }
  return fetch(url, {
    method: (options && options.method) || 'GET',
    headers: headers,
    body: (options && options.body) ? JSON.stringify(options.body) : undefined
  });
}

/* ─────────────────────────────────────────
   LOAD ALL ORDERS
───────────────────────────────────────── */
/* ─────────────────────────────────────────
   LOAD ORDERS (Paged or Filtered)
───────────────────────────────────────── */
async function loadOrdersPaged(options) {
  var limit = options.limit || 20;
  var offset = options.offset || 0;
  var onlyBasic = options.onlyBasic !== false;
  var query = options.query || '';

  var select = onlyBasic
    ? 'id,order_no,d_no,fabric,date,image,saved_at'
    : `
      id,
      order_no,
      d_no,
      fabric,
      date,
      image,
      saved_at,
      fabric_rows(id,name,value),
      emb_rows(id,name,value),
      stitch_rows(id,name,value)
    `;

  var path = 'orders?select=' + select + '&order=saved_at.desc&limit=' + limit + '&offset=' + offset;

  if (query) {
    path += '&d_no=ilike.*' + encodeURIComponent(query) + '*';
  }

  var res = await sbFetch(path);
  if (!res.ok) throw new Error('Failed to load orders');
  var data = await res.json();
  return (data || []).map(mapOrder);
}

/* ─────────────────────────────────────────
   LOAD ALL ORDERS (with optional basic fetch)
───────────────────────────────────────── */
var _cachedOrders = null;
var _cachedOrdersPromise = null;
var CACHE_KEY = 'sb_orders_cache_v1';

function clearOrdersCache() {
  _cachedOrders = null;
  _cachedOrdersPromise = null;
  try { localStorage.removeItem(CACHE_KEY); } catch (e) { }
}

async function loadAllOrders(options) {
  var forceRefresh = options && options.forceRefresh;
  var select = (options && options.select) || '*,fabric_rows(*),emb_rows(*),stitch_rows(*)';

  // If we already have cached orders in memory (and it has the required columns), return them
  // For simplicity, we only cache the "full" fetch in memory
  if (!forceRefresh && _cachedOrders && select.indexOf('*') !== -1) return _cachedOrders;

  // Try loading from localStorage first
  if (!forceRefresh && select.indexOf('*') !== -1) {
    try {
      const localData = localStorage.getItem(CACHE_KEY);
      if (localData) {
        _cachedOrders = JSON.parse(localData);
        fetchAndCacheOrders();
        return _cachedOrders;
      }
    } catch (e) { }
  }

  return fetchAndCacheOrders(select);
}

async function fetchAndCacheOrders(select) {
  select = select || '*,fabric_rows(*),emb_rows(*),stitch_rows(*)';
  var isFull = select.indexOf('*') !== -1;

  if (isFull && _cachedOrdersPromise) return _cachedOrdersPromise;

  var promise = (async function () {
    try {
      var res = await sbFetch('orders?select=' + select + '&order=saved_at.desc');
      if (!res.ok) throw new Error('Failed to load orders');
      var data = await res.json();
      var mapped = (Array.isArray(data) ? data : []).map(mapOrder);

      if (isFull) {
        _cachedOrders = mapped;
        try { localStorage.setItem(CACHE_KEY, JSON.stringify(mapped)); } catch (e) { }
      }

      return mapped;
    } catch (e) {
      console.error('loadAllOrders error:', e);
      return isFull ? (Array.isArray(_cachedOrders) ? _cachedOrders : []) : [];
    } finally {
      if (isFull) _cachedOrdersPromise = null;
    }
  })();

  if (isFull) _cachedOrdersPromise = promise;
  return promise;
}


/* ─────────────────────────────────────────
   LOAD SINGLE ORDER / DETAILS
───────────────────────────────────────── */
async function loadOrder(id) {
  var res;
  try {
    res = await sbFetch('orders?select=*,fabric_rows(*),emb_rows(*),stitch_rows(*),handwork_rows(*)&id=eq.' + id);
    if (!res.ok) throw new Error('Query failed');
  } catch (e) {
    res = await sbFetch('orders?select=*,fabric_rows(*),emb_rows(*),stitch_rows(*)&id=eq.' + id);
  }
  if (!res.ok) throw new Error('Failed to load order');
  var data = await res.json();
  if (!data || !data.length) throw new Error('Not found');
  return mapOrder(data[0]);
}

async function loadOrderDetails(id) {
  var res;
  try {
    res = await sbFetch('orders?select=fabric_rows(*),emb_rows(*),stitch_rows(*),handwork_rows(*)&id=eq.' + id);
    if (!res.ok) throw new Error('Query failed');
  } catch (e) {
    res = await sbFetch('orders?select=fabric_rows(*),emb_rows(*),stitch_rows(*)&id=eq.' + id);
  }
  if (!res.ok) throw new Error('Failed to load order details');
  var data = await res.json();
  if (!data || !data.length) throw new Error('Not found');
  var o = data[0];
  return {
    fabricRows: (o.fabric_rows || []).map(mapFabricRow),
    embRows: (o.emb_rows || []).map(mapEmbRow),
    stitchRows: (o.stitch_rows || []).map(mapStitchRow),
    handworkRows: (o.handwork_rows || []).map(mapHandworkRow)
  };
}

/* ─────────────────────────────────────────
   MAPPING HELPERS
───────────────────────────────────────── */
function setLocalStatusOverride(id, status) {
  try {
    var overrides = JSON.parse(localStorage.getItem('sb_order_status_overrides') || '{}');
    overrides[id] = status;
    localStorage.setItem('sb_order_status_overrides', JSON.stringify(overrides));
  } catch (e) {}
}

function getLocalStatusOverride(id) {
  try {
    var overrides = JSON.parse(localStorage.getItem('sb_order_status_overrides') || '{}');
    return overrides[id];
  } catch (e) { return null; }
}

function mapOrder(o) {
  var localStatus = getLocalStatusOverride(o.id);
  return {
    id: o.id,
    orderNo: o.order_no,
    savedAt: o.saved_at,
    dNo: o.d_no,
    fabric: o.fabric,
    date: o.date,
    image: o.image,
    type: o.type || 'pipeline',
    status: localStatus || o.status || 'open',
    fabricRows: (o.fabric_rows || []).map(mapFabricRow),
    embRows: (o.emb_rows || []).map(mapEmbRow),
    stitchRows: (o.stitch_rows || []).map(mapStitchRow),
    handworkRows: (o.handwork_rows || []).map(mapHandworkRow)
  };
}

function mapFabricRow(r) {
  return {
    partyName: r.party_name,
    fabricName: r.fabric_name,
    colour: r.colour,
    workFab: r.work_fab,
    plainFab: r.plain_fab,
    totalFab: r.total_fab,
    receivedFab: r.received_fab,
    workPcs: r.work_pcs
  };
}

function mapEmbRow(r) {
  return {
    partyName: r.party_name,
    date: r.date,
    sentFront: r.sent_front,
    sentBack: r.sent_back,
    sentSleeve: r.sent_sleeve,
    returnFront: r.return_front,
    returnBack: r.return_back,
    returnSleeve: r.return_sleeve
  };
}

function mapStitchRow(r) {
  return {
    partyName: r.party_name,
    sentDate: r.sent_date,
    expectedPcs: r.expected_pcs,
    receivedPcs: r.received_pcs
  };
}

function mapHandworkRow(r) {
  return {
    partyName: r.party_name,
    sentDate: r.sent_date,
    colour: r.colour,
    expectedPcs: r.expected_pcs,
    receivedPcs: r.received_pcs
  };
}


/* ─────────────────────────────────────────
   UPLOAD IMAGE TO SUPABASE STORAGE
───────────────────────────────────────── */
async function uploadImage(base64Data, fileName) {
  if (!base64Data || !base64Data.startsWith('data:image')) return base64Data;

  try {
    // 1. Convert base64 to Blob
    var base64Parts = base64Data.split(',');
    var contentType = base64Parts[0].match(/:(.*?);/)[1];
    var byteCharacters = atob(base64Parts[1]);
    var byteNumbers = new Array(byteCharacters.length);
    for (var i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    var byteArray = new Uint8Array(byteNumbers);
    var blob = new Blob([byteArray], { type: contentType });

    // 2. Define path (e.g., "orders/timestamp-filename.png")
    var cleanFileName = (fileName || 'image').replace(/\s+/g, '_').replace(/[^a-zA-Z0-9._-]/g, '');
    var path = 'orders/' + Date.now() + '-' + cleanFileName;
    var url = SUPABASE_URL + '/storage/v1/object/order-images/' + path;

    // 3. Upload to Supabase Storage
    var res = await fetch(url, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': 'Bearer ' + SUPABASE_ANON_KEY,
        'Content-Type': contentType,
        'x-upsert': 'true'
      },
      body: blob
    });

    if (!res.ok) {
      var err = await res.json();
      throw new Error(err.message || 'Upload failed');
    }

    // 4. Return the Public URL
    return SUPABASE_URL + '/storage/v1/object/public/order-images/' + path;
  } catch (e) {
    console.error('uploadImage error:', e);
    return base64Data; // Fallback to base64 if upload fails
  }
}

/**
 * ONE-TIME MIGRATION: 
 * Moves all existing base64 images from the database to Supabase Storage.
 * Run this from the browser console: await migrateImagesToStorage()
 */
async function migrateImagesToStorage() {
  console.log('Starting migration...');
  var loader = document.getElementById('page-loader');
  if (loader) loader.style.display = 'flex';

  try {
    // 1. Fetch all orders with images
    var allOrders = await loadAllOrders({ forceRefresh: true });
    var base64Orders = allOrders.filter(function(o) {
      return o.image && o.image.startsWith('data:image');
    });

    console.log('Found ' + base64Orders.length + ' orders with base64 images.');

    for (var i = 0; i < base64Orders.length; i++) {
      var order = base64Orders[i];
      console.log('Migrating order ' + (i + 1) + '/' + base64Orders.length + ' (ID: ' + order.id + ')...');

      // 2. Upload image
      var newUrl = await uploadImage(order.image, (order.dNo || 'order') + '.png');

      if (newUrl && newUrl.startsWith('http')) {
        // 3. Update database record
        var res = await sbFetch('orders?id=eq.' + order.id, {
          method: 'PATCH',
          body: { image: newUrl }
        });

        if (!res.ok) console.error('Failed to update record for ID: ' + order.id);
        else console.log('Successfully migrated ID: ' + order.id);
      }
    }

    console.log('Migration complete!');
    alert('Migration complete! ' + base64Orders.length + ' images moved to storage.');
    clearOrdersCache();
    location.reload();
  } catch (err) {
    console.error('Migration failed:', err);
    alert('Migration failed: ' + err.message);
  } finally {
    if (loader) loader.style.display = 'none';
  }
}

/* ─────────────────────────────────────────
   SAVE NEW ORDER
───────────────────────────────────────── */
async function saveOrder(orderData) {
  clearOrdersCache();

  // Upload image to Supabase Storage if it's base64
  if (orderData.image && orderData.image.startsWith('data:image')) {
    orderData.image = await uploadImage(orderData.image, (orderData.dNo || 'order') + '.png');
  }

  var payload = {
    d_no: orderData.dNo,
    fabric: orderData.fabric,
    date: orderData.date,
    image: orderData.image,
    type: orderData.type || 'pipeline',
    status: orderData.status || 'open'
  };
  if (orderData.orderNo) {
    payload.order_no = orderData.orderNo;
  }

  // Insert order
  var res = await sbFetch('orders', {
    method: 'POST',
    body: payload
  });
  if (!res.ok) {
    var errData = await res.json().catch(function () { return {}; });
    var msg = errData.message || errData.error || '';
    if (msg.indexOf('status') !== -1 || msg.indexOf('column') !== -1) {
      delete payload.status;
      res = await sbFetch('orders', {
        method: 'POST',
        body: payload
      });
      if (!res.ok) {
        var errData2 = await res.json().catch(function () { return {}; });
        throw new Error(errData2.message || errData2.error || 'Failed to save order');
      }
    } else {
      throw new Error(msg || 'Failed to save order');
    }
  }
  var rows = await res.json();
  var order = Array.isArray(rows) ? rows[0] : rows;
  if (!order || !order.id) throw new Error('Order creation failed: Invalid response');
  var orderId = order.id;

  // Insert fabric rows
  if (orderData.fabricRows && orderData.fabricRows.length > 0) {
    await sbFetch('fabric_rows', {
      method: 'POST',
      body: orderData.fabricRows.map(function (r) {
        return {
          order_id: orderId,
          party_name: r.partyName,
          fabric_name: r.fabricName,
          colour: r.colour,
          work_fab: r.workFab,
          plain_fab: r.plainFab,
          total_fab: r.totalFab,
          received_fab: r.receivedFab,
          work_pcs: r.workPcs
        };
      })
    });
  }

  // Insert emb rows
  if (orderData.embRows && orderData.embRows.length > 0) {
    await sbFetch('emb_rows', {
      method: 'POST',
      body: orderData.embRows.map(function (r) {
        return {
          order_id: orderId,
          party_name: r.partyName,
          date: r.date,
          sent_front: r.sentFront,
          sent_back: r.sentBack,
          sent_sleeve: r.sentSleeve,
          return_front: r.returnFront,
          return_back: r.returnBack,
          return_sleeve: r.returnSleeve
        };
      })
    });
  }

  // Insert stitch rows
  if (orderData.stitchRows && orderData.stitchRows.length > 0) {
    await sbFetch('stitch_rows', {
      method: 'POST',
      body: orderData.stitchRows.map(function (r) {
        return {
          order_id: orderId,
          party_name: r.partyName,
          sent_date: r.sentDate,
          expected_pcs: r.expectedPcs,
          received_pcs: r.receivedPcs
        };
      })
    });
  }

  // Insert handwork rows (safe catch if table not created yet)
  if (orderData.handworkRows && orderData.handworkRows.length > 0) {
    try {
      await sbFetch('handwork_rows', {
        method: 'POST',
        body: orderData.handworkRows.map(function (r) {
          return {
            order_id: orderId,
            party_name: r.partyName,
            sent_date: r.sentDate,
            colour: r.colour,
            expected_pcs: r.expectedPcs,
            received_pcs: r.receivedPcs
          };
        })
      });
    } catch (e) {
      console.warn("handwork_rows insert failed (table might not exist):", e);
    }
  }

  return order;
}

/* ─────────────────────────────────────────
   UPDATE ORDER
───────────────────────────────────────── */
async function updateOrder(id, orderData) {
  clearOrdersCache();

  // Upload image to Supabase Storage if it's base64
  if (orderData.image && orderData.image.startsWith('data:image')) {
    orderData.image = await uploadImage(orderData.image, (orderData.dNo || 'order') + '.png');
  }

  var updatePayload = {
    d_no: orderData.dNo,
    fabric: orderData.fabric,
    date: orderData.date,
    image: orderData.image,
    type: orderData.type || 'pipeline'
  };
  if (orderData.status !== undefined) {
    updatePayload.status = orderData.status;
  }
  if (orderData.orderNo) {
    updatePayload.order_no = orderData.orderNo;
  }

  // Update order
  var res = await sbFetch('orders?id=eq.' + id, {
    method: 'PATCH',
    body: updatePayload
  });
  if (!res.ok) {
    var errData = await res.json().catch(function () { return {}; });
    var msg = errData.message || errData.error || '';
    if ((msg.indexOf('status') !== -1 || msg.indexOf('column') !== -1) && orderData.status !== undefined) {
      setLocalStatusOverride(id, orderData.status);
      delete updatePayload.status;
      res = await sbFetch('orders?id=eq.' + id, {
        method: 'PATCH',
        body: updatePayload
      });
      if (!res.ok) {
        var errData2 = await res.json().catch(function () { return {}; });
        throw new Error(errData2.message || errData2.error || 'Failed to update order');
      }
    } else {
      throw new Error(msg || 'Failed to update order');
    }
  }

  // Delete old child rows
  await sbFetch('fabric_rows?order_id=eq.' + id, { method: 'DELETE' });
  await sbFetch('emb_rows?order_id=eq.' + id, { method: 'DELETE' });
  await sbFetch('stitch_rows?order_id=eq.' + id, { method: 'DELETE' });
  try {
    await sbFetch('handwork_rows?order_id=eq.' + id, { method: 'DELETE' });
  } catch (e) {}

  // Re-insert fabric rows
  if (orderData.fabricRows && orderData.fabricRows.length > 0) {
    await sbFetch('fabric_rows', {
      method: 'POST',
      body: orderData.fabricRows.map(function (r) {
        return {
          order_id: id,
          party_name: r.partyName,
          fabric_name: r.fabricName,
          colour: r.colour,
          work_fab: r.workFab,
          plain_fab: r.plainFab,
          total_fab: r.totalFab,
          received_fab: r.receivedFab,
          work_pcs: r.workPcs
        };
      })
    });
  }

  // Re-insert emb rows
  if (orderData.embRows && orderData.embRows.length > 0) {
    await sbFetch('emb_rows', {
      method: 'POST',
      body: orderData.embRows.map(function (r) {
        return {
          order_id: id,
          party_name: r.partyName,
          date: r.date,
          sent_front: r.sentFront,
          sent_back: r.sentBack,
          sent_sleeve: r.sentSleeve,
          return_front: r.returnFront,
          return_back: r.returnBack,
          return_sleeve: r.returnSleeve
        };
      })
    });
  }

  // Re-insert stitch rows
  if (orderData.stitchRows && orderData.stitchRows.length > 0) {
    await sbFetch('stitch_rows', {
      method: 'POST',
      body: orderData.stitchRows.map(function (r) {
        return {
          order_id: id,
          party_name: r.partyName,
          sent_date: r.sentDate,
          expected_pcs: r.expectedPcs,
          received_pcs: r.receivedPcs
        };
      })
    });
  }

  // Re-insert handwork rows
  if (orderData.handworkRows && orderData.handworkRows.length > 0) {
    try {
      await sbFetch('handwork_rows', {
        method: 'POST',
        body: orderData.handworkRows.map(function (r) {
          return {
            order_id: id,
            party_name: r.partyName,
            sent_date: r.sentDate,
            colour: r.colour,
            expected_pcs: r.expectedPcs,
            received_pcs: r.receivedPcs
          };
        })
      });
    } catch (e) {
      console.warn("handwork_rows update failed (table might not exist):", e);
    }
  }
}

/* ─────────────────────────────────────────
   DELETE ORDER
───────────────────────────────────────── */
async function deleteOrderApi(id) {
  clearOrdersCache();
  var res = await sbFetch('orders?id=eq.' + id, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete');
}

/* ─────────────────────────────────────────
   SUBMIT — save new OR update existing
───────────────────────────────────────── */
async function submitForm() {
  var designs = document.querySelectorAll('#designs-container .design-block');
  if (!designs.length) {
    alert('Please add at least one design before submitting.');
    return;
  }

  // Validate D No fields
  var valid = true;
  designs.forEach(function (block) {
    var id = block.id.replace('design-', '');
    var dno = document.getElementById('dno-' + id);
    if (!dno || !dno.value.trim()) {
      if (dno) dno.style.borderColor = '#e53935';
      valid = false;
    } else {
      dno.style.borderColor = '';
    }
  });
  if (!valid) { alert('Please fill in all Design Numbers.'); return; }

  // Show loader
  var loader = document.getElementById('page-loader');
  if (loader) loader.style.display = 'flex';

  try {
    if (currentEditId) {
      // ── UPDATE existing record ──
      var block = designs[0];
      var id = block.id.replace('design-', '');
      var imgEl = block.querySelector('img.preview-img');
      var data = collectRows(id);

      var updateData = {
        dNo: val('dno-' + id),
        fabric: val('fabric-' + id),
        date: val('date-' + id),
        image: imgEl ? imgEl.src : '',
        fabricRows: data.fabricRows,
        embRows: data.embRows,
        stitchRows: data.stitchRows
      };

      await updateOrder(currentEditId, updateData);
      showToast('&#x2714; Record updated! Redirecting...', '#e65100');
      if (loader) loader.style.display = 'none';
      setTimeout(function () { window.location.href = 'allrecords.html'; }, 1500);

    } else {
      // ── SAVE new records ──
      var allOrders = await loadAllOrders();
      if (!Array.isArray(allOrders)) allOrders = [];
      var maxOrderNo = 0;
      allOrders.forEach(function (o) {
        var num = parseInt(o.orderNo) || 0;
        if (num > maxOrderNo) maxOrderNo = num;
      });

      for (var i = 0; i < designs.length; i++) {
        maxOrderNo++;
        var block = designs[i];
        var id = block.id.replace('design-', '');
        var imgEl = block.querySelector('img.preview-img');
        var data = collectRows(id);

        await saveOrder({
          orderNo: maxOrderNo,
          dNo: val('dno-' + id),
          fabric: val('fabric-' + id),
          date: val('date-' + id),
          image: imgEl ? imgEl.src : '',
          fabricRows: data.fabricRows,
          embRows: data.embRows,
          stitchRows: data.stitchRows
        });
      }

      showToast('&#x2714; Order saved! Redirecting...');
      if (loader) loader.style.display = 'none';
      setTimeout(function () { window.location.href = 'allrecords.html'; }, 1500);
    }
  } catch (err) {
    alert('Error saving order: ' + err.message);
    console.error(err);
    if (loader) loader.style.display = 'none';
  }
}

/* ─────────────────────────────────────────
   EDIT RECORD — load into main form
───────────────────────────────────────── */
async function editRecord(recordId) {
  var loader = document.getElementById('page-loader');
  if (loader) loader.style.display = 'flex';

  try {
    var order = await loadOrder(recordId);

    // Close the list/search modal
    closeModal();

    // Clear all existing design blocks and reset counters
    document.getElementById('designs-container').innerHTML = '';
    designCount = 0;
    fabricCounters = {};
    embroideryCounters = {};
    stitchCounters = {};

    // Add one fresh design block
    addDesign();
    var blockId = designCount;

    // Fill header fields
    document.getElementById('orderno-' + blockId).value = order.orderNo || '—';
    document.getElementById('dno-' + blockId).value = order.dNo;
    document.getElementById('fabric-' + blockId).value = order.fabric;
    document.getElementById('date-' + blockId).value = order.date;

    // Fill image
    if (order.image) {
      setDropZoneImage(blockId, order.image);
    }

    // Fill rows
    fillRows(blockId, {
      fabricRows: order.fabricRows || [],
      embRows: order.embRows || [],
      stitchRows: order.stitchRows || []
    });

    // Switch UI to edit mode
    currentEditId = recordId;
    var btn = document.getElementById('submit-btn');
    btn.textContent = '\u2714 Update Record';
    btn.style.background = '#e65100';
    document.getElementById('edit-mode-banner').style.display = 'block';

    window.scrollTo({ top: 0, behavior: 'smooth' });
  } catch (e) {
    console.error('Edit record error:', e);
    alert('Error loading record: ' + e.message);
  }

  if (loader) loader.style.display = 'none';
}

/* ─────────────────────────────────────────
   CANCEL EDIT — restore normal state
───────────────────────────────────────── */
function cancelEdit() {
  currentEditId = null;

  var btn = document.getElementById('submit-btn');
  btn.textContent = '\u2714 Submit Order';
  btn.style.background = '';

  document.getElementById('edit-mode-banner').style.display = 'none';

  // Reset to one blank design
  document.getElementById('designs-container').innerHTML = '';
  designCount = 0;
  fabricCounters = {};
  embroideryCounters = {};
  stitchCounters = {};
  addDesign();
}

/* ─────────────────────────────────────────
   SEARCH BY DESIGN NUMBER
───────────────────────────────────────── */
async function searchDesign() {
  var query = document.getElementById('search-input').value.trim().toLowerCase();
  if (!query) { alert('Please enter a Design Number to search.'); return; }

  var loader = document.getElementById('page-loader');
  if (loader) loader.style.display = 'flex';

  try {
    var allOrders = await loadAllOrders();
    var results = allOrders.filter(function (o) {
      return o.dNo && o.dNo.toLowerCase().indexOf(query) !== -1;
    });

    document.getElementById('modal-title').textContent = results.length
      ? 'Results for "' + query + '" (' + results.length + ')'
      : 'No results for "' + query + '"';

    renderRecordCards(results);
    document.getElementById('search-modal').classList.add('open');
  } catch (err) {
    console.error('Search error:', err);
  } finally {
    if (loader) loader.style.display = 'none';
  }
}

/* ─────────────────────────────────────────
   SHOW ALL DESIGNS
───────────────────────────────────────── */
async function showAllDesigns() {
  var loader = document.getElementById('page-loader');
  if (loader) loader.style.display = 'flex';

  try {
    var all = await loadAllOrders();
    document.getElementById('modal-title').textContent = all.length
      ? 'All Saved Designs (' + all.length + ')'
      : 'No Saved Designs Yet';
    renderRecordCards(all);
    document.getElementById('search-modal').classList.add('open');
  } catch (err) {
    console.error('Show all error:', err);
  } finally {
    if (loader) loader.style.display = 'none';
  }
}

/* ─────────────────────────────────────────
   SEARCH BY PARTY NAME
───────────────────────────────────────── */
async function searchByParty() {
  var query = document.getElementById('party-search-input').value.trim().toLowerCase();
  if (!query) { alert('Please enter a Party Name to search.'); return; }

  var loader = document.getElementById('page-loader');
  if (loader) loader.style.display = 'flex';

  try {
    var allOrders = await loadAllOrders();
    var results = [];

    allOrders.forEach(function (order) {
      var matchedFabric = (order.fabricRows || []).filter(function (r) {
        return r.partyName && r.partyName.toLowerCase().indexOf(query) !== -1;
      });
      var matchedEmb = (order.embRows || []).filter(function (r) {
        return r.partyName && r.partyName.toLowerCase().indexOf(query) !== -1;
      });
      var matchedStitch = (order.stitchRows || []).filter(function (r) {
        return r.partyName && r.partyName.toLowerCase().indexOf(query) !== -1;
      });
      if (matchedFabric.length || matchedEmb.length || matchedStitch.length) {
        results.push({ order: order, embRows: matchedEmb, stitchRows: matchedStitch });
      }
    });

    document.getElementById('modal-title').textContent = results.length
      ? 'Party: "' + query + '" (' + results.length + ')'
      : 'No results for party "' + query + '"';

    renderPartyCards(results);
    document.getElementById('search-modal').classList.add('open');
  } catch (err) {
    console.error('Party search error:', err);
  } finally {
    if (loader) loader.style.display = 'none';
  }
}

/* ─────────────────────────────────────────
   RENDER PARTY CARDS (placeholder)
───────────────────────────────────────── */
function renderPartyCards(results) {
  var body = document.getElementById('modal-body');
  if (!results.length) { body.innerHTML = '<div class="modal-empty">No orders found.</div>'; return; }
  body.innerHTML = results.map(function (item) {
    var order = item.order;
    return '<div class="record-card"><div class="record-card-header"><div><strong style="color:#e65100;">Order No: ' + escHtml(order.orderNo || '—') + '</strong> | D No: ' + escHtml(order.dNo) + '</div><button class="btn-edit-record" onclick="editRecord(\'' + order.id + '\')">&#x270E; Edit</button></div></div>';
  }).join('');
}

/* ─────────────────────────────────────────
   RENDER RECORD CARDS (placeholder)
───────────────────────────────────────── */
function renderRecordCards(records) {
  var body = document.getElementById('modal-body');
  if (!records.length) { body.innerHTML = '<div class="modal-empty">No saved orders found.</div>'; return; }
  body.innerHTML = records.map(function (order) {
    return '<div class="record-card"><div class="record-card-header"><div><strong style="color:#e65100;">Order No: ' + escHtml(order.orderNo || '—') + '</strong> | D No: ' + escHtml(order.dNo) + '</div><div style="display:flex;gap:8px;"><button class="btn-edit-record" onclick="editRecord(\'' + order.id + '\')">&#x270E; Edit</button><button class="btn-delete-record" onclick="deleteRecord(\'' + order.id + '\')">&#x1F5D1; Delete</button></div></div></div>';
  }).join('');
}

/* ─────────────────────────────────────────
   TOGGLE DETAILS
───────────────────────────────────────── */
function toggleDetail(detailId, btn) {
  var el = document.getElementById(detailId);
  if (el.style.display === 'none') {
    el.style.display = 'block';
    btn.innerHTML = '&#x1F4CB; Hide';
  } else {
    el.style.display = 'none';
    btn.innerHTML = '&#x1F4CB; Details';
  }
}

/* ─────────────────────────────────────────
   DELETE RECORD
───────────────────────────────────────── */
async function deleteRecord(recordId) {
  if (!confirm('Delete this record? This cannot be undone.')) return;
  try {
    await deleteOrderApi(recordId);
    showToast('&#x2714; Record deleted!', '#d32f2f');
    if (typeof refreshActiveView === 'function') {
      await refreshActiveView();
    } else {
      setTimeout(function () { location.reload(); }, 1000);
    }
  } catch (err) {
    alert('Error deleting record: ' + err.message);
  }
}

/* ─────────────────────────────────────────
   MODAL CLOSE
───────────────────────────────────────── */
function closeModal() {
  var modal = document.getElementById('search-modal');
  if (modal) modal.classList.remove('open');
}

// Close on overlay click
document.addEventListener('DOMContentLoaded', function () {
  var modal = document.getElementById('search-modal');
  if (modal) {
    modal.addEventListener('click', function (e) {
      if (e.target === this) closeModal();
    });
  }
});

/* ─────────────────────────────────────────
   PIPELINE DATA AGGREGATORS FOR SPA
   ───────────────────────────────────────── */

// Get distinct parties and their stats across all orders
function getPartiesStats(orders) {
  var parties = {};
  orders.forEach(function (order) {
    var seenInOrder = {};
    
    // Helper to log party
    function logParty(name, type) {
      if (!name || !name.trim()) return;
      var key = name.trim();
      if (!parties[key]) {
        parties[key] = { name: key, fabricCount: 0, embCount: 0, handworkCount: 0, stitchCount: 0, totalCount: 0 };
      }
      if (!seenInOrder[key + '-' + type]) {
        seenInOrder[key + '-' + type] = true;
        if (type === 'fabric') parties[key].fabricCount++;
        if (type === 'emb') parties[key].embCount++;
        if (type === 'handwork') parties[key].handworkCount++;
        if (type === 'stitch') parties[key].stitchCount++;
      }
    }
    
    (order.fabricRows || []).forEach(function(r) { logParty(r.partyName, 'fabric'); });
    (order.embRows || []).forEach(function(r) { logParty(r.partyName, 'emb'); });
    (order.handworkRows || []).forEach(function(r) { logParty(r.partyName, 'handwork'); });
    (order.stitchRows || []).forEach(function(r) { logParty(r.partyName, 'stitch'); });
  });
  
  return Object.keys(parties).map(function (k) {
    var p = parties[k];
    p.totalCount = p.fabricCount + p.embCount + p.handworkCount + p.stitchCount;
    return p;
  }).sort(function(a, b) { return b.totalCount - a.totalCount; });
}

// Get flattened fabric rows with parent order metadata
function getFabricPipeline(orders) {
  var rows = [];
  orders.forEach(function (order) {
    (order.fabricRows || []).forEach(function (r) {
      rows.push({
        orderId: order.id,
        orderNo: order.orderNo,
        dNo: order.dNo,
        date: order.date,
        partyName: r.partyName,
        fabricName: r.fabricName,
        colour: r.colour,
        workFab: r.workFab,
        plainFab: r.plainFab,
        totalFab: r.totalFab,
        receivedFab: r.receivedFab,
        workPcs: r.workPcs
      });
    });
  });
  return rows;
}

// Get flattened embroidery rows with parent order metadata
function getEmbroideryPipeline(orders) {
  var rows = [];
  orders.forEach(function (order) {
    (order.embRows || []).forEach(function (r) {
      var sentFront = parseFloat(r.sentFront) || 0;
      var sentBack = parseFloat(r.sentBack) || 0;
      var sentSleeve = parseFloat(r.sentSleeve) || 0;
      var returnFront = parseFloat(r.returnFront) || 0;
      var returnBack = parseFloat(r.returnBack) || 0;
      var returnSleeve = parseFloat(r.returnSleeve) || 0;
      
      var totalSent = sentFront + sentBack + sentSleeve;
      var totalReturned = returnFront + returnBack + returnSleeve;
      var balance = totalSent - totalReturned;
      
      rows.push({
        orderId: order.id,
        orderNo: order.orderNo,
        dNo: order.dNo,
        date: order.date,
        partyName: r.partyName,
        rowDate: r.date,
        sentFront: r.sentFront,
        sentBack: r.sentBack,
        sentSleeve: r.sentSleeve,
        returnFront: r.returnFront,
        returnBack: r.returnBack,
        returnSleeve: r.returnSleeve,
        totalSent: totalSent,
        totalReturned: totalReturned,
        balance: balance,
        status: balance <= 0 ? 'completed' : 'pending'
      });
    });
  });
  return rows;
}

// Get flattened handwork rows with parent order metadata
function getHandworkPipeline(orders) {
  var rows = [];
  orders.forEach(function (order) {
    (order.handworkRows || []).forEach(function (r) {
      var expected = parseFloat(r.expectedPcs) || 0;
      var received = parseFloat(r.receivedPcs) || 0;
      var balance = expected - received;
      var pct = expected > 0 ? Math.min(100, Math.round((received / expected) * 100)) : 0;
      
      rows.push({
        orderId: order.id,
        orderNo: order.orderNo,
        dNo: order.dNo,
        date: order.date,
        partyName: r.partyName,
        sentDate: r.sentDate,
        colour: r.colour,
        expectedPcs: r.expectedPcs,
        receivedPcs: r.receivedPcs,
        balance: balance,
        pct: pct,
        status: balance <= 0 ? 'completed' : 'pending'
      });
    });
  });
  return rows;
}

// Get flattened stitching rows with parent order metadata
function getStitchingPipeline(orders) {
  var rows = [];
  orders.forEach(function (order) {
    (order.stitchRows || []).forEach(function (r) {
      var expected = parseFloat(r.expectedPcs) || 0;
      var received = parseFloat(r.receivedPcs) || 0;
      var balance = expected - received;
      var pct = expected > 0 ? Math.min(100, Math.round((received / expected) * 100)) : 0;
      
      rows.push({
        orderId: order.id,
        orderNo: order.orderNo,
        dNo: order.dNo,
        date: order.date,
        partyName: r.partyName,
        sentDate: r.sentDate,
        expectedPcs: r.expectedPcs,
        receivedPcs: r.receivedPcs,
        balance: balance,
        pct: pct,
        status: balance <= 0 ? 'completed' : 'pending'
      });
    });
  });
  return rows;
}
