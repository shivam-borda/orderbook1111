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
var _cachedOrders = null;
var _cachedOrdersPromise = null;
var CACHE_KEY = 'sb_orders_cache_v1';

function clearOrdersCache() {
  _cachedOrders = null;
  _cachedOrdersPromise = null;
  try { localStorage.removeItem(CACHE_KEY); } catch (e) {}
}

async function loadAllOrders(forceRefresh) {
  if (!forceRefresh && _cachedOrders) return _cachedOrders;

  // Try loading from localStorage first for instant results
  if (!forceRefresh) {
    try {
      const localData = localStorage.getItem(CACHE_KEY);
      if (localData) {
        _cachedOrders = JSON.parse(localData);
        // Kick off background refresh to update the cache silently
        fetchAndCacheOrders(); 
        return _cachedOrders;
      }
    } catch (e) {
      console.warn('Cache parse error:', e);
    }
  }

  return fetchAndCacheOrders();
}

async function fetchAndCacheOrders() {
  if (_cachedOrdersPromise) return _cachedOrdersPromise;

  _cachedOrdersPromise = (async function () {
    try {
      var res = await sbFetch('orders?select=*,fabric_rows(*),emb_rows(*),stitch_rows(*)&order=saved_at.desc');
      if (!res.ok) throw new Error('Failed to load orders');
      var data = await res.json();
      var mapped = (data || []).map(mapOrder);
      
      _cachedOrders = mapped;
      try { localStorage.setItem(CACHE_KEY, JSON.stringify(mapped)); } catch (e) {}
      
      return mapped;
    } catch (e) {
      console.error('loadAllOrders error:', e);
      return _cachedOrders || []; // Return stale cache if fetch fails
    } finally {
      _cachedOrdersPromise = null;
    }
  })();
  return _cachedOrdersPromise;
}

/* ─────────────────────────────────────────
   LOAD SINGLE ORDER
───────────────────────────────────────── */
async function loadOrder(id) {
  var res = await sbFetch('orders?select=*,fabric_rows(*),emb_rows(*),stitch_rows(*)&id=eq.' + id);
  if (!res.ok) throw new Error('Failed to load order');
  var data = await res.json();
  if (!data || !data.length) throw new Error('Not found');
  return mapOrder(data[0]);
}

/* ─────────────────────────────────────────
   MAP DB ROW TO FRONTEND FORMAT
───────────────────────────────────────── */
function mapOrder(o) {
  return {
    id: o.id,
    orderNo: o.order_no,
    savedAt: o.saved_at,
    dNo: o.d_no,
    fabric: o.fabric,
    date: o.date,
    image: o.image,
    fabricRows: (o.fabric_rows || []).map(function (r) {
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
    }),
    embRows: (o.emb_rows || []).map(function (r) {
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
    }),
    stitchRows: (o.stitch_rows || []).map(function (r) {
      return {
        partyName: r.party_name,
        sentDate: r.sent_date,
        expectedPcs: r.expected_pcs,
        receivedPcs: r.received_pcs
      };
    })
  };
}

/* ─────────────────────────────────────────
   SAVE NEW ORDER
───────────────────────────────────────── */
async function saveOrder(orderData) {
  clearOrdersCache();
  // Insert order
  var res = await sbFetch('orders', {
    method: 'POST',
    body: {
      d_no: orderData.dNo,
      fabric: orderData.fabric,
      date: orderData.date,
      image: orderData.image
    }
  });
  if (!res.ok) throw new Error('Failed to save order');
  var rows = await res.json();
  var order = rows[0];
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

  return order;
}

