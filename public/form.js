/**
 * form.js
 * Garment Unit SPA Dashboard & Forms Controller
 */

var designCount = 0;
var fabricCounters = {};
var embroideryCounters = {};
var handworkCounters = {};
var stitchCounters = {};

var activeTab = 'dashboard';
var cachedOrders = [];
var currentEditId = null;

// Searchable Dropdowns State
var dropdowns = {};

/* ═══════════════════════════════════════════
   SPA TAB SWITCHER & CONTROLLER
   ═══════════════════════════════════════════ */
async function switchTab(tabId) {
  activeTab = tabId;

  // Update sidebar buttons
  document.querySelectorAll('.sidebar-nav .nav-item').forEach(function (btn) {
    btn.classList.remove('active');
  });
  var activeBtn = document.getElementById('nav-' + tabId);
  if (activeBtn) activeBtn.classList.add('active');

  // Automatically expand parent dropdown if sub-item is active
  var submenu = document.getElementById('orders-submenu');
  var parentBtn = document.getElementById('nav-orders-parent');
  if (tabId === 'new-order' || tabId === 'ready-order') {
    if (submenu) submenu.classList.add('open');
    if (parentBtn) parentBtn.classList.add('open');
  } else {
    if (submenu) submenu.classList.remove('open');
    if (parentBtn) parentBtn.classList.remove('open');
  }

  // Close mobile sidebar if open
  var sidebar = document.getElementById('sidebar');
  if (sidebar) sidebar.classList.remove('open');

  // Show active section
  document.querySelectorAll('.tab-content').forEach(function (section) {
    section.classList.remove('active');
  });
  var activeSection = document.getElementById('tab-' + tabId);
  if (activeSection) activeSection.classList.add('active');

  // Handle transitions
  if (tabId === 'new-order') {
    if (!currentEditId) {
      resetFormToNew();
    }
  } else if (tabId === 'ready-order') {
    resetReadyForm();
  } else {
    currentEditId = null;
    await refreshActiveView();
  }
}

function toggleSidebarDropdown() {
  var submenu = document.getElementById('orders-submenu');
  var btn = document.getElementById('nav-orders-parent');
  if (submenu && btn) {
    submenu.classList.toggle('open');
    btn.classList.toggle('open');
  }
}

async function refreshActiveView() {
  var loader = document.getElementById('page-loader');
  if (loader) loader.style.display = 'flex';

  try {
    cachedOrders = await loadAllOrders({ forceRefresh: true });

    if (activeTab === 'dashboard') {
      await renderDashboard();
    } else if (activeTab === 'all-parties') {
      renderParties();
    } else if (activeTab === 'fabric-orders') {
      renderFabricPipeline();
    } else if (activeTab === 'embroidery') {
      renderEmbroideryPipeline();
    } else if (activeTab === 'stitching') {
      renderStitchingPipeline();
    }
  } catch (err) {
    console.error('Error refreshing view:', err);
  } finally {
    if (loader) loader.style.display = 'none';
  }
}

function toggleSidebar() {
  var sidebar = document.getElementById('sidebar');
  if (sidebar) sidebar.classList.toggle('open');
}

function logout() {
  sessionStorage.removeItem('loggedIn');
  window.location.href = 'login.html';
}

/* ═══════════════════════════════════════════
   TAB VIEW: DASHBOARD OVERVIEW
   ═══════════════════════════════════════════ */
var selectedOrderId = null;

async function renderDashboard() {
  var partiesStats = getPartiesStats(cachedOrders);
  var fabricLines = getFabricPipeline(cachedOrders);
  var embLines = getEmbroideryPipeline(cachedOrders);
  var stitchLines = getStitchingPipeline(cachedOrders);

  // 1. Render Metrics
  document.getElementById('stats-total-orders').textContent = cachedOrders.length;
  document.getElementById('stats-embroidery-jobs').textContent = embLines.length;
  document.getElementById('stats-stitching-jobs').textContent = stitchLines.length;
  document.getElementById('stats-active-parties').textContent = partiesStats.length;

  // 2. Populate filters lists
  var orderNos = [];
  var parties = [];
  var dNos = [];

  cachedOrders.forEach(function (o) {
    if (o.orderNo) orderNos.push(String(o.orderNo));
    if (o.dNo) dNos.push(o.dNo);
  });
  partiesStats.forEach(function (p) {
    parties.push(p.name);
  });

  orderNos = orderNos.filter(function (v, i, a) { return a.indexOf(v) === i; }).sort((a, b) => a - b);
  dNos = dNos.filter(function (v, i, a) { return a.indexOf(v) === i; }).sort();

  initSearchDropdown('sd-orderno', orderNos, 'All Orders', filterOrders);
  initSearchDropdown('sd-party', parties, 'All Parties', filterOrders);
  initSearchDropdown('sd-dno', dNos, 'All Designs', filterOrders);

  // 3. Render Orders List
  filterOrders();
}

function filterOrders() {
  var orderNo = (dropdowns['sd-orderno'] ? dropdowns['sd-orderno'].selected : '').toLowerCase();
  var party = (dropdowns['sd-party'] ? dropdowns['sd-party'].selected : '').toLowerCase();
  var dno = (dropdowns['sd-dno'] ? dropdowns['sd-dno'].selected : '').toLowerCase();

  var results = cachedOrders.filter(function (order) {
    if (orderNo && String(order.orderNo).toLowerCase() !== orderNo) return false;
    if (dno && String(order.dNo).toLowerCase().indexOf(dno) === -1) return false;
    if (party) {
      var matchesParty = false;
      (order.fabricRows || []).forEach(function (r) { if (r.partyName && r.partyName.toLowerCase() === party) matchesParty = true; });
      (order.embRows || []).forEach(function (r) { if (r.partyName && r.partyName.toLowerCase() === party) matchesParty = true; });
      (order.stitchRows || []).forEach(function (r) { if (r.partyName && r.partyName.toLowerCase() === party) matchesParty = true; });
      if (!matchesParty) return false;
    }
    return true;
  });

  document.getElementById('orders-results-title').textContent = 'Orders (' + results.length + ')';

  var masterContainer = document.getElementById('master-list-container');
  var detailContainer = document.getElementById('detail-view-container');

  if (!results.length) {
    masterContainer.innerHTML = '<div style="text-align:center;padding:30px;color:#888;font-size:0.88rem;">No matching orders.</div>';
    detailContainer.innerHTML = '<div class="detail-view-empty"><span>&#x1F4CB;</span>Select an order to view details</div>';
    return;
  }

  // Render compact list rows
  masterContainer.innerHTML = results.map(function (order) {
    return '<div class="master-row-item" id="row-' + order.id + '" onclick="selectOrder(\'' + order.id + '\')">' +
      '<div class="master-row-top">' +
      '<span class="master-row-no">Order #' + escHtml(order.orderNo) + '</span>' +
      '<span class="master-row-date">' + escHtml(order.date) + '</span>' +
      '</div>' +
      '<div class="master-row-dno">Design: ' + escHtml(order.dNo) + '</div>' +
      '<div class="master-row-bottom">' +
      '<span>Fabric: ' + escHtml(order.fabric || '—') + '</span>' +
      '</div>' +
      '</div>';
  }).join('');

  // Auto-select first order if previously selected is gone or not selected
  var selectedInResults = results.find(function (r) { return r.id === selectedOrderId; });
  if (selectedInResults) {
    selectOrder(selectedOrderId);
  } else {
    selectOrder(results[0].id);
  }
}

function selectOrder(orderId) {
  selectedOrderId = orderId;

  // Remove class active from all master row items and add to selected
  document.querySelectorAll('.master-row-item').forEach(function (row) {
    row.classList.remove('active');
  });
  var activeRow = document.getElementById('row-' + orderId);
  if (activeRow) activeRow.classList.add('active');

  // Find order
  var order = cachedOrders.find(function (o) { return o.id === orderId; });
  var detailContainer = document.getElementById('detail-view-container');

  if (!order) {
    detailContainer.innerHTML = '<div class="detail-view-empty"><span>&#x1F4CB;</span>Select an order to view details</div>';
    return;
  }

  var imgHtml = order.image
    ? '<div class="order-image-box" style="width:140px;height:140px;margin-bottom:0;"><img src="' + order.image + '" onclick="showImagePreview(\'' + order.image + '\')" /></div>'
    : '<div class="order-image-box" style="width:140px;height:140px;display:flex;align-items:center;justify-content:center;color:#999;font-size:0.75rem;margin-bottom:0;">No Image</div>';

  var fabricRows = (order.fabricRows || []).map(function (r, idx) {
    return '<tr>' +
      '<td>' + (idx + 1) + '</td>' +
      '<td>' + escHtml(r.partyName) + '</td>' +
      '<td>' + escHtml(r.fabricName) + '</td>' +
      '<td>' + escHtml(r.colour) + '</td>' +
      '<td>' + escHtml(r.workFab) + '</td>' +
      '<td>' + escHtml(r.plainFab) + '</td>' +
      '<td>' + escHtml(r.totalFab) + '</td>' +
      '<td>' + escHtml(r.receivedFab) + '</td>' +
      '<td>' + escHtml(r.workPcs) + '</td>' +
      '</tr>';
  }).join('');

  var embRows = (order.embRows || []).map(function (r, idx) {
    return '<tr>' +
      '<td>' + (idx + 1) + '</td>' +
      '<td>' + escHtml(r.partyName) + '</td>' +
      '<td>' + escHtml(r.date) + '</td>' +
      '<td>' + escHtml(r.sentFront) + ' / ' + escHtml(r.sentBack) + ' / ' + escHtml(r.sentSleeve) + '</td>' +
      '<td>' + escHtml(r.returnFront) + ' / ' + escHtml(r.returnBack) + ' / ' + escHtml(r.returnSleeve) + '</td>' +
      '</tr>';
  }).join('');

  var stitchRows = (order.stitchRows || []).map(function (r, idx) {
    return '<tr>' +
      '<td>' + (idx + 1) + '</td>' +
      '<td>' + escHtml(r.partyName) + '</td>' +
      '<td>' + escHtml(r.sentDate) + '</td>' +
      '<td>' + escHtml(r.expectedPcs) + '</td>' +
      '<td>' + escHtml(r.receivedPcs) + '</td>' +
      '</tr>';
  }).join('');

  detailContainer.innerHTML =
    '<div class="detail-header">' +
    '<div class="detail-title-group">' +
    '<span class="detail-orderno">Order #' + escHtml(order.orderNo) + '</span>' +
    '<span class="detail-meta">Saved: ' + escHtml(order.savedAt ? order.savedAt.split('T')[0] : order.date) + '</span>' +
    '</div>' +
    '<div class="order-actions">' +
    '<button class="btn btn-outline btn-sm" onclick="editRecord(\'' + order.id + '\')">&#x270E; Edit</button>' +
    '<button class="btn btn-danger btn-sm" onclick="deleteRecord(\'' + order.id + '\')">&#x1F5D1; Delete</button>' +
    '</div>' +
    '</div>' +
    '<div class="detail-body">' +
    '<div class="detail-overview">' +
    imgHtml +
    '<div class="detail-overview-stats">' +
    '<div class="detail-item"><span class="detail-label">Design No.</span><span class="detail-val" style="font-size:1.15rem;color:var(--primary);">' + escHtml(order.dNo) + '</span></div>' +
    '<div class="detail-item"><span class="detail-label">Fabric Type</span><span class="detail-val">' + escHtml(order.fabric || '—') + '</span></div>' +
    '<div class="detail-item"><span class="detail-label">Order Date</span><span class="detail-val">' + escHtml(order.date) + '</span></div>' +
    '</div>' +
    '</div>' +
    '<div class="order-card-detail-tables" style="padding:0;">' +
    (fabricRows ? '<div class="table-card"><div class="table-header-row"><span class="table-title">Fabric Allocations</span></div><div class="table-wrap"><table><thead><tr><th class="fabric-th">#</th><th class="fabric-th">Party Name</th><th class="fabric-th">Fabric Name</th><th class="fabric-th">Colour</th><th class="fabric-th">Work Fab</th><th class="fabric-th">Plain Fab</th><th class="fabric-th">Total Fab</th><th class="fabric-th">Received Fab</th><th class="fabric-th">Work Pcs</th></tr></thead><tbody>' + fabricRows + '</tbody></table></div></div>' : '') +
    (embRows ? '<div class="table-card"><div class="table-header-row"><span class="table-title">Embroidery Details</span></div><div class="table-wrap"><table><thead><tr><th class="embroidery-th">#</th><th class="embroidery-th">Party</th><th class="embroidery-th">Sent Date</th><th class="embroidery-th">Sent (F/B/S)</th><th class="embroidery-th">Returned (F/B/S)</th></tr></thead><tbody>' + embRows + '</tbody></table></div></div>' : '') +
    (stitchRows ? '<div class="table-card"><div class="table-header-row"><span class="table-title">Stitching Progress</span></div><div class="table-wrap"><table><thead><tr><th class="stitching-th">#</th><th class="stitching-th">Party</th><th class="stitching-th">Sent Date</th><th class="stitching-th">Expected Pcs</th><th class="stitching-th">Received Pcs</th></tr></thead><tbody>' + stitchRows + '</tbody></table></div></div>' : '') +
    '<div style="display:flex;gap:10px;justify-content:center;padding:10px 0 0 0;" class="order-actions">' +
    '<button class="btn btn-primary btn-sm" onclick="printOrderSlip(\'' + order.id + '\', \'fabric\')">&#x1F5A8; Print Fabric</button>' +
    '<button class="btn btn-secondary btn-sm" onclick="printOrderSlip(\'' + order.id + '\', \'embroidery\')">&#x1FAE7; Print Embroidery</button>' +
    '<button class="btn btn-teal btn-sm" onclick="printOrderSlip(\'' + order.id + '\', \'stitch\')">&#x2702;&#xFE0F; Print Stitching</button>' +
    '</div>' +
    '</div>' +
    '</div>';
}

function clearFilters() {
  if (dropdowns['sd-orderno']) { dropdowns['sd-orderno'].selected = ''; dropdowns['sd-orderno'].input.value = ''; }
  if (dropdowns['sd-party']) { dropdowns['sd-party'].selected = ''; dropdowns['sd-party'].input.value = ''; }
  if (dropdowns['sd-dno']) { dropdowns['sd-dno'].selected = ''; dropdowns['sd-dno'].input.value = ''; }
  selectedOrderId = null;
  filterOrders();
}

/* ─────────────────────────────────────────
   SEARCHABLE DROPDOWNS IMPLEMENTATION
   ───────────────────────────────────────── */
