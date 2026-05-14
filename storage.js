/**
 * storage.js
 * Handles: localStorage CRUD, submit, edit, cancel,
 *          search, list-all, record cards, delete
 */

var STORAGE_KEY = 'garment_orders';
var currentEditId = null;   // non-null when in edit mode

/* ─────────────────────────────────────────
   STORAGE HELPERS
───────────────────────────────────────── */
function loadAllOrders() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
  catch (e) { return []; }
}

function saveAllOrders(orders) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(orders));
}

/* ─────────────────────────────────────────
   SUBMIT — save new OR update existing
───────────────────────────────────────── */
function submitForm() {
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

  if (currentEditId) {
    // ── UPDATE existing record ──
    var block = designs[0];
    var id = block.id.split('-')[1];
    var imgEl = block.querySelector('img.preview-img');
    var data = collectRows(id);

    var allOrders = loadAllOrders();
    for (var i = 0; i < allOrders.length; i++) {
      if (allOrders[i].id === currentEditId) {
        allOrders[i].dNo = document.getElementById('dno-' + id).value;
        allOrders[i].fabric = document.getElementById('fabric-' + id).value;
        allOrders[i].date = document.getElementById('date-' + id).value;
        allOrders[i].image = imgEl ? imgEl.src : allOrders[i].image;
        allOrders[i].fabricRows = data.fabricRows;
        allOrders[i].embRows = data.embRows;
        allOrders[i].stitchRows = data.stitchRows;
        allOrders[i].savedAt = allOrders[i].savedAt +
          ' (edited ' + new Date().toLocaleString() + ')';
        break;
      }
    }
    saveAllOrders(allOrders);
    showToast('&#x2714; Record updated! Redirecting...', '#e65100');
    setTimeout(function () { window.location.href = 'records.html'; }, 1500);

  } else {
    // ── SAVE new records ──
    var allOrders = loadAllOrders();
    // Auto-generate next order number
    var maxOrderNo = 0;
    allOrders.forEach(function (o) {
      var num = parseInt(o.orderNo) || 0;
      if (num > maxOrderNo) maxOrderNo = num;
    });
    designs.forEach(function (block) {
      maxOrderNo++;
      var id = block.id.split('-')[1];
      var imgEl = block.querySelector('img.preview-img');
      var data = collectRows(id);
      allOrders.push({
        id: Date.now() + '-' + Math.random().toString(36).slice(2, 7),
        orderNo: maxOrderNo,
        savedAt: new Date().toLocaleString(),
        dNo: document.getElementById('dno-' + id).value,
        fabric: document.getElementById('fabric-' + id).value,
        date: document.getElementById('date-' + id).value,
        image: imgEl ? imgEl.src : '',
        fabricRows: data.fabricRows,
        embRows: data.embRows,
        stitchRows: data.stitchRows
      });
    });
    saveAllOrders(allOrders);
    showToast('&#x2714; Order saved! Redirecting...');
    setTimeout(function () { window.location.href = 'records.html'; }, 1500);
  }
}

/* ─────────────────────────────────────────
   EDIT RECORD — load into main form
───────────────────────────────────────── */
function editRecord(recordId) {
  var allOrders = loadAllOrders();
  var order = null;
  for (var i = 0; i < allOrders.length; i++) {
    if (allOrders[i].id === recordId) { order = allOrders[i]; break; }
  }
  if (!order) { alert('Record not found.'); return; }

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
  var blockId = designCount; // will be 1

  // Fill header fields
  document.getElementById('orderno-' + blockId).value = order.orderNo || '—';
  document.getElementById('dno-' + blockId).value = order.dNo;
  document.getElementById('fabric-' + blockId).value = order.fabric;
  document.getElementById('date-' + blockId).value = order.date;

  // Fill image
  if (order.image) {
    setDropZoneImage(blockId, order.image);
  }

  // Fill rows (replaces the blank defaults)
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

  // Hide loader
  var loader = document.getElementById('page-loader');
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
function searchDesign() {
  var query = document.getElementById('search-input').value.trim().toLowerCase();
  if (!query) { alert('Please enter a Design Number to search.'); return; }

  var results = loadAllOrders().filter(function (o) {
    return o.dNo.toLowerCase().indexOf(query) !== -1;
  });

  document.getElementById('modal-title').textContent = results.length
    ? 'Results for "' + query + '" (' + results.length + ' record' + (results.length > 1 ? 's' : '') + ')'
    : 'No results for "' + query + '"';

  renderRecordCards(results);
  document.getElementById('search-modal').classList.add('open');
}

/* ─────────────────────────────────────────
   SHOW ALL DESIGNS
───────────────────────────────────────── */
function showAllDesigns() {
  var all = loadAllOrders();

  document.getElementById('modal-title').textContent = all.length
    ? 'All Saved Designs (' + all.length + ' record' + (all.length > 1 ? 's' : '') + ')'
    : 'No Saved Designs Yet';

  renderRecordCards(all);
  document.getElementById('search-modal').classList.add('open');
}

/* ─────────────────────────────────────────
   SEARCH BY PARTY NAME
   Finds all orders where the party appears
   in Embroidery or Stitching pipeline rows
───────────────────────────────────────── */
function searchByParty() {
  var query = document.getElementById('party-search-input').value.trim().toLowerCase();
  if (!query) { alert('Please enter a Party Name to search.'); return; }

  var allOrders = loadAllOrders();
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
      results.push({
        order: order,
        embRows: matchedEmb,
        stitchRows: matchedStitch
      });
    }
  });

  document.getElementById('modal-title').textContent = results.length
    ? 'Party: "' + query + '" (' + results.length + ' order' + (results.length > 1 ? 's' : '') + ')'
    : 'No results for party "' + query + '"';

  renderPartyCards(results, query);
  document.getElementById('search-modal').classList.add('open');
}