/* ─────────────────────────────────────────
   UPDATE ORDER
───────────────────────────────────────── */
async function updateOrder(id, orderData) {
  clearOrdersCache();
  // Update order
  var res = await sbFetch('orders?id=eq.' + id, {
    method: 'PATCH',
    body: {
      d_no: orderData.dNo,
      fabric: orderData.fabric,
      date: orderData.date,
      image: orderData.image
    }
  });
  if (!res.ok) throw new Error('Failed to update order');

  // Delete old child rows
  await sbFetch('fabric_rows?order_id=eq.' + id, { method: 'DELETE' });
  await sbFetch('emb_rows?order_id=eq.' + id, { method: 'DELETE' });
  await sbFetch('stitch_rows?order_id=eq.' + id, { method: 'DELETE' });

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
  var designs = document.querySelectorAll('.design-block');
  if (!designs.length) {
    alert('Please add at least one design before submitting.');
    return;
  }

  // Validate D No fields
  var valid = true;
  designs.forEach(function (block) {
    var id = block.id.split('-')[1];
    var dno = document.getElementById('dno-' + id);
    if (!dno.value.trim()) {
      dno.style.borderColor = '#e53935';
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
      var id = block.id.split('-')[1];
      var imgEl = block.querySelector('img.preview-img');
      var data = collectRows(id);

      var updateData = {
        dNo: document.getElementById('dno-' + id).value,
        fabric: document.getElementById('fabric-' + id).value,
        date: document.getElementById('date-' + id).value,
        image: imgEl ? imgEl.src : '',
        fabricRows: data.fabricRows,
        embRows: data.embRows,
        stitchRows: data.stitchRows
      };

      await updateOrder(currentEditId, updateData);
      showToast('&#x2714; Record updated! Redirecting...', '#e65100');
      if (loader) loader.style.display = 'none';
      setTimeout(function () { window.location.href = 'records.html'; }, 1500);

    } else {
      // ── SAVE new records ──
      var allOrders = await loadAllOrders();
      var maxOrderNo = 0;
      allOrders.forEach(function (o) {
        var num = parseInt(o.orderNo) || 0;
        if (num > maxOrderNo) maxOrderNo = num;
      });

      for (var i = 0; i < designs.length; i++) {
        maxOrderNo++;
        var block = designs[i];
        var id = block.id.split('-')[1];
        var imgEl = block.querySelector('img.preview-img');
        var data = collectRows(id);

        await saveOrder({
          orderNo: maxOrderNo,
          dNo: document.getElementById('dno-' + id).value,
          fabric: document.getElementById('fabric-' + id).value,
          date: document.getElementById('date-' + id).value,
          image: imgEl ? imgEl.src : '',
          fabricRows: data.fabricRows,
          embRows: data.embRows,
          stitchRows: data.stitchRows
        });
      }

      showToast('&#x2714; Order saved! Redirecting...');
      if (loader) loader.style.display = 'none';
      setTimeout(function () { window.location.href = 'records.html'; }, 1500);
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

  var allOrders = await loadAllOrders();
  var results = allOrders.filter(function (o) {
    return o.dNo && o.dNo.toLowerCase().indexOf(query) !== -1;
  });

  document.getElementById('modal-title').textContent = results.length
    ? 'Results for "' + query + '" (' + results.length + ')'
    : 'No results for "' + query + '"';

  renderRecordCards(results);
  document.getElementById('search-modal').classList.add('open');
}

/* ─────────────────────────────────────────
   SHOW ALL DESIGNS
───────────────────────────────────────── */
async function showAllDesigns() {
  var all = await loadAllOrders();
  document.getElementById('modal-title').textContent = all.length
    ? 'All Saved Designs (' + all.length + ')'
    : 'No Saved Designs Yet';
  renderRecordCards(all);
  document.getElementById('search-modal').classList.add('open');
}

/* ─────────────────────────────────────────
   SEARCH BY PARTY NAME
───────────────────────────────────────── */
async function searchByParty() {
  var query = document.getElementById('party-search-input').value.trim().toLowerCase();
  if (!query) { alert('Please enter a Party Name to search.'); return; }

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
    setTimeout(function () { location.reload(); }, 1000);
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