function initSearchDropdown(containerId, values, defaultLabel, onChange) {
  var container = document.getElementById(containerId);
  if (!container) return;
  var input = container.querySelector('.sd-input');
  var list = container.querySelector('.sd-list');

  dropdowns[containerId] = { values: values, selected: '', input: input, list: list, onChange: onChange };

  function renderList(filter) {
    var filtered = values.filter(function (v) {
      if (!filter) return true;
      return v.toLowerCase().indexOf(filter.toLowerCase()) !== -1;
    });
    list.innerHTML = '<div class="sd-item" data-value="">' + defaultLabel + '</div>' +
      filtered.map(function (v) {
        return '<div class="sd-item" data-value="' + escHtml(v) + '">' + escHtml(v) + '</div>';
      }).join('');
  }

  // Remove old listeners to avoid stacking
  var newInput = input.cloneNode(true);
  input.parentNode.replaceChild(newInput, input);
  input = newInput;
  dropdowns[containerId].input = input;

  input.addEventListener('focus', function () {
    renderList(input.value);
    list.classList.add('open');
  });

  input.addEventListener('input', function () {
    renderList(input.value);
    list.classList.add('open');
  });

  // Remove old list listener
  var newList = list.cloneNode(true);
  list.parentNode.replaceChild(newList, list);
  list = newList;
  dropdowns[containerId].list = list;

  list.addEventListener('click', function (e) {
    var item = e.target.closest('.sd-item');
    if (!item) return;
    var val = item.getAttribute('data-value');
    input.value = val;
    dropdowns[containerId].selected = val;
    list.classList.remove('open');
    if (onChange) onChange();
  });

  document.addEventListener('click', function (e) {
    if (!container.contains(e.target)) {
      list.classList.remove('open');
    }
  });

  renderList('');
}

/* ═══════════════════════════════════════════
   TAB VIEW: ALL PARTIES
   ═══════════════════════════════════════════ */
var selectedPartyName = null;
var selectedFabricParty = null;
var selectedEmbroideryParty = null;
var selectedStitchingParty = null;
var selectedHandworkParty = null;

/* ═══════════════════════════════════════════
   TAB VIEW: ALL PARTIES (MASTER-DETAIL)
   ═══════════════════════════════════════════ */
function renderParties() {
  var list = getPartiesStats(cachedOrders);
  var masterContainer = document.getElementById('parties-master-list');
  var detailContainer = document.getElementById('party-detail-container');

  if (!list.length) {
    masterContainer.innerHTML = '<div style="text-align:center;padding:30px;color:#888;font-size:0.88rem;">No parties.</div>';
    detailContainer.innerHTML = '<div class="detail-view-empty"><span>&#x1F4CB;</span>Select a party to view their orders</div>';
    return;
  }

  // Render compact left rows
  masterContainer.innerHTML = list.map(function (party) {
    var rowId = 'party-row-' + party.name.replace(/\s+/g, '_');
    return '<div class="master-row-item" id="' + rowId + '" onclick="selectParty(\'' + escHtml(party.name) + '\')">' +
      '<div class="master-row-top">' +
      '<span class="master-row-dno">' + escHtml(party.name) + '</span>' +
      '</div>' +
      '<div class="master-row-bottom" style="margin-top: 4px;">' +
      '<span>Fabric: ' + party.fabricCount + ' | Embroidery: ' + party.embCount + ' | Stitching: ' + party.stitchCount + '</span>' +
      '</div>' +
      '</div>';
  }).join('');

  // Auto-select first party or currently selected
  var selectedInResults = list.find(function (p) { return p.name === selectedPartyName; });
  if (selectedInResults) {
    selectParty(selectedPartyName);
  } else {
    selectParty(list[0].name);
  }
}

function selectParty(name) {
  selectedPartyName = name;

  document.querySelectorAll('#parties-master-list .master-row-item').forEach(function (row) {
    row.classList.remove('active');
  });
  var rowId = 'party-row-' + name.replace(/\s+/g, '_');
  var activeRow = document.getElementById(rowId);
  if (activeRow) activeRow.classList.add('active');

  // Filter parent orders containing this party
  var matchedOrders = cachedOrders.filter(function (order) {
    var hasParty = false;
    (order.fabricRows || []).forEach(function (r) { if (r.partyName && r.partyName.trim() === name) hasParty = true; });
    (order.embRows || []).forEach(function (r) { if (r.partyName && r.partyName.trim() === name) hasParty = true; });
    (order.stitchRows || []).forEach(function (r) { if (r.partyName && r.partyName.trim() === name) hasParty = true; });
    return hasParty;
  });

  var detailContainer = document.getElementById('party-detail-container');
  if (!matchedOrders.length) {
    detailContainer.innerHTML = '<div class="detail-view-empty"><span>&#x1F4CB;</span>No orders found for this party.</div>';
    return;
  }

  detailContainer.innerHTML =
    '<div class="detail-header">' +
    '<div class="detail-title-group">' +
    '<span class="detail-orderno">' + escHtml(name) + '</span>' +
    '<span class="detail-meta">Associated Orders (' + matchedOrders.length + ')</span>' +
    '</div>' +
    '</div>' +
    '<div class="detail-body">' +
    '<div class="orders-grid">' +
    matchedOrders.map(function (order) {
      var imgHtml = order.image
        ? '<div class="order-image-box" style="width:80px;height:80px;margin-bottom:0;"><img src="' + order.image + '" onclick="showImagePreview(\'' + order.image + '\')" /></div>'
        : '<div class="order-image-box" style="width:80px;height:80px;display:flex;align-items:center;justify-content:center;color:#999;font-size:0.7rem;margin-bottom:0;">No Image</div>';

      return '<div class="order-card" style="margin-bottom:0;box-shadow:none;border:1px solid #f1f3f7;">' +
        '<div class="order-card-header" style="padding:10px 14px;">' +
        '<div class="order-meta-info">' +
        '<span class="order-no-badge" style="font-size:0.78rem;padding:3px 8px;">Order #' + escHtml(order.orderNo) + '</span>' +
        '<span class="order-date-text" style="font-size:0.75rem;">' + escHtml(order.date) + '</span>' +
        '</div>' +
        '<div class="order-actions">' +
        '<button class="btn btn-outline btn-sm" onclick="editRecord(\'' + order.id + '\')" style="padding:4px 8px;font-size:0.75rem;">&#x270E; Edit</button>' +
        '<button class="btn btn-primary btn-sm" onclick="viewOrderInDashboard(\'' + order.id + '\')" style="padding:4px 8px;font-size:0.75rem;">&#x1F50D; View Full</button>' +
        '</div>' +
        '</div>' +
        '<div class="order-card-body" style="padding:12px 14px;gap:14px;">' +
        imgHtml +
        '<div class="order-details-summary" style="grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));">' +
        '<div class="detail-item"><span class="detail-label" style="font-size:0.65rem;">Design No.</span><span class="detail-val" style="font-size:0.85rem;">' + escHtml(order.dNo) + '</span></div>' +
        '<div class="detail-item"><span class="detail-label" style="font-size:0.65rem;">Fabric Type</span><span class="detail-val" style="font-size:0.85rem;">' + escHtml(order.fabric || '—') + '</span></div>' +
        '</div>' +
        '</div>' +
        '</div>';
    }).join('') +
    '</div>' +
    '</div>';
}