/* ─────────────────────────────────────────
   RENDER PARTY CARDS
───────────────────────────────────────── */
function renderPartyCards(results, partyQuery) {
  var body = document.getElementById('modal-body');

  if (!results.length) {
    body.innerHTML = '<div class="modal-empty">No orders found for this party.</div>';
    return;
  }

  var thE = 'background:#6a1b9a;color:#fff;padding:6px 8px;text-align:center;border:1px solid rgba(255,255,255,0.2);white-space:nowrap;';
  var thS = 'background:#00695c;color:#fff;padding:6px 8px;text-align:center;border:1px solid rgba(255,255,255,0.2);white-space:nowrap;';

  body.innerHTML = results.map(function (item) {
    var order = item.order;
    var imgTag = order.image
      ? '<img src="' + order.image + '" style="width:60px;height:60px;object-fit:cover;border-radius:6px;border:1px solid #ccc;margin-right:12px;flex-shrink:0;" />'
      : '';

    var embRowsHtml = item.embRows.map(function (r, i) {
      return '<tr><td>' + (i + 1) + '</td>' +
        '<td>' + escHtml(r.partyName) + '</td><td>' + escHtml(r.date) + '</td>' +
        '<td>' + escHtml(r.sentFront) + '</td><td>' + escHtml(r.sentBack) + '</td>' +
        '<td>' + escHtml(r.sentSleeve) + '</td>' +
        '<td>' + escHtml(r.returnFront) + '</td><td>' + escHtml(r.returnBack) + '</td>' +
        '<td>' + escHtml(r.returnSleeve) + '</td></tr>';
    }).join('');

    var stitchRowsHtml = item.stitchRows.map(function (r, i) {
      return '<tr><td>' + (i + 1) + '</td>' +
        '<td>' + escHtml(r.partyName) + '</td><td>' + escHtml(r.sentDate) + '</td>' +
        '<td>' + escHtml(r.expectedPcs) + '</td><td>' + escHtml(r.receivedPcs) + '</td></tr>';
    }).join('');

    var embSection = item.embRows.length ? (
      '<div class="record-table-wrap">' +
      '<div style="' + thE + 'border-radius:5px 5px 0 0;display:block;padding:5px 10px;">&#x1FAE7; Embroidery</div>' +
      '<table class="record-table">' +
      '<thead><tr>' +
      '<th style="' + thE + '">#</th>' +
      '<th style="' + thE + '">Party Name</th><th style="' + thE + '">Date</th>' +
      '<th style="' + thE + '">Sent Front</th><th style="' + thE + '">Sent Back</th><th style="' + thE + '">Sent Sleeve</th>' +
      '<th style="' + thE + '">Ret Front</th><th style="' + thE + '">Ret Back</th><th style="' + thE + '">Ret Sleeve</th>' +
      '</tr></thead>' +
      '<tbody>' + embRowsHtml + '</tbody>' +
      '</table>' +
      '</div>'
    ) : '';

    var stitchSection = item.stitchRows.length ? (
      '<div class="record-table-wrap">' +
      '<div style="' + thS + 'border-radius:5px 5px 0 0;display:block;padding:5px 10px;">&#x2702;&#xFE0F; Stitching</div>' +
      '<table class="record-table">' +
      '<thead><tr>' +
      '<th style="' + thS + '">#</th>' +
      '<th style="' + thS + '">Party Name</th><th style="' + thS + '">Sent Date</th>' +
      '<th style="' + thS + '">Expected Pcs</th><th style="' + thS + '">Received Pcs</th>' +
      '</tr></thead>' +
      '<tbody>' + stitchRowsHtml + '</tbody>' +
      '</table>' +
      '</div>'
    ) : '';

    return (
      '<div class="record-card">' +
      '<div class="record-card-header">' +
      '<div style="display:flex;align-items:center;">' +
      imgTag +
      '<div>' +
      '<strong style="color:#e65100;">Order No: ' + escHtml(order.orderNo || '—') + '</strong><br/>' +
      '<strong>D No: ' + escHtml(order.dNo) + '</strong><br/>' +
      '<span class="meta">Fabric: ' + escHtml(order.fabric) +
      ' &nbsp;|&nbsp; Date: ' + escHtml(order.date) + '</span>' +
      '</div>' +
      '</div>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap;">' +
      '<button class="btn-edit-record" onclick="editRecord(\'' + order.id + '\')">&#x270E; Edit</button>' +
      '</div>' +
      '</div>' +
      embSection + stitchSection +
      '</div>'
    );
  }).join('');
}