function viewOrderInDashboard(orderId) {
  switchTab('dashboard');
  setTimeout(function () {
    clearFilters();
    selectOrder(orderId);
    var activeRow = document.getElementById('row-' + orderId);
    if (activeRow) activeRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, 120);
}

/* ═══════════════════════════════════════════
   TAB VIEW: FABRIC ALLOCATIONS (MASTER-DETAIL - PARTY-WISE)
   ═══════════════════════════════════════════ */
function renderFabricPipeline() {
  var rows = getFabricPipeline(cachedOrders);
  var parties = rows.map(function (r) { return r.partyName; })
    .filter(function (v, i, a) { return v && a.indexOf(v) === i; })
    .sort();
  renderFabricParties(parties, rows);
}

function renderFabricParties(parties, allRows) {
  var masterContainer = document.getElementById('fabric-master-list');
  var detailContainer = document.getElementById('fabric-detail-container');

  if (!parties.length) {
    masterContainer.innerHTML = '<div style="text-align:center;padding:30px;color:#888;font-size:0.88rem;">No fabric parties found.</div>';
    detailContainer.innerHTML = '<div class="detail-view-empty"><span>&#x1F4CB;</span>Select a party to view details</div>';
    return;
  }

  masterContainer.innerHTML = parties.map(function (party) {
    var partyRows = allRows.filter(function (r) { return r.partyName === party; });
    var totalFab = partyRows.reduce(function (acc, r) { return acc + (parseFloat(r.totalFab) || 0); }, 0);
    var recFab = partyRows.reduce(function (acc, r) { return acc + (parseFloat(r.receivedFab) || 0); }, 0);
    var rowId = 'fabric-party-row-' + party.replace(/\s+/g, '_');

    return '<div class="master-row-item" id="' + rowId + '" onclick="selectFabricParty(\'' + escHtml(party) + '\')">' +
      '<div class="master-row-top">' +
      '<span class="master-row-dno">' + escHtml(party) + '</span>' +
      '</div>' +
      '<div class="master-row-bottom" style="font-size:0.75rem;color:var(--primary);margin-top:2px;">' +
      '<span>Jobs: ' + partyRows.length + ' | Rec: ' + recFab + ' / ' + totalFab + ' m</span>' +
      '</div>' +
      '</div>';
  }).join('');

  var selectedInResults = parties.find(function (p) { return p === selectedFabricParty; });
  if (selectedInResults) {
    selectFabricParty(selectedFabricParty);
  } else {
    selectFabricParty(parties[0]);
  }
}

function selectFabricParty(partyName) {
  selectedFabricParty = partyName;
  document.querySelectorAll('#fabric-master-list .master-row-item').forEach(function (row) {
    row.classList.remove('active');
  });
  var rowId = 'fabric-party-row-' + partyName.replace(/\s+/g, '_');
  var activeRow = document.getElementById(rowId);
  if (activeRow) activeRow.classList.add('active');

  var allRows = getFabricPipeline(cachedOrders);
  var partyRows = allRows.filter(function (r) { return r.partyName === partyName; });
  var detailContainer = document.getElementById('fabric-detail-container');

  if (!partyRows.length) {
    detailContainer.innerHTML = '<div class="detail-view-empty"><span>&#x1F4CB;</span>Select a party to view details</div>';
    return;
  }

  var tableRowsHtml = partyRows.map(function (r, idx) {
    return '<tr>' +
      '<td>' + escHtml(r.orderNo) + '</td>' +
      '<td>' + escHtml(r.dNo) + '</td>' +
      '<td>' + escHtml(r.date) + '</td>' +
      '<td>' + escHtml(r.fabricName) + '</td>' +
      '<td>' + escHtml(r.colour) + '</td>' +
      '<td>' + escHtml(r.workFab) + '</td>' +
      '<td>' + escHtml(r.plainFab) + '</td>' +
      '<td>' + escHtml(r.totalFab) + '</td>' +
      '<td>' + escHtml(r.receivedFab) + '</td>' +
      '<td>' + escHtml(r.workPcs) + '</td>' +
      '<td>' +
      '<div style="display:flex;gap:4px;">' +
      '<button class="btn btn-outline btn-sm" onclick="printOrderSlip(\'' + r.orderId + '\', \'fabric\')" style="padding:4px 8px;font-size:0.75rem;">Print</button>' +
      '<button class="btn btn-primary btn-sm" onclick="viewOrderInDashboard(\'' + r.orderId + '\')" style="padding:4px 8px;font-size:0.75rem;">Order</button>' +
      '</div>' +
      '</td>' +
      '</tr>';
  }).join('');

  detailContainer.innerHTML =
    '<div class="detail-header">' +
    '<div class="detail-title-group">' +
    '<span class="detail-orderno">' + escHtml(partyName) + '</span>' +
    '<span class="detail-meta">Fabric Allocation Registry Summary</span>' +
    '</div>' +
    '</div>' +
    '<div class="detail-body">' +
    '<div class="table-card">' +
    '<div class="table-wrap">' +
    '<table>' +
    '<thead>' +
    '<tr>' +
    '<th class="fabric-th">Order No</th>' +
    '<th class="fabric-th">Design No</th>' +
    '<th class="fabric-th">Date</th>' +
    '<th class="fabric-th">Fabric Name</th>' +
    '<th class="fabric-th">Colour</th>' +
    '<th class="fabric-th">Work Fab</th>' +
    '<th class="fabric-th">Plain Fab</th>' +
    '<th class="fabric-th">Total Fab</th>' +
    '<th class="fabric-th">Received Fab</th>' +
    '<th class="fabric-th">Work Pcs</th>' +
    '<th class="fabric-th">Actions</th>' +
    '</tr>' +
    '<tr class="filter-row">' +
    '<th><input type="text" id="fab-filter-orderno" placeholder="Filter..." oninput="filterFabricPartyRows()" style="width:100%;box-sizing:border-box;padding:4px 6px;font-size:0.75rem;border:1px solid #ccc;border-radius:4px;font-weight:normal;color:#333;" /></th>' +
    '<th><input type="text" id="fab-filter-dno" placeholder="Filter..." oninput="filterFabricPartyRows()" style="width:100%;box-sizing:border-box;padding:4px 6px;font-size:0.75rem;border:1px solid #ccc;border-radius:4px;font-weight:normal;color:#333;" /></th>' +
    '<th></th><th></th><th></th><th></th><th></th><th></th><th></th><th></th><th></th>' +
    '</tr>' +
    '</thead>' +
    '<tbody>' + tableRowsHtml + '</tbody>' +
    '</table>' +
    '</div>' +
    '</div>' +
    '</div>';
}

function filterFabricTable() {
  var q = document.getElementById('search-fabric').value.trim().toLowerCase();
  var rows = getFabricPipeline(cachedOrders);
  var parties = rows.map(function (r) { return r.partyName; })
    .filter(function (v, i, a) { return v && a.indexOf(v) === i; });
  if (q) {
    parties = parties.filter(function (name) {
      return name.toLowerCase().indexOf(q) !== -1;
    });
  }
  parties.sort();
  renderFabricParties(parties, rows);
}

/* ═══════════════════════════════════════════
   TAB VIEW: EMBROIDERY PIPELINE (MASTER-DETAIL - GROUPED BY DESIGN & ORDER)
   ═══════════════════════════════════════════ */
/* ═══════════════════════════════════════════
   TAB VIEW: EMBROIDERY PIPELINE (MASTER-DETAIL - PARTY-WISE)
   ═══════════════════════════════════════════ */
function renderEmbroideryPipeline() {
  var rows = getEmbroideryPipeline(cachedOrders);
  var parties = rows.map(function (r) { return r.partyName; })
    .filter(function (v, i, a) { return v && a.indexOf(v) === i; })
    .sort();
  renderEmbroideryParties(parties, rows);
}

function renderEmbroideryParties(parties, allRows) {
  var masterContainer = document.getElementById('embroidery-master-list');
  var detailContainer = document.getElementById('embroidery-detail-container');

  if (!parties.length) {
    masterContainer.innerHTML = '<div style="text-align:center;padding:30px;color:#888;font-size:0.88rem;">No embroidery parties found.</div>';
    detailContainer.innerHTML = '<div class="detail-view-empty"><span>&#x1F4CB;</span>Select a party to view details</div>';
    return;
  }

  masterContainer.innerHTML = parties.map(function (party) {
    var partyRows = allRows.filter(function (r) { return r.partyName === party; });
    var totalSent = partyRows.reduce(function (acc, r) { return acc + (r.totalSent || 0); }, 0);
    var totalRet = partyRows.reduce(function (acc, r) { return acc + (r.totalReturned || 0); }, 0);
    var totalBal = totalSent - totalRet;
    var rowId = 'emb-party-row-' + party.replace(/\s+/g, '_');

    return '<div class="master-row-item" id="' + rowId + '" onclick="selectEmbroideryParty(\'' + escHtml(party) + '\')">' +
      '<div class="master-row-top">' +
      '<span class="master-row-dno">' + escHtml(party) + '</span>' +
      '</div>' +
      '<div class="master-row-bottom" style="font-size:0.75rem;color:var(--secondary);margin-top:2px;">' +
      '<span>Jobs: ' + partyRows.length + ' | Balance: ' + totalBal + ' m</span>' +
      '</div>' +
      '</div>';
  }).join('');

  var selectedInResults = parties.find(function (p) { return p === selectedEmbroideryParty; });
  if (selectedInResults) {
    selectEmbroideryParty(selectedEmbroideryParty);
  } else {
    selectEmbroideryParty(parties[0]);
  }
}

function selectEmbroideryParty(partyName) {
  selectedEmbroideryParty = partyName;
  document.querySelectorAll('#embroidery-master-list .master-row-item').forEach(function (row) {
    row.classList.remove('active');
  });
  var rowId = 'emb-party-row-' + partyName.replace(/\s+/g, '_');
  var activeRow = document.getElementById(rowId);
  if (activeRow) activeRow.classList.add('active');

  var allRows = getEmbroideryPipeline(cachedOrders);
  var partyRows = allRows.filter(function (r) { return r.partyName === partyName; });
  var detailContainer = document.getElementById('embroidery-detail-container');

  if (!partyRows.length) {
    detailContainer.innerHTML = '<div class="detail-view-empty"><span>&#x1F4CB;</span>Select a party to view details</div>';
    return;
  }

  var totalSent = partyRows.reduce(function (acc, r) { return acc + (r.totalSent || 0); }, 0);
  var totalRet = partyRows.reduce(function (acc, r) { return acc + (r.totalReturned || 0); }, 0);
  var totalBal = totalSent - totalRet;

  var tableRowsHtml = partyRows.map(function (r, idx) {
    var chipClass = r.status === 'completed' ? 'chip-completed' : 'chip-pending';
    return '<tr>' +
      '<td>' + escHtml(r.orderNo) + '</td>' +
      '<td>' + escHtml(r.dNo) + '</td>' +
      '<td>' + escHtml(r.rowDate) + '</td>' +
      '<td>' + escHtml(r.sentFront || '') + '</td>' +
      '<td>' + escHtml(r.sentBack || '') + '</td>' +
      '<td>' + escHtml(r.sentSleeve || '') + '</td>' +
      '<td>' + escHtml(r.returnFront || '') + '</td>' +
      '<td>' + escHtml(r.returnBack || '') + '</td>' +
      '<td>' + escHtml(r.returnSleeve || '') + '</td>' +
      '<td>' + r.totalSent + ' m</td>' +
      '<td>' + r.totalReturned + ' m</td>' +
      '<td>' +
      '<div style="display:flex;gap:4px;">' +
      '<button class="btn btn-outline btn-sm" onclick="printOrderSlip(\'' + r.orderId + '\', \'embroidery\')" style="padding:4px 8px;font-size:0.75rem;">Print</button>' +
      '<button class="btn btn-primary btn-sm" onclick="viewOrderInDashboard(\'' + r.orderId + '\')" style="padding:4px 8px;font-size:0.75rem;">Order</button>' +
      '</div>' +
      '</td>' +
      '</tr>';
  }).join('');

  detailContainer.innerHTML =
    '<div class="detail-header">' +
    '<div class="detail-title-group">' +
    '<span class="detail-orderno">' + escHtml(partyName) + '</span>' +
    '<span class="detail-meta">Embroidery Job Work Summary</span>' +
    '</div>' +
    '</div>' +
    '<div class="detail-body">' +
    '<div class="table-card">' +
    '<div class="table-wrap">' +
    '<table>' +
    '<thead>' +
    '<tr>' +
    '<th class="embroidery-th">Order No</th>' +
    '<th class="embroidery-th">Design No</th>' +
    '<th class="embroidery-th">Sent Date</th>' +
    '<th class="embroidery-th">Sent Front</th>' +
    '<th class="embroidery-th">Sent Back</th>' +
    '<th class="embroidery-th">Sent Sleeve</th>' +
    '<th class="embroidery-th">Ret Front</th>' +
    '<th class="embroidery-th">Ret Back</th>' +
    '<th class="embroidery-th">Ret Sleeve</th>' +
    '<th class="embroidery-th">Total Sent</th>' +
    '<th class="embroidery-th">Total Ret</th>' +
    '<th class="embroidery-th">Actions</th>' +
    '</tr>' +
    '<tr class="filter-row">' +
    '<th><input type="text" id="emb-filter-orderno" placeholder="Filter..." oninput="filterEmbroideryPartyRows()" style="width:100%;box-sizing:border-box;padding:4px 6px;font-size:0.75rem;border:1px solid #ccc;border-radius:4px;font-weight:normal;color:#333;" /></th>' +
    '<th><input type="text" id="emb-filter-dno" placeholder="Filter..." oninput="filterEmbroideryPartyRows()" style="width:100%;box-sizing:border-box;padding:4px 6px;font-size:0.75rem;border:1px solid #ccc;border-radius:4px;font-weight:normal;color:#333;" /></th>' +
    '<th></th><th></th><th></th><th></th><th></th><th></th><th></th><th></th><th></th><th></th>' +
    '</tr>' +
    '</thead>' +
    '<tbody>' + tableRowsHtml + '</tbody>' +
    '</table>' +
    '</div>' +
    '</div>' +
    '</div>';
}

function filterEmbTable() {
  var q = document.getElementById('search-embroidery').value.trim().toLowerCase();
  var rows = getEmbroideryPipeline(cachedOrders);
  var parties = rows.map(function (r) { return r.partyName; })
    .filter(function (v, i, a) { return v && a.indexOf(v) === i; });

  if (q) {
    parties = parties.filter(function (name) {
      return name.toLowerCase().indexOf(q) !== -1;
    });
  }
  parties.sort();
  renderEmbroideryParties(parties, rows);
}

/* ═══════════════════════════════════════════
   TAB VIEW: STITCHING PIPELINE (MASTER-DETAIL - PARTY-WISE)
   ═══════════════════════════════════════════ */
function renderStitchingPipeline() {
  var rows = getStitchingPipeline(cachedOrders);
  var parties = rows.map(function (r) { return r.partyName; })
    .filter(function (v, i, a) { return v && a.indexOf(v) === i; })
    .sort();
  renderStitchingParties(parties, rows);
}

function renderStitchingParties(parties, allRows) {
  var masterContainer = document.getElementById('stitching-master-list');
  var detailContainer = document.getElementById('stitching-detail-container');

  if (!parties.length) {
    masterContainer.innerHTML = '<div style="text-align:center;padding:30px;color:#888;font-size:0.88rem;">No stitching parties found.</div>';
    detailContainer.innerHTML = '<div class="detail-view-empty"><span>&#x1F4CB;</span>Select a party to view details</div>';
    return;
  }

  masterContainer.innerHTML = parties.map(function (party) {
    var partyRows = allRows.filter(function (r) { return r.partyName === party; });
    var expected = partyRows.reduce(function (acc, r) { return acc + (r.expectedPcs || 0); }, 0);
    var received = partyRows.reduce(function (acc, r) { return acc + (r.receivedPcs || 0); }, 0);
    var balance = expected - received;
    var pct = expected > 0 ? Math.round((received / expected) * 100) : 0;
    var rowId = 'stitch-party-row-' + party.replace(/\s+/g, '_');

    return '<div class="master-row-item" id="' + rowId + '" onclick="selectStitchingParty(\'' + escHtml(party) + '\')">' +
      '<div class="master-row-top">' +
      '<span class="master-row-dno">' + escHtml(party) + '</span>' +
      '</div>' +
      '<div class="master-row-bottom" style="font-size:0.75rem;color:var(--teal);margin-top:2px;">' +
      '<span>Jobs: ' + partyRows.length + ' | Progress: ' + pct + '%</span>' +
      '</div>' +
      '</div>';
  }).join('');

  var selectedInResults = parties.find(function (p) { return p === selectedStitchingParty; });
  if (selectedInResults) {
    selectStitchingParty(selectedStitchingParty);
  } else {
    selectStitchingParty(parties[0]);
  }
}

function selectStitchingParty(partyName) {
  selectedStitchingParty = partyName;
  document.querySelectorAll('#stitching-master-list .master-row-item').forEach(function (row) {
    row.classList.remove('active');
  });
  var rowId = 'stitch-party-row-' + partyName.replace(/\s+/g, '_');
  var activeRow = document.getElementById(rowId);
  if (activeRow) activeRow.classList.add('active');

  var allRows = getStitchingPipeline(cachedOrders);
  var partyRows = allRows.filter(function (r) { return r.partyName === partyName; });
  var detailContainer = document.getElementById('stitching-detail-container');

  if (!partyRows.length) {
    detailContainer.innerHTML = '<div class="detail-view-empty"><span>&#x1F4CB;</span>Select a party to view details</div>';
    return;
  }

  var expected = partyRows.reduce(function (acc, r) { return acc + (r.expectedPcs || 0); }, 0);
  var received = partyRows.reduce(function (acc, r) { return acc + (r.receivedPcs || 0); }, 0);
  var balance = expected - received;
  var pct = expected > 0 ? Math.round((received / expected) * 100) : 0;

  var tableRowsHtml = partyRows.map(function (r, idx) {
    var chipClass = r.status === 'completed' ? 'chip-completed' : 'chip-pending';
    return '<tr>' +
      '<td>' + escHtml(r.orderNo) + '</td>' +
      '<td>' + escHtml(r.dNo) + '</td>' +
      '<td>' + escHtml(r.sentDate) + '</td>' +
      '<td>' + escHtml(r.expectedPcs) + ' pcs</td>' +
      '<td>' + escHtml(r.receivedPcs) + ' pcs</td>' +
      '<td>' + r.balance + ' pcs</td>' +
      '<td>' +
      '<div style="display:flex;gap:4px;">' +
      '<button class="btn btn-outline btn-sm" onclick="printOrderSlip(\'' + r.orderId + '\', \'stitch\')" style="padding:4px 8px;font-size:0.75rem;">Print</button>' +
      '<button class="btn btn-primary btn-sm" onclick="viewOrderInDashboard(\'' + r.orderId + '\')" style="padding:4px 8px;font-size:0.75rem;">Order</button>' +
      '</div>' +
      '</td>' +
      '</tr>';
  }).join('');

  detailContainer.innerHTML =
    '<div class="detail-header">' +
    '<div class="detail-title-group">' +
    '<span class="detail-orderno">' + escHtml(partyName) + '</span>' +
    '<span class="detail-meta">Stitching Progress Registry Summary</span>' +
    '</div>' +
    '</div>' +
    '<div class="detail-body">' +
    '<div class="table-card">' +
    '<div class="table-wrap">' +
    '<table>' +
    '<thead>' +
    '<tr>' +
    '<th class="stitching-th">Order No</th>' +
    '<th class="stitching-th">Design No</th>' +
    '<th class="stitching-th">Sent Date</th>' +
    '<th class="stitching-th">Expected Pcs</th>' +
    '<th class="stitching-th">Received Pcs</th>' +
    '<th class="stitching-th">Balance</th>' +
    '<th class="stitching-th">Actions</th>' +
    '</tr>' +
    '<tr class="filter-row">' +
    '<th><input type="text" id="stitch-filter-orderno" placeholder="Filter..." oninput="filterStitchingPartyRows()" style="width:100%;box-sizing:border-box;padding:4px 6px;font-size:0.75rem;border:1px solid #ccc;border-radius:4px;font-weight:normal;color:#333;" /></th>' +
    '<th><input type="text" id="stitch-filter-dno" placeholder="Filter..." oninput="filterStitchingPartyRows()" style="width:100%;box-sizing:border-box;padding:4px 6px;font-size:0.75rem;border:1px solid #ccc;border-radius:4px;font-weight:normal;color:#333;" /></th>' +
    '<th></th><th></th><th></th><th></th><th></th>' +
    '</tr>' +
    '</thead>' +
    '<tbody>' + tableRowsHtml + '</tbody>' +
    '</table>' +
    '</div>' +
    '</div>' +
    '</div>';
}

function filterStitchTable() {
  var q = document.getElementById('search-stitching').value.trim().toLowerCase();
  var rows = getStitchingPipeline(cachedOrders);
  var parties = rows.map(function (r) { return r.partyName; })
    .filter(function (v, i, a) { return v && a.indexOf(v) === i; });

  if (q) {
    parties = parties.filter(function (name) {
      return name.toLowerCase().indexOf(q) !== -1;
    });
  }
  parties.sort();
  renderStitchingParties(parties, rows);
}

/* ═══════════════════════════════════════════
   UNIFIED DETAIL PANEL BUILDER (FAB/EMB/STITCH)
   ═══════════════════════════════════════════ */
function renderOrderDetailsInPane(orderId, containerId) {
  var order = cachedOrders.find(function (o) { return o.id === orderId; });
  var detailContainer = document.getElementById(containerId);

  if (!order) {
    detailContainer.innerHTML = '<div class="detail-view-empty"><span>&#x1F4CB;</span>Select a row to view parent order</div>';
    return;
  }

  var imgHtml = order.image
    ? '<div class="order-image-box" style="width:140px;height:140px;margin-bottom:0;"><img src="' + order.image + '" onclick="showImagePreview(\'' + order.image + '\')" /></div>'
    : '<div class="order-image-box" style="width:140px;height:140px;display:flex;align-items:center;justify-content:center;color:#999;font-size:0.75rem;margin-bottom:0;">No Image</div>';

  var fabricRows = (order.fabricRows || []).map(function (r, idx) {
    return '<tr>' +
      '<td>' + (idx + 1) + '</td>' +
      '<td>' + escHtml(r.partyName) + '</td>' +
      '<td>' + escHtml(r.fabricName) + '</td>' +
      '<td>' + escHtml(r.colour) + '</td>' +
      '<td>' + escHtml(r.workFab) + '</td>' +
      '<td>' + escHtml(r.plainFab) + '</td>' +
      '<td>' + escHtml(r.totalFab) + '</td>' +
      '<td>' + escHtml(r.receivedFab) + '</td>' +
      '<td>' + escHtml(r.workPcs) + '</td>' +
      '</tr>';
  }).join('');

  var embRows = (order.embRows || []).map(function (r, idx) {
    return '<tr>' +
      '<td>' + (idx + 1) + '</td>' +
      '<td>' + escHtml(r.partyName) + '</td>' +
      '<td>' + escHtml(r.date) + '</td>' +
      '<td>' + escHtml(r.sentFront || '') + '</td>' +
      '<td>' + escHtml(r.sentBack || '') + '</td>' +
      '<td>' + escHtml(r.sentSleeve || '') + '</td>' +
      '<td>' + escHtml(r.returnFront || '') + '</td>' +
      '<td>' + escHtml(r.returnBack || '') + '</td>' +
      '<td>' + escHtml(r.returnSleeve || '') + '</td>' +
      '</tr>';
  }).join('');

  var handworkRows = (order.handworkRows || []).map(function (r, idx) {
    return '<tr>' +
      '<td>' + (idx + 1) + '</td>' +
      '<td>' + escHtml(r.partyName) + '</td>' +
      '<td>' + escHtml(r.sentDate) + '</td>' +
      '<td>' + escHtml(r.colour) + '</td>' +
      '<td>' + escHtml(r.expectedPcs) + '</td>' +
      '<td>' + escHtml(r.receivedPcs) + '</td>' +
      '</tr>';
  }).join('');

  var stitchRows = (order.stitchRows || []).map(function (r, idx) {
    return '<tr>' +
      '<td>' + (idx + 1) + '</td>' +
      '<td>' + escHtml(r.partyName) + '</td>' +
      '<td>' + escHtml(r.sentDate) + '</td>' +
      '<td>' + escHtml(r.expectedPcs) + '</td>' +
      '<td>' + escHtml(r.receivedPcs) + '</td>' +
      '</tr>';
  }).join('');

  detailContainer.innerHTML =
    '<div class="detail-header">' +
    '<div class="detail-title-group">' +
    '<span class="detail-orderno">Order #' + escHtml(order.orderNo) + '</span>' +
    '<span class="detail-meta">Saved: ' + escHtml(order.savedAt ? order.savedAt.split('T')[0] : order.date) + '</span>' +
    '</div>' +
    '<div class="order-actions">' +
    '<button class="btn btn-outline btn-sm" onclick="editRecord(\'' + order.id + '\')">&#x270E; Edit</button>' +
    '<button class="btn btn-danger btn-sm" onclick="deleteRecord(\'' + order.id + '\')">&#x1F5D1; Delete</button>' +
    '</div>' +
    '</div>' +
    '<div class="detail-body">' +
    '<div class="detail-overview">' +
    imgHtml +
    '<div class="detail-overview-stats">' +
    '<div class="detail-item"><span class="detail-label">Design No.</span><span class="detail-val" style="font-size:1.15rem;color:var(--primary);">' + escHtml(order.dNo) + '</span></div>' +
    '<div class="detail-item"><span class="detail-label">Fabric Type</span><span class="detail-val">' + escHtml(order.fabric || '—') + '</span></div>' +
    '<div class="detail-item"><span class="detail-label">Order Date</span><span class="detail-val">' + escHtml(order.date) + '</span></div>' +
    '</div>' +
    '</div>' +
    '<div class="order-card-detail-tables" style="padding:0;">' +
    (fabricRows ? '<div class="table-card"><div class="table-header-row"><span class="table-title">Fabric Allocations</span></div><div class="table-wrap"><table><thead><tr><th class="fabric-th">#</th><th class="fabric-th">Party Name</th><th class="fabric-th">Fabric Name</th><th class="fabric-th">Colour</th><th class="fabric-th">Work Fab</th><th class="fabric-th">Plain Fab</th><th class="fabric-th">Total Fab</th><th class="fabric-th">Received Fab</th><th class="fabric-th">Work Pcs</th></tr></thead><tbody>' + fabricRows + '</tbody></table></div></div>' : '') +
    (handworkRows ? '<div class="table-card"><div class="table-header-row"><span class="table-title" style="color:#d81b60;">Hand Work Progress</span></div><div class="table-wrap"><table><thead><tr><th style="background:#d81b60;color:#fff">#</th><th style="background:#d81b60;color:#fff">Party Name</th><th style="background:#d81b60;color:#fff">Sent Date</th><th style="background:#d81b60;color:#fff">Colour</th><th style="background:#d81b60;color:#fff">Expected Pcs</th><th style="background:#d81b60;color:#fff">Received Pcs</th></tr></thead><tbody>' + handworkRows + '</tbody></table></div></div>' : '') +
    (embRows ? '<div class="table-card"><div class="table-header-row"><span class="table-title">Embroidery Details</span></div><div class="table-wrap"><table><thead><tr><th class="embroidery-th">#</th><th class="embroidery-th">Party Name</th><th class="embroidery-th">Date</th><th class="embroidery-th">Sent Front</th><th class="embroidery-th">Sent Back</th><th class="embroidery-th">Sent Sleeve</th><th class="embroidery-th">Ret Front</th><th class="embroidery-th">Ret Back</th><th class="embroidery-th">Ret Sleeve</th></tr></thead><tbody>' + embRows + '</tbody></table></div></div>' : '') +
    (stitchRows ? '<div class="table-card"><div class="table-header-row"><span class="table-title">Stitching Progress</span></div><div class="table-wrap"><table><thead><tr><th class="stitching-th">#</th><th class="stitching-th">Party</th><th class="stitching-th">Sent Date</th><th class="stitching-th">Expected Pcs</th><th class="stitching-th">Received Pcs</th></tr></thead><tbody>' + stitchRows + '</tbody></table></div></div>' : '') +
    '<div style="display:flex;gap:10px;justify-content:center;padding:10px 0 0 0;flex-wrap:wrap;" class="order-actions">' +
    '<button class="btn btn-primary btn-sm" onclick="printOrderSlip(\'' + order.id + '\', \'fabric\')">&#x1F5A8; Print Fabric</button>' +
    '<button class="btn btn-sm" style="background:#fce4ec;color:#c2185b;border:1px solid #f8bbd0;" onclick="printOrderSlip(\'' + order.id + '\', \'handwork\')">&#x270B; Print Hand Work</button>' +
    '<button class="btn btn-secondary btn-sm" onclick="printOrderSlip(\'' + order.id + '\', \'embroidery\')">&#x1FAE7; Print Embroidery</button>' +
    '<button class="btn btn-teal btn-sm" onclick="printOrderSlip(\'' + order.id + '\', \'stitch\')">&#x2702;&#xFE0F; Print Stitching</button>' +
    '</div>' +
    '</div>' +
    '</div>';
}

/* ═══════════════════════════════════════════
   PRINT PIPELINES CONTROLLERS
   ═══════════════════════════════════════════ */
function printPipeline(type) {
  var title = "";
  var headers = [];
  var rows = [];

  if (type === 'fabric') {
    title = 'Fabric Allocation Registry';
    headers = ['Order No', 'Design No', 'Date', 'Party Name', 'Fabric Name', 'Colour', 'Work Fab', 'Plain Fab', 'Total Fab', 'Received Fab', 'Work Pcs'];
    var rawRows = getFabricPipeline(cachedOrders);

    var q = document.getElementById('search-fabric') ? document.getElementById('search-fabric').value.trim().toLowerCase() : '';
    if (q) {
      rawRows = rawRows.filter(function (r) {
        return String(r.orderNo).toLowerCase().indexOf(q) !== -1 ||
          String(r.dNo).toLowerCase().indexOf(q) !== -1 ||
          r.partyName.toLowerCase().indexOf(q) !== -1 ||
          r.fabricName.toLowerCase().indexOf(q) !== -1 ||
          r.colour.toLowerCase().indexOf(q) !== -1;
      });
    }

    rows = rawRows.map(function (r) {
      return '<tr>' +
        '<td>' + escHtml(r.orderNo) + '</td>' +
        '<td>' + escHtml(r.dNo) + '</td>' +
        '<td>' + escHtml(r.date) + '</td>' +
        '<td>' + escHtml(r.partyName) + '</td>' +
        '<td>' + escHtml(r.fabricName) + '</td>' +
        '<td>' + escHtml(r.colour) + '</td>' +
        '<td>' + escHtml(r.workFab) + '</td>' +
        '<td>' + escHtml(r.plainFab) + '</td>' +
        '<td>' + escHtml(r.totalFab) + '</td>' +
        '<td>' + escHtml(r.receivedFab) + '</td>' +
        '<td>' + escHtml(r.workPcs) + '</td>' +
        '</tr>';
    });
  } else if (type === 'embroidery') {
    title = 'Embroidery Pipeline Registry';
    headers = ['Order No', 'Design No', 'Party Name', 'Sent Date', 'Sent (F/B/S)', 'Returned (F/B/S)', 'Total Sent', 'Total Ret', 'Balance', 'Status'];
    var rawRows = getEmbroideryPipeline(cachedOrders);

    var q = document.getElementById('search-embroidery') ? document.getElementById('search-embroidery').value.trim().toLowerCase() : '';
    if (q) {
      rawRows = rawRows.filter(function (r) {
        return String(r.orderNo).toLowerCase().indexOf(q) !== -1 ||
          String(r.dNo).toLowerCase().indexOf(q) !== -1 ||
          r.partyName.toLowerCase().indexOf(q) !== -1;
      });
    }

    rows = rawRows.map(function (r) {
      return '<tr>' +
        '<td>' + escHtml(r.orderNo) + '</td>' +
        '<td>' + escHtml(r.dNo) + '</td>' +
        '<td>' + escHtml(r.partyName) + '</td>' +
        '<td>' + escHtml(r.rowDate) + '</td>' +
        '<td>' + escHtml(r.sentFront) + '/' + escHtml(r.sentBack) + '/' + escHtml(r.sentSleeve) + '</td>' +
        '<td>' + escHtml(r.returnFront) + '/' + escHtml(r.returnBack) + '/' + escHtml(r.returnSleeve) + '</td>' +
        '<td>' + r.totalSent + ' m</td>' +
        '<td>' + r.totalReturned + ' m</td>' +
        '<td>' + r.balance + ' m</td>' +
        '<td>' + r.status.toUpperCase() + '</td>' +
        '</tr>';
    });
  } else if (type === 'stitching') {
    title = 'Stitching Job Registry';
    headers = ['Order No', 'Design No', 'Party Name', 'Sent Date', 'Expected Pcs', 'Received Pcs', 'Balance', 'Completion', 'Status'];
    var rawRows = getStitchingPipeline(cachedOrders);

    var q = document.getElementById('search-stitching') ? document.getElementById('search-stitching').value.trim().toLowerCase() : '';
    if (q) {
      rawRows = rawRows.filter(function (r) {
        return String(r.orderNo).toLowerCase().indexOf(q) !== -1 ||
          String(r.dNo).toLowerCase().indexOf(q) !== -1 ||
          r.partyName.toLowerCase().indexOf(q) !== -1;
      });
    }

    rows = rawRows.map(function (r) {
      return '<tr>' +
        '<td>' + escHtml(r.orderNo) + '</td>' +
        '<td>' + escHtml(r.dNo) + '</td>' +
        '<td>' + escHtml(r.partyName) + '</td>' +
        '<td>' + escHtml(r.sentDate) + '</td>' +
        '<td>' + escHtml(r.expectedPcs) + ' pcs</td>' +
        '<td>' + escHtml(r.receivedPcs) + ' pcs</td>' +
        '<td>' + r.balance + ' pcs</td>' +
        '<td>' + r.pct + '%</td>' +
        '<td>' + r.status.toUpperCase() + '</td>' +
        '</tr>';
    });
  }

  var w = window.open();
  w.document.write('<html><head><title>' + title + '</title>');
  w.document.write('<style>');
  w.document.write('body { font-family: sans-serif; padding: 25px; color: #333; }');
  w.document.write('h1 { text-align: center; font-size: 1.5rem; text-transform: uppercase; margin-bottom: 20px; color: #1a237e; }');
  w.document.write('table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 0.85rem; }');
  w.document.write('th, td { border: 1px solid #bdc3c7; padding: 8px 10px; text-align: center; }');
  w.document.write('th { background: #f5f6fa; font-weight: 700; color: #2c3e50; text-transform: uppercase; font-size: 0.72rem; }');
  w.document.write('tr:nth-child(even) { background: #fdfdfd; }');
  w.document.write('</style></head><body>');
  w.document.write('<h1>' + title + '</h1>');
  w.document.write('<table><thead><tr>' + headers.map(h => '<th>' + h + '</th>').join('') + '</tr></thead><tbody>' + rows.join('') + '</tbody></table>');
  w.document.write('</body></html>');
  w.document.close();

  setTimeout(function () {
    w.print();
    w.close();
  }, 500);
}

// Print single slip helper
async function printOrderSlip(orderId, type) {
  var loader = document.getElementById('page-loader');
  if (loader) loader.style.display = 'flex';

  try {
    // 1. Temporarily load into editing form structure
    var order = await loadOrder(orderId);

    // Clear and build one block to map target DOM for print.js
    var designsWrap = document.getElementById('designs-container');
    var oldDesigns = designsWrap.innerHTML;
    var oldDesignCount = designCount;
    var oldFabricCounters = fabricCounters;
    var oldEmbroideryCounters = embroideryCounters;
    var oldStitchCounters = stitchCounters;

    designsWrap.innerHTML = '';
    designCount = 0;
    fabricCounters = {};
    embroideryCounters = {};
    stitchCounters = {};

    addDesign();
    var bId = designCount;

    document.getElementById('orderno-' + bId).value = order.orderNo || '';
    document.getElementById('dno-' + bId).value = order.dNo || '';
    document.getElementById('fabric-' + bId).value = order.fabric || '';
    document.getElementById('date-' + bId).value = order.date || '';

    if (order.image) {
      setDropZoneImage(bId, order.image);
    }

    fillRows(bId, {
      fabricRows: order.fabricRows || [],
      handworkRows: order.handworkRows || [],
      embRows: order.embRows || [],
      stitchRows: order.stitchRows || []
    });

    // 2. Call print.js template printer
    printAs(type);

    // 3. Restore form structure
    designsWrap.innerHTML = oldDesigns;
    designCount = oldDesignCount;
    fabricCounters = oldFabricCounters;
    embroideryCounters = oldEmbroideryCounters;
    handworkCounters = oldHandworkCounters;
    stitchCounters = oldStitchCounters;
  } catch (err) {
    console.error(err);
    alert('Error printing slip: ' + err.message);
  } finally {
    if (loader) loader.style.display = 'none';
  }
}

function updatePartiesDatalists() {
  var fabricParties = [];
  var embParties = [];
  var handworkParties = [];
  var stitchParties = [];

  cachedOrders.forEach(function (order) {
    (order.fabricRows || []).forEach(function (r) {
      if (r.partyName && fabricParties.indexOf(r.partyName) === -1) {
        fabricParties.push(r.partyName);
      }
    });
    (order.embRows || []).forEach(function (r) {
      if (r.partyName && embParties.indexOf(r.partyName) === -1) {
        embParties.push(r.partyName);
      }
    });
    (order.handworkRows || []).forEach(function (r) {
      if (r.partyName && handworkParties.indexOf(r.partyName) === -1) {
        handworkParties.push(r.partyName);
      }
    });
    (order.stitchRows || []).forEach(function (r) {
      if (r.partyName && stitchParties.indexOf(r.partyName) === -1) {
        stitchParties.push(r.partyName);
      }
    });
  });

  fabricParties.sort();
  embParties.sort();
  handworkParties.sort();
  stitchParties.sort();

  var fList = document.getElementById('fabric-parties-list');
  if (fList) {
    fList.innerHTML = fabricParties.map(function (name) {
      return '<option value="' + escHtml(name) + '"></option>';
    }).join('');
  }

  var eList = document.getElementById('embroidery-parties-list');
  if (eList) {
    eList.innerHTML = embParties.map(function (name) {
      return '<option value="' + escHtml(name) + '"></option>';
    }).join('');
  }

  var hwList = document.getElementById('handwork-parties-list');
  if (hwList) {
    hwList.innerHTML = handworkParties.map(function (name) {
      return '<option value="' + escHtml(name) + '"></option>';
    }).join('');
  }

  var sList = document.getElementById('stitching-parties-list');
  if (sList) {
    sList.innerHTML = stitchParties.map(function (name) {
      return '<option value="' + escHtml(name) + '"></option>';
    }).join('');
  }
}

// Integration with storage.js deleteRecord
async function refreshActiveView() {
  var loader = document.getElementById('page-loader');
  if (loader) loader.style.display = 'flex';

  try {
    cachedOrders = await loadAllOrders({ forceRefresh: true });
    updatePartiesDatalists();

    if (activeTab === 'dashboard') {
      await renderDashboard();
    } else if (activeTab === 'all-parties') {
      renderParties();
    } else if (activeTab === 'fabric-orders') {
      renderFabricPipeline();
    } else if (activeTab === 'embroidery') {
      renderEmbroideryPipeline();
    } else if (activeTab === 'handwork') {
      renderHandworkPipeline();
    } else if (activeTab === 'stitching') {
      renderStitchingPipeline();
    }
  } catch (err) {
    console.error('Error refreshing:', err);
  } finally {
    if (loader) loader.style.display = 'none';
  }
}

/* ═══════════════════════════════════════════
   FORM HANDLING & CREATION CODE
   ═══════════════════════════════════════════ */
function sectionHeader(icon, label, color) {
  return '<div class="form-section-header" style="background:' + color + ';">' + icon + ' ' + label + '</div>';
}

function addDesign() {
  designCount++;
  var id = designCount;
  var container = document.getElementById('designs-container');

  var block = document.createElement('div');
  block.className = 'design-block';
  block.id = 'design-' + id;

  block.innerHTML =
    '<div class="design-top">' +
    '<div class="image-upload-box">' +
    '<label class="upload-label">Design Image</label>' +
    '<div class="drop-zone" id="dropzone-' + id + '"' +
    ' ondragover="handleDragOver(event,' + id + ')"' +
    ' ondragleave="handleDragLeave(event,' + id + ')"' +
    ' ondrop="handleDrop(event,' + id + ')">' +
    '<span class="drop-icon">&#x1F4F8;</span>' +
    '<span class="drop-text">Click or drag<br>image here</span>' +
    '<input type="file" accept="image/*" id="imgfile-' + id + '"' +
    ' onchange="handleImageSelect(this,' + id + ')" />' +
    '</div>' +
    '<button class="remove-img-btn" id="removeimg-' + id + '"' +
    ' onclick="removeImage(' + id + ')">&#x2715; Remove</button>' +
    '</div>' +

    '<div class="design-fields">' +
    '<div class="field-group">' +
    '<label>Order No.</label>' +
    '<input type="text" placeholder="Auto" id="orderno-' + id + '" readonly style="background:#f1f3f8;color:#e65100;font-weight:700;" />' +
    '</div>' +
    '<div class="field-group">' +
    '<label>D No (Design No.)</label>' +
    '<input type="text" placeholder="e.g. 3015" id="dno-' + id + '" />' +
    '</div>' +
    '<div class="field-group">' +
    '<label>Fabric Type</label>' +
    '<input type="text" placeholder="e.g. Semi Lachko" id="fabric-' + id + '" />' +
    '</div>' +
    '<div class="field-group">' +
    '<label>Order Date</label>' +
    '<input type="date" id="date-' + id + '" value="' + todayISO() + '" />' +
    '</div>' +
    '</div>' +
    (!currentEditId && id > 1 ? '<button class="remove-design-btn" onclick="removeDesign(' + id + ')">&#x1F5D1; Remove Design</button>' : '') +
    '</div>' +

    /* SECTION 1 — FABRIC ORDER DETAILS */
    sectionHeader('&#x1F9F5;', 'Fabric Order Details', 'var(--primary)') +
    '<div class="pipeline-box" style="border-color:var(--primary);">' +
    '<div style="display:flex;gap:16px;margin-bottom:12px;flex-wrap:wrap;">' +
    '<div class="field-group" style="flex:1;min-width:160px;">' +
    '<label>Party Name</label>' +
    '<input type="text" placeholder="Party name" id="fabric-party-' + id + '" list="fabric-parties-list" />' +
    '</div>' +
    '</div>' +
    '<div class="form-table-wrap">' +
    '<table id="fabric-table-' + id + '">' +
    '<thead><tr>' +
    '<th style="background:var(--primary);color:#fff">#</th>' +
    '<th style="background:var(--primary);color:#fff">Fabric Name</th>' +
    '<th style="background:var(--primary);color:#fff">Colour</th>' +
    '<th style="background:var(--primary);color:#fff">Work Fab</th>' +
    '<th style="background:var(--primary);color:#fff">Plain Fab</th>' +
    '<th style="background:var(--primary);color:#fff">Total Fab</th>' +
    '<th style="background:var(--primary);color:#fff">Received Fab</th>' +
    '<th style="background:var(--primary);color:#fff">Work Pcs</th>' +
    '<th style="background:var(--primary);color:#fff"></th>' +
    '</tr></thead>' +
    '<tbody id="fabric-tbody-' + id + '"></tbody>' +
    '</table>' +
    '</div>' +
    '<div class="btn-row">' +
    '<button class="btn-add-row btn-add-fabric" onclick="addFabricRow(' + id + ')">+ Add Fabric Row</button>' +
    '</div>' +
    '</div>' +

    /* SECTION 1.5 — HAND WORK PIPELINE */
    sectionHeader('&#x270B;', 'Hand Work Job Work', '#d81b60') +
    '<div class="pipeline-box" style="border-color:#d81b60;">' +
    '<div style="display:flex;gap:16px;margin-bottom:12px;flex-wrap:wrap;">' +
    '<div class="field-group" style="flex:1;min-width:160px;">' +
    '<label>Party Name</label>' +
    '<input type="text" placeholder="Party name" id="handwork-party-' + id + '" list="handwork-parties-list" />' +
    '</div>' +
    '<div class="field-group" style="flex:1;min-width:160px;">' +
    '<label>Sent Date</label>' +
    '<input type="date" id="handwork-date-' + id + '" />' +
    '</div>' +
    '</div>' +
    '<div class="form-table-wrap">' +
    '<table id="handwork-table-' + id + '">' +
    '<thead><tr>' +
    '<th style="background:#d81b60;color:#fff">#</th>' +
    '<th style="background:#d81b60;color:#fff">Colour</th>' +
    '<th style="background:#d81b60;color:#fff">Expected Pcs</th>' +
    '<th style="background:#d81b60;color:#fff">Received Pcs</th>' +
    '<th style="background:#d81b60;color:#fff"></th>' +
    '</tr></thead>' +
    '<tbody id="handwork-tbody-' + id + '"></tbody>' +
    '</table>' +
    '</div>' +
    '<div class="btn-row">' +
    '<button class="btn-add-row btn-add-handwork" style="background:#fce4ec;color:#c2185b;border-color:#f8bbd0;" onclick="addHandworkRow(' + id + ')">+ Add Hand Work Row</button>' +
    '</div>' +
    '</div>' +

    /* SECTION 2 — EMBROIDERY PIPELINE */
    sectionHeader('&#x1FAE7;', 'Embroidery Job Work', 'var(--secondary)') +
    '<div class="pipeline-box" style="border-color:var(--secondary);">' +
    '<div style="display:flex;gap:16px;margin-bottom:12px;flex-wrap:wrap;">' +
    '<div class="field-group" style="flex:1;min-width:160px;">' +
    '<label>Party Name</label>' +
    '<input type="text" placeholder="Party name" id="emb-party-' + id + '" list="embroidery-parties-list" />' +
    '</div>' +
    '<div class="field-group" style="flex:1;min-width:160px;">' +
    '<label>Date</label>' +
    '<input type="date" id="emb-date-' + id + '" />' +
    '</div>' +
    '</div>' +
    '<div class="form-table-wrap">' +
    '<table id="emb-table-' + id + '">' +
    '<thead>' +
    '<tr>' +
    '<th rowspan="2" style="background:var(--secondary);color:#fff">#</th>' +
    '<th colspan="3" style="background:var(--secondary-hover);color:#fff">Work Sent (meters)</th>' +
    '<th colspan="3" style="background:var(--secondary-hover);color:#fff">Work Returned (meters)</th>' +
    '<th rowspan="2" style="background:var(--secondary);color:#fff"></th>' +
    '</tr>' +
    '<tr>' +
    '<th style="background:#7b1fa2;color:#fff">Front</th>' +
    '<th style="background:#7b1fa2;color:#fff">Back</th>' +
    '<th style="background:#7b1fa2;color:#fff">Sleeve</th>' +
    '<th style="background:#7b1fa2;color:#fff">Front</th>' +
    '<th style="background:#7b1fa2;color:#fff">Back</th>' +
    '<th style="background:#7b1fa2;color:#fff">Sleeve</th>' +
    '</tr>' +
    '</thead>' +
    '<tbody id="emb-tbody-' + id + '"></tbody>' +
    '</table>' +
    '</div>' +
    '<div class="btn-row">' +
    '<button class="btn-add-row btn-add-emb" onclick="addEmbroideryRow(' + id + ')">+ Add Embroidery Row</button>' +
    '</div>' +
    '</div>' +

    /* SECTION 3 — STITCHING PIPELINE */
    sectionHeader('&#x2702;&#xFE0F;', 'Stitching Job Work', 'var(--teal)') +
    '<div class="pipeline-box" style="border-color:var(--teal);">' +
    '<div style="display:flex;gap:16px;margin-bottom:12px;flex-wrap:wrap;">' +
    '<div class="field-group" style="flex:1;min-width:160px;">' +
    '<label>Party Name</label>' +
    '<input type="text" placeholder="Party name" id="stitch-party-' + id + '" list="stitching-parties-list" />' +
    '</div>' +
    '<div class="field-group" style="flex:1;min-width:160px;">' +
    '<label>Sent Date</label>' +
    '<input type="date" id="stitch-date-' + id + '" />' +
    '</div>' +
    '</div>' +
    '<div class="form-table-wrap">' +
    '<table id="stitch-table-' + id + '">' +
    '<thead><tr>' +
    '<th style="background:var(--teal);color:#fff">#</th>' +
    '<th style="background:var(--teal);color:#fff">Expected Pcs</th>' +
    '<th style="background:var(--teal);color:#fff">Received Pcs</th>' +
    '<th style="background:var(--teal);color:#fff"></th>' +
    '</tr></thead>' +
    '<tbody id="stitch-tbody-' + id + '"></tbody>' +
    '</table>' +
    '</div>' +
    '<div class="btn-row">' +
    '<button class="btn-add-row btn-add-stitch" onclick="addStitchRow(' + id + ')">+ Add Stitch Row</button>' +
    '</div>' +
    '</div>';

  container.appendChild(block);

  // default rows in each section
  addFabricRow(id);
  addHandworkRow(id);
  addEmbroideryRow(id);
  addStitchRow(id);

  // If not edit mode and design Count > 1, scroll to it
  if (!currentEditId && id > 1) {
    block.scrollIntoView({ behavior: 'smooth' });
  }
}

function resetFormToNew() {
  currentEditId = null;
  document.getElementById('form-tab-title').textContent = 'Order Form';
  document.getElementById('edit-mode-banner').style.display = 'none';
  document.getElementById('btn-cancel-edit').style.display = 'none';
  document.getElementById('submit-btn').textContent = '✔ Submit Order';
  document.getElementById('submit-btn').style.background = '';
  document.getElementById('form-print-section').style.display = 'none';

  // Clear and add one blank design block
  var container = document.getElementById('designs-container');
  if (container) {
    container.innerHTML = '';
    designCount = 0;
    fabricCounters = {};
    embroideryCounters = {};
    stitchCounters = {};
    addDesign();

    // Add "Add Design Card" button at the bottom of designs container if not exists
    var addBtnExist = document.getElementById('btn-more-designs');
    if (addBtnExist) addBtnExist.remove();

    var addBtn = document.createElement('button');
    addBtn.id = 'btn-more-designs';
    addBtn.className = 'btn btn-outline';
    addBtn.style.margin = '20px auto';
    addBtn.style.display = 'block';
    addBtn.innerHTML = '&#x2795; Add Another Design Card';
    addBtn.onclick = addDesign;
    container.after(addBtn);
  }
}

function addFabricRow(designId) {
  if (!fabricCounters[designId]) fabricCounters[designId] = 0;
  fabricCounters[designId]++;
  var rowId = fabricCounters[designId];

  var tbody = document.getElementById('fabric-tbody-' + designId);
  var tr = document.createElement('tr');
  tr.id = 'fabric-row-' + designId + '-' + rowId;
  tr.innerHTML =
    '<td>' + rowId + '</td>' +
    '<td><input type="text" placeholder="Fabric name" /></td>' +
    '<td><input type="text" placeholder="Colour" /></td>' +
    '<td><input type="text" placeholder="Work Fab" /></td>' +
    '<td><input type="text" placeholder="Plain Fab" /></td>' +
    '<td><input type="text" placeholder="Total" /></td>' +
    '<td><input type="text" placeholder="Received" /></td>' +
    '<td><input type="text" placeholder="Work pcs" /></td>' +
    '<td><button class="remove-row-btn" onclick="removeRow(\'fabric-row-' + designId + '-' + rowId + '\')">&#x2715;</button></td>';
  tbody.appendChild(tr);
}

function addEmbroideryRow(designId) {
  if (!embroideryCounters[designId]) embroideryCounters[designId] = 0;
  embroideryCounters[designId]++;
  var rowId = embroideryCounters[designId];

  var tbody = document.getElementById('emb-tbody-' + designId);
  var tr = document.createElement('tr');
  tr.id = 'emb-row-' + designId + '-' + rowId;
  tr.innerHTML =
    '<td>' + rowId + '</td>' +
    '<td><input type="text" placeholder="Front m" /></td>' +
    '<td><input type="text" placeholder="Back m" /></td>' +
    '<td><input type="text" placeholder="Sleeve m" /></td>' +
    '<td><input type="text" placeholder="Front m" /></td>' +
    '<td><input type="text" placeholder="Back m" /></td>' +
    '<td><input type="text" placeholder="Sleeve m" /></td>' +
    '<td><button class="remove-row-btn" onclick="removeRow(\'emb-row-' + designId + '-' + rowId + '\')">&#x2715;</button></td>';
  tbody.appendChild(tr);
}

function addStitchRow(designId) {
  if (!stitchCounters[designId]) stitchCounters[designId] = 0;
  stitchCounters[designId]++;
  var rowId = stitchCounters[designId];

  var tbody = document.getElementById('stitch-tbody-' + designId);
  var tr = document.createElement('tr');
  tr.id = 'stitch-row-' + designId + '-' + rowId;
  tr.innerHTML =
    '<td>' + rowId + '</td>' +
    '<td><input type="text" placeholder="Expected" /></td>' +
    '<td><input type="text" placeholder="Received" /></td>' +
    '<td><button class="remove-row-btn" onclick="removeRow(\'stitch-row-' + designId + '-' + rowId + '\')">&#x2715;</button></td>';
  tbody.appendChild(tr);
}

function addHandworkRow(designId) {
  if (!handworkCounters[designId]) handworkCounters[designId] = 0;
  handworkCounters[designId]++;
  var rowId = handworkCounters[designId];

  var tbody = document.getElementById('handwork-tbody-' + designId);
  var tr = document.createElement('tr');
  tr.id = 'handwork-row-' + designId + '-' + rowId;
  tr.innerHTML =
    '<td>' + rowId + '</td>' +
    '<td><input type="text" placeholder="Colour" /></td>' +
    '<td><input type="text" placeholder="Expected" /></td>' +
    '<td><input type="text" placeholder="Received" /></td>' +
    '<td><button class="remove-row-btn" onclick="removeRow(\'handwork-row-' + designId + '-' + rowId + '\')">&#x2715;</button></td>';
  tbody.appendChild(tr);
}

function collectRows(blockId) {
  var fabricParty = document.getElementById('fabric-party-' + blockId) ? document.getElementById('fabric-party-' + blockId).value : '';
  var fabricRows = [];
  document.querySelectorAll('#fabric-tbody-' + blockId + ' tr').forEach(function (row) {
    var inp = row.querySelectorAll('input');
    if (fabricParty.trim()) {
      fabricRows.push({
        partyName: fabricParty,
        fabricName: inp[0] ? inp[0].value : '',
        colour: inp[1] ? inp[1].value : '',
        workFab: inp[2] ? inp[2].value : '',
        plainFab: inp[3] ? inp[3].value : '',
        totalFab: inp[4] ? inp[4].value : '',
        receivedFab: inp[5] ? inp[5].value : '',
        workPcs: inp[6] ? inp[6].value : ''
      });
    }
  });

  var handworkParty = document.getElementById('handwork-party-' + blockId) ? document.getElementById('handwork-party-' + blockId).value : '';
  var handworkDate = document.getElementById('handwork-date-' + blockId) ? document.getElementById('handwork-date-' + blockId).value : '';
  var handworkRows = [];
  document.querySelectorAll('#handwork-tbody-' + blockId + ' tr').forEach(function (row) {
    var inp = row.querySelectorAll('input');
    if (handworkParty.trim()) {
      handworkRows.push({
        partyName: handworkParty,
        sentDate: handworkDate,
        colour: inp[0] ? inp[0].value : '',
        expectedPcs: inp[1] ? inp[1].value : '',
        receivedPcs: inp[2] ? inp[2].value : ''
      });
    }
  });

  var embParty = document.getElementById('emb-party-' + blockId) ? document.getElementById('emb-party-' + blockId).value : '';
  var embDate = document.getElementById('emb-date-' + blockId) ? document.getElementById('emb-date-' + blockId).value : '';
  var embRows = [];
  document.querySelectorAll('#emb-tbody-' + blockId + ' tr').forEach(function (row) {
    var inp = row.querySelectorAll('input');
    if (embParty.trim()) {
      embRows.push({
        partyName: embParty,
        date: embDate,
        sentFront: inp[0] ? inp[0].value : '',
        sentBack: inp[1] ? inp[1].value : '',
        sentSleeve: inp[2] ? inp[2].value : '',
        returnFront: inp[3] ? inp[3].value : '',
        returnBack: inp[4] ? inp[4].value : '',
        returnSleeve: inp[5] ? inp[5].value : ''
      });
    }
  });

  var stitchParty = document.getElementById('stitch-party-' + blockId) ? document.getElementById('stitch-party-' + blockId).value : '';
  var stitchDate = document.getElementById('stitch-date-' + blockId) ? document.getElementById('stitch-date-' + blockId).value : '';
  var stitchRows = [];
  document.querySelectorAll('#stitch-tbody-' + blockId + ' tr').forEach(function (row) {
    var inp = row.querySelectorAll('input');
    if (stitchParty.trim()) {
      stitchRows.push({
        partyName: stitchParty,
        sentDate: stitchDate,
        expectedPcs: inp[0] ? inp[0].value : '',
        receivedPcs: inp[1] ? inp[1].value : ''
      });
    }
  });

  return { fabricRows: fabricRows, handworkRows: handworkRows, embRows: embRows, stitchRows: stitchRows };
}

function fillRows(blockId, data) {
  var fabricRows = data.fabricRows || [];
  var handworkRows = data.handworkRows || [];
  var embRows = data.embRows || [];
  var stitchRows = data.stitchRows || [];

  /* Fabric */
  document.getElementById('fabric-tbody-' + blockId).innerHTML = '';
  fabricCounters[blockId] = 0;
  if (fabricRows.length > 0) {
    var fp = document.getElementById('fabric-party-' + blockId);
    if (fp) fp.value = fabricRows[0].partyName || '';
  }
  fabricRows.forEach(function (r) {
    addFabricRow(blockId);
    var rowId = fabricCounters[blockId];
    var inp = document.getElementById('fabric-row-' + blockId + '-' + rowId).querySelectorAll('input');
    [r.fabricName, r.colour, r.workFab, r.plainFab, r.totalFab, r.receivedFab, r.workPcs]
      .forEach(function (v, i) { if (inp[i]) inp[i].value = v || ''; });
  });

  /* Hand Work */
  document.getElementById('handwork-tbody-' + blockId).innerHTML = '';
  handworkCounters[blockId] = 0;
  if (handworkRows.length > 0) {
    var hp = document.getElementById('handwork-party-' + blockId);
    var hd = document.getElementById('handwork-date-' + blockId);
    if (hp) hp.value = handworkRows[0].partyName || '';
    if (hd) hd.value = handworkRows[0].sentDate || '';
  }
  handworkRows.forEach(function (r) {
    addHandworkRow(blockId);
    var rowId = handworkCounters[blockId];
    var inp = document.getElementById('handwork-row-' + blockId + '-' + rowId).querySelectorAll('input');
    [r.colour, r.expectedPcs, r.receivedPcs]
      .forEach(function (v, i) { if (inp[i]) inp[i].value = v || ''; });
  });

  /* Embroidery */
  document.getElementById('emb-tbody-' + blockId).innerHTML = '';
  embroideryCounters[blockId] = 0;
  if (embRows.length > 0) {
    var ep = document.getElementById('emb-party-' + blockId);
    var ed = document.getElementById('emb-date-' + blockId);
    if (ep) ep.value = embRows[0].partyName || '';
    if (ed) ed.value = embRows[0].date || '';
  }
  embRows.forEach(function (r) {
    addEmbroideryRow(blockId);
    var rowId = embroideryCounters[blockId];
    var inp = document.getElementById('emb-row-' + blockId + '-' + rowId).querySelectorAll('input');
    [r.sentFront, r.sentBack, r.sentSleeve, r.returnFront, r.returnBack, r.returnSleeve]
      .forEach(function (v, i) { if (inp[i]) inp[i].value = v || ''; });
  });

  /* Stitching */
  document.getElementById('stitch-tbody-' + blockId).innerHTML = '';
  stitchCounters[blockId] = 0;
  if (stitchRows.length > 0) {
    var sp = document.getElementById('stitch-party-' + blockId);
    var sd = document.getElementById('stitch-date-' + blockId);
    if (sp) sp.value = stitchRows[0].partyName || '';
    if (sd) sd.value = stitchRows[0].sentDate || '';
  }
  stitchRows.forEach(function (r) {
    addStitchRow(blockId);
    var rowId = stitchCounters[blockId];
    var inp = document.getElementById('stitch-row-' + blockId + '-' + rowId).querySelectorAll('input');
    [r.expectedPcs, r.receivedPcs]
      .forEach(function (v, i) { if (inp[i]) inp[i].value = v || ''; });
  });
}

function removeRow(rowId) {
  var row = document.getElementById(rowId);
  if (row) row.remove();
}

function removeDesign(id) {
  var block = document.getElementById('design-' + id);
  if (block) block.remove();
}

/* ─────────────────────────────────────────
   SUBMIT FORM: CREATE / UPDATE
   ───────────────────────────────────────── */
async function submitForm() {
  var designs = document.querySelectorAll('.design-block');
  if (!designs.length) {
    alert('Please add at least one design before submitting.');
    return;
  }

  // Validate Design numbers
  var valid = true;
  designs.forEach(function (block) {
    var id = block.id.split('-')[1];
    var dno = document.getElementById('dno-' + id);
    if (!dno.value.trim()) {
      dno.style.borderColor = 'var(--danger)';
      valid = false;
    } else {
      dno.style.borderColor = '';
    }
  });
  if (!valid) { alert('Please fill in all Design Numbers.'); return; }

  var loader = document.getElementById('page-loader');
  if (loader) loader.style.display = 'flex';

  try {
    if (currentEditId) {
      // ── Update existing ──
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
        handworkRows: data.handworkRows,
        embRows: data.embRows,
        stitchRows: data.stitchRows
      };

      await updateOrder(currentEditId, updateData);
      showToast('&#x2714; Record updated successfully!');

      // Reset edit triggers and return to Dashboard
      cancelEdit();
    } else {
      // ── Save multiple new orders ──
      var all = await loadAllOrders();
      var maxOrderNo = 0;
      all.forEach(function (o) {
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
          handworkRows: data.handworkRows,
          embRows: data.embRows,
          stitchRows: data.stitchRows
        });
      }

      showToast('&#x2714; Orders saved successfully!');
      resetFormToNew();
      switchTab('dashboard');
    }
  } catch (err) {
    alert('Error saving order: ' + err.message);
    console.error(err);
  } finally {
    if (loader) loader.style.display = 'none';
  }
}

async function editRecord(recordId) {
  var loader = document.getElementById('page-loader');
  if (loader) loader.style.display = 'flex';

  try {
    var order = await loadOrder(recordId);

    // Setup tabs
    activeTab = 'new-order';

    document.querySelectorAll('.sidebar-nav .nav-item').forEach(function (btn) {
      btn.classList.remove('active');
    });
    var activeBtn = document.getElementById('nav-new-order');
    if (activeBtn) activeBtn.classList.add('active');

    document.querySelectorAll('.tab-content').forEach(function (section) {
      section.classList.remove('active');
    });
    var activeSection = document.getElementById('tab-new-order');
    if (activeSection) activeSection.classList.add('active');

    // Hide design card adder button in edit mode
    var addBtnExist = document.getElementById('btn-more-designs');
    if (addBtnExist) addBtnExist.remove();

    // Set headers
    document.getElementById('form-tab-title').textContent = 'Edit Order';
    document.getElementById('btn-cancel-edit').style.display = 'inline-block';
    document.getElementById('edit-mode-banner').style.display = 'block';
    document.getElementById('form-print-section').style.display = 'block';

    var btnSubmit = document.getElementById('submit-btn');
    btnSubmit.textContent = '✔ Update Record';
    btnSubmit.style.background = 'var(--warning)';

    currentEditId = recordId;

    // Reset design container
    document.getElementById('designs-container').innerHTML = '';
    designCount = 0;
    fabricCounters = {};
    embroideryCounters = {};
    stitchCounters = {};

    addDesign();
    var blockId = designCount;

    // Fill header fields
    document.getElementById('orderno-' + blockId).value = order.orderNo || '—';
    document.getElementById('dno-' + blockId).value = order.dNo || '';
    document.getElementById('fabric-' + blockId).value = order.fabric || '';
    document.getElementById('date-' + blockId).value = order.date || '';

    if (order.image) {
      setDropZoneImage(blockId, order.image);
    }

    fillRows(blockId, {
      fabricRows: order.fabricRows || [],
      embRows: order.embRows || [],
      stitchRows: order.stitchRows || []
    });

    window.scrollTo({ top: 0, behavior: 'smooth' });
  } catch (e) {
    console.error('Edit record error:', e);
    alert('Error loading record: ' + e.message);
  } finally {
    if (loader) loader.style.display = 'none';
  }
}