/* ─────────────────────────────────────────
   RENDER RECORD CARDS
───────────────────────────────────────── */
function renderRecordCards(records) {
  var body = document.getElementById('modal-body');

  if (!records.length) {
    body.innerHTML = '<div class="modal-empty">No saved orders found.</div>';
    return;
  }

  body.innerHTML = records.map(function (order, idx) {
    var imgTag = order.image
      ? '<img src="' + order.image + '" style="width:80px;height:80px;object-fit:cover;border-radius:6px;border:1px solid #ccc;margin-right:14px;flex-shrink:0;" />'
      : '<div style="width:80px;height:80px;border:1px dashed #ccc;border-radius:6px;display:flex;align-items:center;justify-content:center;color:#bbb;font-size:0.7rem;margin-right:14px;flex-shrink:0;">No Image</div>';

    var thF = 'background:#3949ab;color:#fff;padding:6px 8px;text-align:center;border:1px solid rgba(255,255,255,0.2);white-space:nowrap;';
    var thE = 'background:#6a1b9a;color:#fff;padding:6px 8px;text-align:center;border:1px solid rgba(255,255,255,0.2);white-space:nowrap;';
    var thS = 'background:#00695c;color:#fff;padding:6px 8px;text-align:center;border:1px solid rgba(255,255,255,0.2);white-space:nowrap;';

    var fabricRowsHtml = (order.fabricRows || []).map(function (r, i) {
      return '<tr><td>' + (i + 1) + '</td>' +
        '<td>' + escHtml(r.partyName) + '</td><td>' + escHtml(r.fabricName) + '</td><td>' + escHtml(r.colour) + '</td>' +
        '<td>' + escHtml(r.workFab) + '</td><td>' + escHtml(r.plainFab) + '</td>' +
        '<td>' + escHtml(r.totalFab) + '</td><td>' + escHtml(r.receivedFab) + '</td><td>' + escHtml(r.workPcs) + '</td></tr>';
    }).join('');

    var embRowsHtml = (order.embRows || []).map(function (r, i) {
      return '<tr><td>' + (i + 1) + '</td>' +
        '<td>' + escHtml(r.partyName) + '</td><td>' + escHtml(r.date) + '</td>' +
        '<td>' + escHtml(r.sentFront) + '</td><td>' + escHtml(r.sentBack) + '</td>' +
        '<td>' + escHtml(r.sentSleeve) + '</td>' +
        '<td>' + escHtml(r.returnFront) + '</td><td>' + escHtml(r.returnBack) + '</td>' +
        '<td>' + escHtml(r.returnSleeve) + '</td></tr>';
    }).join('');

    var stitchRowsHtml = (order.stitchRows || []).map(function (r, i) {
      return '<tr><td>' + (i + 1) + '</td>' +
        '<td>' + escHtml(r.partyName) + '</td><td>' + escHtml(r.sentDate) + '</td>' +
        '<td>' + escHtml(r.expectedPcs) + '</td><td>' + escHtml(r.receivedPcs) + '</td></tr>';
    }).join('');

    var detailId = 'record-detail-' + idx;

    return (
      '<div class="record-card">' +
      '<div class="record-card-header">' +
      '<div style="display:flex;align-items:center;">' +
      imgTag +
      '<div>' +
      '<strong style="color:#e65100;">Order No: ' + escHtml(order.orderNo || '—') + '</strong><br/>' +
      '<strong>D No: ' + escHtml(order.dNo) + '</strong><br/>' +
      '<span class="meta">Fabric: ' + escHtml(order.fabric) +
      ' &nbsp;|&nbsp; Date: ' + escHtml(order.date) + '</span><br/>' +
      '<span class="meta" style="color:#aaa;">Saved: ' + escHtml(order.savedAt) + '</span>' +
      '</div>' +
      '</div>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap;">' +
      '<button class="btn-detail-record" onclick="toggleDetail(\'' + detailId + '\', this)">&#x1F4CB; Details</button>' +
      '<button class="btn-edit-record"   onclick="editRecord(\'' + order.id + '\')">&#x270E; Edit</button>' +
      '<button class="btn-delete-record" onclick="deleteRecord(\'' + order.id + '\')">&#x1F5D1; Delete</button>' +
      '</div>' +
      '</div>' +
      '<div id="' + detailId + '" class="record-details" style="display:none;">' +
      /* Fabric table */
      '<div class="record-table-wrap">' +
      '<div style="' + thF + 'border-radius:5px 5px 0 0;display:block;padding:5px 10px;">&#x1F9F5; Fabric Order Details</div>' +
      '<table class="record-table">' +
      '<thead><tr>' +
      '<th style="' + thF + '">#</th>' +
      '<th style="' + thF + '">Party Name</th>' +
      '<th style="' + thF + '">Fabric Name</th><th style="' + thF + '">Colour</th>' +
      '<th style="' + thF + '">Work Fab</th><th style="' + thF + '">Plain Fab</th>' +
      '<th style="' + thF + '">Total Fab</th><th style="' + thF + '">Received Fab</th><th style="' + thF + '">Work Pcs</th>' +
      '</tr></thead>' +
      '<tbody>' + fabricRowsHtml + '</tbody>' +
      '</table>' +
      '</div>' +
      /* Embroidery table */
      '<div class="record-table-wrap">' +
      '<div style="' + thE + 'border-radius:5px 5px 0 0;display:block;padding:5px 10px;">&#x1FAE7; Embroidery Pipeline</div>' +
      '<table class="record-table">' +
      '<thead>' +
      '<tr>' +
      '<th style="' + thE + '" rowspan="2">#</th>' +
      '<th style="' + thE + '" rowspan="2">Party Name</th>' +
      '<th style="' + thE + '" rowspan="2">Date</th>' +
      '<th style="background:#4a148c;color:#fff;padding:6px 8px;text-align:center;border:1px solid rgba(255,255,255,0.2);" colspan="3">Work Sent (m)</th>' +
      '<th style="background:#4a148c;color:#fff;padding:6px 8px;text-align:center;border:1px solid rgba(255,255,255,0.2);" colspan="3">Work Returned (m)</th>' +
      '</tr>' +
      '<tr>' +
      '<th style="' + thE + '">Front</th><th style="' + thE + '">Back</th><th style="' + thE + '">Sleeve</th>' +
      '<th style="' + thE + '">Front</th><th style="' + thE + '">Back</th><th style="' + thE + '">Sleeve</th>' +
      '</tr>' +
      '</thead>' +
      '<tbody>' + embRowsHtml + '</tbody>' +
      '</table>' +
      '</div>' +
      /* Stitching table */
      '<div class="record-table-wrap">' +
      '<div style="' + thS + 'border-radius:5px 5px 0 0;display:block;padding:5px 10px;">&#x2702;&#xFE0F; Stitching Pipeline</div>' +
      '<table class="record-table">' +
      '<thead><tr>' +
      '<th style="' + thS + '">#</th>' +
      '<th style="' + thS + '">Party Name</th><th style="' + thS + '">Sent Date</th>' +
      '<th style="' + thS + '">Expected Pcs</th><th style="' + thS + '">Received Pcs</th>' +
      '</tr></thead>' +
      '<tbody>' + stitchRowsHtml + '</tbody>' +
      '</table>' +
      '</div>' +
      '</div>' +
      '</div>'
    );
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
function deleteRecord(recordId) {
  if (!confirm('Delete this record? This cannot be undone.')) return;
  saveAllOrders(loadAllOrders().filter(function (o) { return o.id !== recordId; }));
  // Refresh whichever view is open
  var title = document.getElementById('modal-title').textContent;
  if (title.indexOf('All Saved') !== -1) showAllDesigns(); else searchDesign();
}

/* ─────────────────────────────────────────
   MODAL CLOSE
───────────────────────────────────────── */
function closeModal() {
  document.getElementById('search-modal').classList.remove('open');
}

// Close on overlay click
document.addEventListener('DOMContentLoaded', function () {
  var searchModal = document.getElementById('search-modal');
  if (searchModal) {
    searchModal.addEventListener('click', function (e) {
      if (e.target === this) closeModal();
    });
  }
});