function cancelEdit() {
  resetFormToNew();
  switchTab('dashboard');
}

/* ─────────────────────────────────────────
   IMAGE CROPPING & PREVIEW
   ───────────────────────────────────────── */
var _cropState = { id: null, img: null, startX: 0, startY: 0, endX: 0, endY: 0, dragging: false };

function handleImageSelect(input, id) {
  if (input.files && input.files[0]) openCropEditor(input.files[0], id);
}

function handleDragOver(e, id) {
  e.preventDefault();
  document.getElementById('dropzone-' + id).classList.add('dragover');
}

function handleDragLeave(e, id) {
  document.getElementById('dropzone-' + id).classList.remove('dragover');
}

function handleDrop(e, id) {
  e.preventDefault();
  document.getElementById('dropzone-' + id).classList.remove('dragover');
  var file = e.dataTransfer.files[0];
  if (file && file.type.startsWith('image/')) openCropEditor(file, id);
}

function openCropEditor(file, id) {
  var reader = new FileReader();
  reader.onload = function (evt) {
    var img = new Image();
    img.onload = function () {
      _cropState.id = id;
      _cropState.img = img;
      showCropModal(img);
    };
    img.src = evt.target.result;
  };
  reader.readAsDataURL(file);
}

function showCropModal(img) {
  var modal = document.getElementById('crop-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'crop-modal';
    modal.innerHTML =
      '<div class="crop-overlay">' +
      '<div class="crop-container">' +
      '<h3 style="margin:0 0 10px;color:#1a237e;text-align:center;">Crop Image</h3>' +
      '<div class="crop-canvas-wrap">' +
      '<canvas id="crop-canvas"></canvas>' +
      '<div id="crop-selection"></div>' +
      '</div>' +
      '<div style="display:flex;gap:10px;justify-content:center;margin-top:14px;flex-wrap:wrap;">' +
      '<button class="crop-btn crop-btn-ok" onclick="applyCrop()">&#x2714; Crop & Use</button>' +
      '<button class="crop-btn crop-btn-full" onclick="useFullImage()">&#x1F5BC; Use Full Image</button>' +
      '<button class="crop-btn crop-btn-cancel" onclick="closeCropModal()">&#x2715; Cancel</button>' +
      '</div>' +
      '</div>' +
      '</div>';
    document.body.appendChild(modal);

    var style = document.createElement('style');
    style.textContent =
      '.crop-overlay{position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.7);z-index:10000;display:flex;align-items:center;justify-content:center;}' +
      '.crop-container{background:#fff;border-radius:12px;padding:20px;max-width:90vw;max-height:90vh;box-shadow:0 8px 32px rgba(0,0,0,0.3);overflow:auto;}' +
      '.crop-canvas-wrap{position:relative;display:inline-block;cursor:crosshair;border:2px solid #ccc;border-radius:6px;overflow:hidden;line-height:0;}' +
      '#crop-canvas{display:block;}' +
      '#crop-selection{position:absolute;border:2px dashed #e65100;background:rgba(230,81,0,0.15);display:none;pointer-events:none;border-radius:2px;}' +
      '.crop-btn{border:none;border-radius:8px;padding:10px 20px;font-size:0.9rem;font-weight:600;cursor:pointer;}' +
      '.crop-btn-ok{background:#2e7d32;color:#fff;}' +
      '.crop-btn-ok:hover{background:#1b5e20;}' +
      '.crop-btn-full{background:#3949ab;color:#fff;}' +
      '.crop-btn-full:hover{background:#283593;}' +
      '.crop-btn-cancel{background:#757575;color:#fff;}' +
      '.crop-btn-cancel:hover{background:#424242;}';
    document.head.appendChild(style);
  }

  modal.style.display = 'block';

  var canvas = document.getElementById('crop-canvas');
  var ctx = canvas.getContext('2d');

  var maxW = Math.min(window.innerWidth * 0.7, 600);
  var maxH = Math.min(window.innerHeight * 0.55, 500);
  var scale = Math.min(maxW / img.width, maxH / img.height, 1);
  var displayW = Math.round(img.width * scale);
  var displayH = Math.round(img.height * scale);

  canvas.width = displayW;
  canvas.height = displayH;
  canvas.style.width = displayW + 'px';
  canvas.style.height = displayH + 'px';
  ctx.drawImage(img, 0, 0, displayW, displayH);

  _cropState.scaleToOriginal = img.width / displayW;
  _cropState.displayW = displayW;
  _cropState.displayH = displayH;

  var sel = document.getElementById('crop-selection');
  sel.style.display = 'none';
  _cropState.startX = 0;
  _cropState.startY = 0;
  _cropState.endX = displayW;
  _cropState.endY = displayH;
  _cropState.dragging = false;

  var wrap = canvas.parentElement;
  wrap.onmousedown = function (e) {
    var rect = canvas.getBoundingClientRect();
    _cropState.startX = e.clientX - rect.left;
    _cropState.startY = e.clientY - rect.top;
    _cropState.dragging = true;
    sel.style.display = 'block';
    sel.style.left = _cropState.startX + 'px';
    sel.style.top = _cropState.startY + 'px';
    sel.style.width = '0px';
    sel.style.height = '0px';
  };
  wrap.onmousemove = function (e) {
    if (!_cropState.dragging) return;
    var rect = canvas.getBoundingClientRect();
    _cropState.endX = Math.min(Math.max(e.clientX - rect.left, 0), displayW);
    _cropState.endY = Math.min(Math.max(e.clientY - rect.top, 0), displayH);
    var x = Math.min(_cropState.startX, _cropState.endX);
    var y = Math.min(_cropState.startY, _cropState.endY);
    var w = Math.abs(_cropState.endX - _cropState.startX);
    var h = Math.abs(_cropState.endY - _cropState.startY);
    sel.style.left = x + 'px';
    sel.style.top = y + 'px';
    sel.style.width = w + 'px';
    sel.style.height = h + 'px';
  };
  wrap.onmouseup = function () { _cropState.dragging = false; };

  wrap.ontouchstart = function (e) {
    var touch = e.touches[0];
    var rect = canvas.getBoundingClientRect();
    _cropState.startX = touch.clientX - rect.left;
    _cropState.startY = touch.clientY - rect.top;
    _cropState.dragging = true;
    sel.style.display = 'block';
    sel.style.left = _cropState.startX + 'px';
    sel.style.top = _cropState.startY + 'px';
    sel.style.width = '0px';
    sel.style.height = '0px';
    e.preventDefault();
  };
  wrap.ontouchmove = function (e) {
    if (!_cropState.dragging) return;
    var touch = e.touches[0];
    var rect = canvas.getBoundingClientRect();
    _cropState.endX = Math.min(Math.max(touch.clientX - rect.left, 0), displayW);
    _cropState.endY = Math.min(Math.max(touch.clientY - rect.top, 0), displayH);
    var x = Math.min(_cropState.startX, _cropState.endX);
    var y = Math.min(_cropState.startY, _cropState.endY);
    var w = Math.abs(_cropState.endX - _cropState.startX);
    var h = Math.abs(_cropState.endY - _cropState.startY);
    sel.style.left = x + 'px';
    sel.style.top = y + 'px';
    sel.style.width = w + 'px';
    sel.style.height = h + 'px';
    e.preventDefault();
  };
  wrap.ontouchend = function () { _cropState.dragging = false; };
}

function applyCrop() {
  var img = _cropState.img;
  var s = _cropState.scaleToOriginal;

  var x = Math.round(Math.min(_cropState.startX, _cropState.endX) * s);
  var y = Math.round(Math.min(_cropState.startY, _cropState.endY) * s);
  var w = Math.round(Math.abs(_cropState.endX - _cropState.startX) * s);
  var h = Math.round(Math.abs(_cropState.endY - _cropState.startY) * s);

  if (w < 10 || h < 10) {
    useFullImage();
    return;
  }

  var cropCanvas = document.createElement('canvas');
  cropCanvas.width = w;
  cropCanvas.height = h;
  cropCanvas.getContext('2d').drawImage(img, x, y, w, h, 0, 0, w, h);

  var dataUrl = cropCanvas.toDataURL('image/png');
  setDropZoneImage(_cropState.id, dataUrl);
  closeCropModal();
}

function useFullImage() {
  var canvas = document.createElement('canvas');
  var img = _cropState.img;
  canvas.width = img.width;
  canvas.height = img.height;
  canvas.getContext('2d').drawImage(img, 0, 0);
  var dataUrl = canvas.toDataURL('image/png');
  setDropZoneImage(_cropState.id, dataUrl);
  closeCropModal();
}

function closeCropModal() {
  var modal = document.getElementById('crop-modal');
  if (modal) modal.style.display = 'none';
  _cropState.id = null;
  _cropState.img = null;
}

function setDropZoneImage(id, src) {
  var zone = document.getElementById('dropzone-' + id);
  var existing = zone.querySelector('img.preview-img');
  if (existing) existing.remove();
  zone.querySelector('.drop-icon').style.display = 'none';
  zone.querySelector('.drop-text').style.display = 'none';
  var img = document.createElement('img');
  img.src = src;
  img.className = 'preview-img';
  img.alt = 'Design Image';
  img.style.cursor = 'pointer';
  img.title = 'Click to preview';
  img.onclick = function (e) { e.stopPropagation(); showImagePreview(src); };
  zone.appendChild(img);
  document.getElementById('removeimg-' + id).style.display = 'inline-block';
}

function showImagePreview(src) {
  var modal = document.getElementById('img-preview-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'img-preview-modal';
    modal.innerHTML =
      '<div style="position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.85);z-index:10001;display:flex;align-items:center;justify-content:center;cursor:pointer;" onclick="closeImagePreview()">' +
      '<img id="img-preview-full" style="max-width:90vw;max-height:90vh;border-radius:10px;box-shadow:0 4px 24px rgba(0,0,0,0.5);" />' +
      '<div style="position:absolute;top:20px;right:30px;color:#fff;font-size:2rem;font-weight:700;cursor:pointer;" onclick="closeImagePreview()">&#x2715;</div>' +
      '</div>';
    document.body.appendChild(modal);
  }
  document.getElementById('img-preview-full').src = src;
  modal.style.display = 'block';
}

function closeImagePreview() {
  var modal = document.getElementById('img-preview-modal');
  if (modal) modal.style.display = 'none';
}

function removeImage(id) {
  var zone = document.getElementById('dropzone-' + id);
  var img = zone.querySelector('img.preview-img');
  if (img) img.remove();
  zone.querySelector('.drop-icon').style.display = '';
  zone.querySelector('.drop-text').style.display = '';
  document.getElementById('imgfile-' + id).value = '';
  document.getElementById('removeimg-' + id).style.display = 'none';
}

/* ─────────────────────────────────────────
   UTILITIES
   ───────────────────────────────────────── */
function todayISO() {
  return new Date().toISOString().split('T')[0];
}

function escHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function showToast(msg, color) {
  var t = document.getElementById('toast');
  t.innerHTML = msg;
  t.style.background = color || 'var(--success)';
  t.style.display = 'flex';
  t.className = color ? 'danger' : 'success';
  setTimeout(function () { t.style.display = 'none'; }, 3000);
}

function filterFabricPartyRows() {
  var orderVal = document.getElementById('fab-filter-orderno').value.trim().toLowerCase();
  var dnoVal = document.getElementById('fab-filter-dno').value.trim().toLowerCase();

  document.querySelectorAll('#fabric-detail-container tbody tr').forEach(function (row) {
    // skip the filter input row if it has class 'filter-row'
    if (row.classList.contains('filter-row')) return;
    var orderTd = row.cells[0].textContent.toLowerCase();
    var dnoTd = row.cells[1].textContent.toLowerCase();

    var matchesOrder = !orderVal || orderTd.indexOf(orderVal) !== -1;
    var matchesDno = !dnoVal || dnoTd.indexOf(dnoVal) !== -1;

    row.style.display = (matchesOrder && matchesDno) ? '' : 'none';
  });
}

function filterEmbroideryPartyRows() {
  var orderVal = document.getElementById('emb-filter-orderno').value.trim().toLowerCase();
  var dnoVal = document.getElementById('emb-filter-dno').value.trim().toLowerCase();

  document.querySelectorAll('#embroidery-detail-container tbody tr').forEach(function (row) {
    if (row.classList.contains('filter-row')) return;
    var orderTd = row.cells[0].textContent.toLowerCase();
    var dnoTd = row.cells[1].textContent.toLowerCase();

    var matchesOrder = !orderVal || orderTd.indexOf(orderVal) !== -1;
    var matchesDno = !dnoVal || dnoTd.indexOf(dnoVal) !== -1;

    row.style.display = (matchesOrder && matchesDno) ? '' : 'none';
  });
}

function filterStitchingPartyRows() {
  var orderVal = document.getElementById('stitch-filter-orderno').value.trim().toLowerCase();
  var dnoVal = document.getElementById('stitch-filter-dno').value.trim().toLowerCase();

  document.querySelectorAll('#stitching-detail-container tbody tr').forEach(function (row) {
    if (row.classList.contains('filter-row')) return;
    var orderTd = row.cells[0].textContent.toLowerCase();
    var dnoTd = row.cells[1].textContent.toLowerCase();

    var matchesOrder = !orderVal || orderTd.indexOf(orderVal) !== -1;
    var matchesDno = !dnoVal || dnoTd.indexOf(dnoVal) !== -1;

    row.style.display = (matchesOrder && matchesDno) ? '' : 'none';
  });
}

function renderHandworkPipeline() {
  var rows = getHandworkPipeline(cachedOrders);
  var parties = rows.map(function (r) { return r.partyName; })
    .filter(function (v, i, a) { return v && a.indexOf(v) === i; })
    .sort();
  renderHandworkParties(parties, rows);
}

function renderHandworkParties(parties, allRows) {
  var masterContainer = document.getElementById('handwork-master-list');
  var detailContainer = document.getElementById('handwork-detail-container');

  if (!parties.length) {
    masterContainer.innerHTML = '<div style="text-align:center;padding:30px;color:#888;font-size:0.88rem;">No hand work parties found.</div>';
    detailContainer.innerHTML = '<div class="detail-view-empty"><span>&#x1F4CB;</span>Select a party to view details</div>';
    return;
  }

  masterContainer.innerHTML = parties.map(function (party) {
    var partyRows = allRows.filter(function (r) { return r.partyName === party; });
    var expected = partyRows.reduce(function (acc, r) { return acc + (parseFloat(r.expectedPcs) || 0); }, 0);
    var received = partyRows.reduce(function (acc, r) { return acc + (parseFloat(r.receivedPcs) || 0); }, 0);
    var balance = expected - received;
    var pct = expected > 0 ? Math.round((received / expected) * 100) : 0;
    var rowId = 'handwork-party-row-' + party.replace(/\s+/g, '_');

    return '<div class="master-row-item" id="' + rowId + '" onclick="selectHandworkParty(\'' + escHtml(party) + '\')">' +
      '<div class="master-row-top">' +
      '<span class="master-row-dno">' + escHtml(party) + '</span>' +
      '</div>' +
      '<div class="master-row-bottom" style="font-size:0.75rem;color:#d81b60;margin-top:2px;">' +
      '<span>Jobs: ' + partyRows.length + ' | Progress: ' + pct + '%</span>' +
      '</div>' +
      '</div>';
  }).join('');

  var selectedInResults = parties.find(function (p) { return p === selectedHandworkParty; });
  if (selectedInResults) {
    selectHandworkParty(selectedHandworkParty);
  } else {
    selectHandworkParty(parties[0]);
  }
}

function selectHandworkParty(partyName) {
  selectedHandworkParty = partyName;
  document.querySelectorAll('#handwork-master-list .master-row-item').forEach(function (row) {
    row.classList.remove('active');
  });
  var rowId = 'handwork-party-row-' + partyName.replace(/\s+/g, '_');
  var activeRow = document.getElementById(rowId);
  if (activeRow) activeRow.classList.add('active');

  var allRows = getHandworkPipeline(cachedOrders);
  var partyRows = allRows.filter(function (r) { return r.partyName === partyName; });
  var detailContainer = document.getElementById('handwork-detail-container');

  if (!partyRows.length) {
    detailContainer.innerHTML = '<div class="detail-view-empty"><span>&#x1F4CB;</span>Select a party to view details</div>';
    return;
  }

  var tableRowsHtml = partyRows.map(function (r, idx) {
    return '<tr>' +
      '<td>' + escHtml(r.orderNo) + '</td>' +
      '<td>' + escHtml(r.dNo) + '</td>' +
      '<td>' + escHtml(r.sentDate) + '</td>' +
      '<td>' + escHtml(r.colour) + '</td>' +
      '<td>' + escHtml(r.expectedPcs) + ' pcs</td>' +
      '<td>' + escHtml(r.receivedPcs) + ' pcs</td>' +
      '<td>' + r.balance + ' pcs</td>' +
      '<td>' +
      '<div style="display:flex;gap:4px;">' +
      '<button class="btn btn-outline btn-sm" onclick="printOrderSlip(\'' + r.orderId + '\', \'handwork\')" style="padding:4px 8px;font-size:0.75rem;">Print</button>' +
      '<button class="btn btn-primary btn-sm" onclick="viewOrderInDashboard(\'' + r.orderId + '\')" style="padding:4px 8px;font-size:0.75rem;">Order</button>' +
      '</div>' +
      '</td>' +
      '</tr>';
  }).join('');

  detailContainer.innerHTML =
    '<div class="detail-header">' +
    '<div class="detail-title-group">' +
    '<span class="detail-orderno">' + escHtml(partyName) + '</span>' +
    '<span class="detail-meta">Hand Work Progress Registry Summary</span>' +
    '</div>' +
    '</div>' +
    '<div class="detail-body">' +
    '<div class="table-card">' +
    '<div class="table-wrap">' +
    '<table>' +
    '<thead>' +
    '<tr>' +
    '<th style="background:#d81b60;color:#fff">Order No</th>' +
    '<th style="background:#d81b60;color:#fff">Design No</th>' +
    '<th style="background:#d81b60;color:#fff">Sent Date</th>' +
    '<th style="background:#d81b60;color:#fff">Colour</th>' +
    '<th style="background:#d81b60;color:#fff">Expected Pcs</th>' +
    '<th style="background:#d81b60;color:#fff">Received Pcs</th>' +
    '<th style="background:#d81b60;color:#fff">Balance</th>' +
    '<th style="background:#d81b60;color:#fff">Actions</th>' +
    '</tr>' +
    '<tr class="filter-row">' +
    '<th><input type="text" id="handwork-filter-orderno" placeholder="Filter..." oninput="filterHandworkPartyRows()" style="width:100%;box-sizing:border-box;padding:4px 6px;font-size:0.75rem;border:1px solid #ccc;border-radius:4px;font-weight:normal;color:#333;" /></th>' +
    '<th><input type="text" id="handwork-filter-dno" placeholder="Filter..." oninput="filterHandworkPartyRows()" style="width:100%;box-sizing:border-box;padding:4px 6px;font-size:0.75rem;border:1px solid #ccc;border-radius:4px;font-weight:normal;color:#333;" /></th>' +
    '<th></th><th></th><th></th><th></th><th></th><th></th>' +
    '</tr>' +
    '</thead>' +
    '<tbody>' + tableRowsHtml + '</tbody>' +
    '</table>' +
    '</div>' +
    '</div>' +
    '</div>';
}

function filterHandworkTable() {
  var q = document.getElementById('search-handwork').value.trim().toLowerCase();
  var rows = getHandworkPipeline(cachedOrders);
  var parties = rows.map(function (r) { return r.partyName; })
    .filter(function (v, i, a) { return v && a.indexOf(v) === i; });

  if (q) {
    parties = parties.filter(function (name) {
      return name.toLowerCase().indexOf(q) !== -1;
    });
  }
  parties.sort();
  renderHandworkParties(parties, rows);
}

function filterHandworkPartyRows() {
  var orderVal = document.getElementById('handwork-filter-orderno').value.trim().toLowerCase();
  var dnoVal = document.getElementById('handwork-filter-dno').value.trim().toLowerCase();

  document.querySelectorAll('#handwork-detail-container tbody tr').forEach(function (row) {
    if (row.classList.contains('filter-row')) return;
    var orderTd = row.cells[0].textContent.toLowerCase();
    var dnoTd = row.cells[1].textContent.toLowerCase();

    var matchesOrder = !orderVal || orderTd.indexOf(orderVal) !== -1;
    var matchesDno = !dnoVal || dnoTd.indexOf(dnoVal) !== -1;

    row.style.display = (matchesOrder && matchesDno) ? '' : 'none';
  });
}

/* ─────────────────────────────────────────
   SPA BOOTSTRAPPER
   ───────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', async function () {
  await refreshActiveView();

  // Clean up any initial page loader
  var loader = document.getElementById('page-loader');
  if (loader) loader.classList.add('hidden');
});

/* ═══════════════════════════════════════════════════════════════
   READY ORDER FORM
   — Two fabric sections (Work Fabric + Plain) sharing one party
   — One stitching section same as pipeline
   ═══════════════════════════════════════════════════════════════ */
var readyDesignCount = 0;
var readyFabricCounters = {};
var readyStitchCounters = {};

function resetReadyForm() {
  var container = document.getElementById('ready-order-container');
  if (!container) return;
  container.innerHTML = '';
  readyDesignCount = 0;
  readyFabricCounters = {};
  readyStitchCounters = {};
  addReadyDesign();

  // "Add another design" button
  var addBtnId = 'btn-more-ready-designs';
  var existing = document.getElementById(addBtnId);
  if (existing) existing.remove();

  var addBtn = document.createElement('button');
  addBtn.id = addBtnId;
  addBtn.className = 'btn btn-outline';
  addBtn.style.margin = '20px auto';
  addBtn.style.display = 'block';
  addBtn.innerHTML = '&#x2795; Add Another Design Card';
  addBtn.onclick = addReadyDesign;
  container.after(addBtn);
}

function addReadyDesign() {
  readyDesignCount++;
  var id = readyDesignCount;
  var container = document.getElementById('ready-order-container');

  var block = document.createElement('div');
  block.className = 'design-block';
  block.id = 'ready-design-' + id;

  block.innerHTML =
    /* ── Header row (image + basic fields) ── */
    '<div class="design-top">' +
    '<div class="image-upload-box">' +
    '<label class="upload-label">Design Image</label>' +
    '<div class="drop-zone" id="rdropzone-' + id + '"' +
    ' ondragover="handleDragOver(event,' + id + ')"' +
    ' ondragleave="handleDragLeave(event,' + id + ')"' +
    ' ondrop="handleDrop(event,' + id + ')">' +
    '<span class="drop-icon">&#x1F4F8;</span>' +
    '<span class="drop-text">Click or drag<br>image here</span>' +
    '<input type="file" accept="image/*" id="rimgfile-' + id + '"' +
    ' onchange="handleImageSelect(this,' + id + ')" />' +
    '</div>' +
    '<button class="remove-img-btn" id="rremoveimg-' + id + '"' +
    ' onclick="removeImage(' + id + ')">&#x2715; Remove</button>' +
    '</div>' +

    '<div class="design-fields">' +
    '<div class="field-group">' +
    '<label>Order No.</label>' +
    '<input type="text" placeholder="Auto" id="r-orderno-' + id + '" readonly style="background:#f1f3f8;color:#e65100;font-weight:700;" />' +
    '</div>' +
    '<div class="field-group">' +
    '<label>D No (Design No.)</label>' +
    '<input type="text" placeholder="e.g. 3015" id="r-dno-' + id + '" />' +
    '</div>' +
    '<div class="field-group">' +
    '<label>Fabric Type</label>' +
    '<input type="text" placeholder="e.g. Semi Lachko" id="r-fabric-' + id + '" />' +
    '</div>' +
    '<div class="field-group">' +
    '<label>Order Date</label>' +
    '<input type="date" id="r-date-' + id + '" value="' + todayISO() + '" />' +
    '</div>' +
    '</div>' +
    (readyDesignCount > 1
      ? '<button class="remove-design-btn" onclick="removeReadyDesign(' + id + ')">&#x1F5D1; Remove Design</button>'
      : '') +
    '</div>' +


    /* ── Fabric Party Name ── */
    '<div style="display:flex;gap:16px;margin:12px 0;flex-wrap:wrap;">' +
    '<div class="field-group" style="flex:1;min-width:200px;">' +
    '<label>Fabric Party Name</label>' +
    '<input type="text" placeholder="Fabric party name" id="r-party-' + id + '" list="fabric-parties-list" />' +
    '</div>' +
    '</div>' +

    /* ── SECTION A: Fabric Details ── */
    sectionHeader('&#x1F9F5;', 'Fabric Details', 'var(--primary)') +
    '<div class="pipeline-box" style="border-color:var(--primary);">' +
    '<div class="form-table-wrap">' +
    '<table id="r-fab-table-' + id + '">' +
    '<thead><tr>' +
    '<th style="background:var(--primary);color:#fff">#</th>' +
    '<th style="background:var(--primary);color:#fff">Color</th>' +
    '<th style="background:var(--primary);color:#fff">Work Fabric</th>' +
    '<th style="background:var(--primary);color:#fff">Plain Fabric</th>' +
    '<th style="background:var(--primary);color:#fff">Expected Pcs</th>' +
    '<th style="background:var(--primary);color:#fff">Received</th>' +
    '<th style="background:var(--primary);color:#fff"></th>' +
    '</tr></thead>' +
    '<tbody id="r-fab-tbody-' + id + '"></tbody>' +
    '</table>' +
    '</div>' +
    '<div class="btn-row">' +
    '<button class="btn-add-row btn-add-fabric" onclick="addReadyFabricRow(' + id + ')">+ Add Row</button>' +
    '</div>' +
    '</div>' +

    /* ── SECTION C: Stitching ── */
    sectionHeader('&#x2702;&#xFE0F;', 'Stitching', 'var(--teal)') +
    '<div class="pipeline-box" style="border-color:var(--teal);">' +
    '<div style="display:flex;gap:16px;margin-bottom:12px;flex-wrap:wrap;">' +
    '<div class="field-group" style="flex:1;min-width:200px;">' +
    '<label>Stitching Party Name</label>' +
    '<input type="text" placeholder="Stitching party name" id="r-stitch-party-' + id + '" list="stitching-parties-list" />' +
    '</div>' +
    '<div class="field-group" style="flex:1;min-width:160px;">' +
    '<label>Sent Date</label>' +
    '<input type="date" id="r-stitch-date-' + id + '" />' +
    '</div>' +
    '</div>' +
    '<div class="form-table-wrap">' +
    '<table id="r-stitch-table-' + id + '">' +
    '<thead><tr>' +
    '<th style="background:var(--teal);color:#fff">#</th>' +
    '<th style="background:var(--teal);color:#fff">Expected Pcs</th>' +
    '<th style="background:var(--teal);color:#fff">Received Pcs</th>' +
    '<th style="background:var(--teal);color:#fff"></th>' +
    '</tr></thead>' +
    '<tbody id="r-stitch-tbody-' + id + '"></tbody>' +
    '</table>' +
    '</div>' +
    '<div class="btn-row">' +
    '<button class="btn-add-row btn-add-stitch" onclick="addReadyStitchRow(' + id + ')">+ Add Stitch Row</button>' +
    '</div>' +
    '</div>';

  container.appendChild(block);

  // Default one row per section
  addReadyFabricRow(id);
  addReadyStitchRow(id);

  if (readyDesignCount > 1) block.scrollIntoView({ behavior: 'smooth' });
}

/* ── Row adders ── */
function addReadyFabricRow(designId) {
  if (!readyFabricCounters[designId]) readyFabricCounters[designId] = 0;
  readyFabricCounters[designId]++;
  var rowId = readyFabricCounters[designId];
  var tbody = document.getElementById('r-fab-tbody-' + designId);
  var tr = document.createElement('tr');
  tr.id = 'r-fab-row-' + designId + '-' + rowId;
  tr.innerHTML =
    '<td>' + rowId + '</td>' +
    '<td><input type="text" placeholder="Color" /></td>' +
    '<td><input type="text" placeholder="Work Fabric" /></td>' +
    '<td><input type="text" placeholder="Plain Fabric" /></td>' +
    '<td><input type="text" placeholder="Expected Pcs" /></td>' +
    '<td>' +
    '<select>' +
    '<option value=""></option>' +
    '<option value="Yes">Yes</option>' +
    '<option value="No">No</option>' +
    '</select>' +
    '</td>' +
    '<td><button class="remove-row-btn" onclick="removeRow(\'r-fab-row-' + designId + '-' + rowId + '\')">&#x2715;</button></td>';
  tbody.appendChild(tr);
}

function addReadyStitchRow(designId) {
  if (!readyStitchCounters[designId]) readyStitchCounters[designId] = 0;
  readyStitchCounters[designId]++;
  var rowId = readyStitchCounters[designId];
  var tbody = document.getElementById('r-stitch-tbody-' + designId);
  var tr = document.createElement('tr');
  tr.id = 'r-stitch-row-' + designId + '-' + rowId;
  tr.innerHTML =
    '<td>' + rowId + '</td>' +
    '<td><input type="text" placeholder="Expected" /></td>' +
    '<td><input type="text" placeholder="Received" /></td>' +
    '<td><button class="remove-row-btn" onclick="removeRow(\'r-stitch-row-' + designId + '-' + rowId + '\')">&#x2715;</button></td>';
  tbody.appendChild(tr);
}

function removeReadyDesign(id) {
  var block = document.getElementById('ready-design-' + id);
  if (block) block.remove();
}

/* ── Collect & Submit ── */
function collectReadyDesigns() {
  var designs = [];
  document.querySelectorAll('#ready-order-container .design-block').forEach(function (block) {
    var id = block.id.replace('ready-design-', '');

    var partyName = val('r-party-' + id);
    var dNo = val('r-dno-' + id);
    var fabric = val('r-fabric-' + id);
    var date = val('r-date-' + id);

    var fabricRows = [];
    document.querySelectorAll('#r-fab-tbody-' + id + ' tr').forEach(function (row) {
      var inputs = row.querySelectorAll('input');
      var select = row.querySelector('select');
      fabricRows.push({
        colour: inputs[0] ? inputs[0].value.trim() : '',
        workFab: inputs[1] ? inputs[1].value.trim() : '',
        plainFab: inputs[2] ? inputs[2].value.trim() : '',
        totalFab: inputs[3] ? inputs[3].value.trim() : '',
        receivedFab: select ? select.value : ''
      });
    });

    var stitchParty = val('r-stitch-party-' + id);
    var stitchDate = val('r-stitch-date-' + id);
    var stitchRows = [];
    document.querySelectorAll('#r-stitch-tbody-' + id + ' tr').forEach(function (row) {
      var inp = row.querySelectorAll('input');
      stitchRows.push({ partyName: stitchParty, sentDate: stitchDate, expectedPcs: inp[0] ? inp[0].value : '', receivedPcs: inp[1] ? inp[1].value : '' });
    });

    designs.push({ partyName: partyName, stitchParty: stitchParty, dNo: dNo, fabric: fabric, date: date, fabricRows: fabricRows, stitchRows: stitchRows });
  });
  return designs;
}

function val(id) {
  var el = document.getElementById(id);
  return el ? el.value.trim() : '';
}

async function submitReadyOrder() {
  var designs = collectReadyDesigns();
  if (!designs.length || !designs[0].partyName) {
    alert('Please enter at least a Party Name before submitting.');
    return;
  }

  try {
    var all = await loadAllOrders();
    var maxOrderNo = 0;
    all.forEach(function (o) {
      var num = parseInt(o.orderNo) || 0;
      if (num > maxOrderNo) maxOrderNo = num;
    });

    for (var i = 0; i < designs.length; i++) {
      maxOrderNo++;
      var d = designs[i];
      var record = {
        orderNo: maxOrderNo,
        dNo: d.dNo,
        fabric: d.fabric,
        date: d.date,
        type: 'ready',
        fabricRows: d.fabricRows.map(function (r) {
          return {
            partyName: d.partyName,
            fabricName: d.fabric || 'Ready',
            colour: r.colour,
            workFab: r.workFab,
            plainFab: r.plainFab,
            totalFab: r.totalFab,
            receivedFab: r.receivedFab,
            workPcs: ''
          };
        }),
        stitchRows: d.stitchRows,
        embRows: [],
        savedAt: new Date().toISOString()
      };
      await saveOrder(record);
    }
    showToast('&#x2705; Ready Order submitted!', 'var(--success)');
    resetReadyForm();
    switchTab('dashboard');
  } catch (err) {
    console.error('Ready order save error:', err);
    alert('Error saving ready order: ' + err.message);
  }
}

