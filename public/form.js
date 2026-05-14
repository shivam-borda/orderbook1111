/**
 * form.js
 * Three pipeline sections per design block:
 *   1. Fabric Order Details
 *   2. Embroidery Pipeline
 *   3. Stitching Pipeline
 */

var designCount   = 0;
var fabricCounters    = {};   // fabric rows per design
var embroideryCounters = {};  // embroidery rows per design
var stitchCounters    = {};   // stitching rows per design

/* ─────────────────────────────────────────
   SECTION HEADER HELPER
───────────────────────────────────────── */
function sectionHeader(icon, label, color) {
  return '<div style="' +
    'background:' + color + ';color:#fff;' +
    'padding:8px 14px;border-radius:7px 7px 0 0;' +
    'font-size:0.78rem;font-weight:700;letter-spacing:1px;text-transform:uppercase;' +
    'margin-top:20px;' +
  '">' + icon + ' ' + label + '</div>';
}

/* ─────────────────────────────────────────
   ADD DESIGN BLOCK
───────────────────────────────────────── */
function addDesign() {
  designCount++;
  var id = designCount;
  var container = document.getElementById('designs-container');

  var block = document.createElement('div');
  block.className = 'design-block';
  block.id = 'design-' + id;

  block.innerHTML =

    /* ── Top: image + header fields ── */
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
          '<input type="text" placeholder="Auto" id="orderno-' + id + '" readonly style="background:#f0f0f0;color:#e65100;font-weight:700;" />' +
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

    '</div>' +

    /* ══════════════════════════════════
       SECTION 1 — FABRIC ORDER DETAILS
    ══════════════════════════════════ */
    sectionHeader('&#x1F9F5;', 'Fabric Order Details', '#3949ab') +
    '<div class="table-wrapper pipeline-box" style="border-color:#3949ab;">' +
      '<table id="fabric-table-' + id + '">' +
        '<thead><tr>' +
          '<th style="background:#3949ab;color:#fff">#</th>' +
          '<th style="background:#3949ab;color:#fff">Party Name</th>' +
          '<th style="background:#3949ab;color:#fff">Fabric Name</th>' +
          '<th style="background:#3949ab;color:#fff">Colour</th>' +
          '<th style="background:#3949ab;color:#fff">Work Fab</th>' +
          '<th style="background:#3949ab;color:#fff">Plain Fab</th>' +
          '<th style="background:#3949ab;color:#fff">Total Fab</th>' +
          '<th style="background:#3949ab;color:#fff">Received Fab</th>' +
          '<th style="background:#3949ab;color:#fff">Work Pcs</th>' +
          '<th style="background:#3949ab;color:#fff"></th>' +
        '</tr></thead>' +
        '<tbody id="fabric-tbody-' + id + '"></tbody>' +
      '</table>' +
    '</div>' +
    '<div class="btn-row">' +
      '<button class="btn-add-row btn-add-fabric" onclick="addFabricRow(' + id + ')">+ Add Fabric Row</button>' +
    '</div>' +

    /* ══════════════════════════════════
       SECTION 2 — EMBROIDERY PIPELINE
    ══════════════════════════════════ */
    sectionHeader('&#x1FAE7;', 'Embroidery Job Work', '#6a1b9a') +
    '<div class="pipeline-box" style="border-color:#6a1b9a;padding:12px 14px;">' +
      '<div style="display:flex;gap:16px;margin-bottom:12px;flex-wrap:wrap;">' +
        '<div class="field-group" style="flex:1;min-width:160px;">' +
          '<label>Party Name</label>' +
          '<input type="text" placeholder="Party name" id="emb-party-' + id + '" />' +
        '</div>' +
        '<div class="field-group" style="flex:1;min-width:160px;">' +
          '<label>Date</label>' +
          '<input type="date" id="emb-date-' + id + '" />' +
        '</div>' +
      '</div>' +
      '<div class="table-wrapper">' +
        '<table id="emb-table-' + id + '">' +
          '<thead>' +
            '<tr>' +
              '<th rowspan="2" style="background:#6a1b9a;color:#fff">#</th>' +
              '<th colspan="3" style="background:#4a148c;color:#fff">Work Sent (meters)</th>' +
              '<th colspan="3" style="background:#4a148c;color:#fff">Work Returned (meters)</th>' +
              '<th rowspan="2" style="background:#6a1b9a;color:#fff"></th>' +
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
    '</div>' +
    '<div class="btn-row">' +
      '<button class="btn-add-row btn-add-emb" onclick="addEmbroideryRow(' + id + ')">+ Add Embroidery Row</button>' +
    '</div>' +

    /* ══════════════════════════════════
       SECTION 3 — STITCHING PIPELINE
    ══════════════════════════════════ */
    sectionHeader('&#x2702;&#xFE0F;', 'Stitching Job Work', '#00695c') +
    '<div class="pipeline-box" style="border-color:#00695c;padding:12px 14px;">' +
      '<div style="display:flex;gap:16px;margin-bottom:12px;flex-wrap:wrap;">' +
        '<div class="field-group" style="flex:1;min-width:160px;">' +
          '<label>Party Name</label>' +
          '<input type="text" placeholder="Party name" id="stitch-party-' + id + '" />' +
        '</div>' +
        '<div class="field-group" style="flex:1;min-width:160px;">' +
          '<label>Sent Date</label>' +
          '<input type="date" id="stitch-date-' + id + '" />' +
        '</div>' +
      '</div>' +
      '<div class="table-wrapper">' +
        '<table id="stitch-table-' + id + '">' +
          '<thead><tr>' +
            '<th style="background:#00695c;color:#fff">#</th>' +
            '<th style="background:#00695c;color:#fff">Expected Pcs</th>' +
            '<th style="background:#00695c;color:#fff">Received Pcs</th>' +
            '<th style="background:#00695c;color:#fff"></th>' +
          '</tr></thead>' +
          '<tbody id="stitch-tbody-' + id + '"></tbody>' +
        '</table>' +
      '</div>' +
    '</div>' +
    '<div class="btn-row">' +
      '<button class="btn-add-row btn-add-stitch" onclick="addStitchRow(' + id + ')">+ Add Stitch Row</button>' +
    '</div>';

  container.appendChild(block);

  // 1 default row in each section
  addFabricRow(id);
  addEmbroideryRow(id);
  addStitchRow(id);
}

/* ─────────────────────────────────────────
   SECTION 1 — FABRIC ROW
───────────────────────────────────────── */
function addFabricRow(designId) {
  if (!fabricCounters[designId]) fabricCounters[designId] = 0;
  fabricCounters[designId]++;
  var rowId = fabricCounters[designId];

  var tbody = document.getElementById('fabric-tbody-' + designId);
  var tr = document.createElement('tr');
  tr.id = 'fabric-row-' + designId + '-' + rowId;
  tr.innerHTML =
    '<td>' + rowId + '</td>' +
    '<td><input type="text" placeholder="Party name" /></td>' +
    '<td><input type="text" placeholder="Fabric name" /></td>' +
    '<td><input type="text" placeholder="Colour - Code" /></td>' +
    '<td><input type="text" placeholder="Work Fab"  /></td>' +
    '<td><input type="text" placeholder="Plain Fab"  /></td>' +
    '<td><input type="text" placeholder="Total"  /></td>' +
    '<td><input type="text" placeholder="Received" /></td>' +
    '<td><input type="text" placeholder="Work pcs" /></td>' +
    '<td><button class="remove-row-btn" onclick="removeRow(\'fabric-row-' + designId + '-' + rowId + '\')" title="Remove">&#x2715;</button></td>';
  tbody.appendChild(tr);
}

/* ─────────────────────────────────────────
   SECTION 2 — EMBROIDERY ROW
───────────────────────────────────────── */
function addEmbroideryRow(designId) {
  if (!embroideryCounters[designId]) embroideryCounters[designId] = 0;
  embroideryCounters[designId]++;
  var rowId = embroideryCounters[designId];

  var tbody = document.getElementById('emb-tbody-' + designId);
  var tr = document.createElement('tr');
  tr.id = 'emb-row-' + designId + '-' + rowId;
  tr.innerHTML =
    '<td>' + rowId + '</td>' +
    /* Work sent */
    '<td><input type="text" placeholder="Front m" /></td>' +
    '<td><input type="text" placeholder="Back m" /></td>' +
    '<td><input type="text" placeholder="Sleeve m" /></td>' +
    /* Work returned */
    '<td><input type="text" placeholder="Front m" /></td>' +
    '<td><input type="text" placeholder="Back m" /></td>' +
    '<td><input type="text" placeholder="Sleeve m" /></td>' +
    '<td><button class="remove-row-btn" onclick="removeRow(\'emb-row-' + designId + '-' + rowId + '\')" title="Remove">&#x2715;</button></td>';
  tbody.appendChild(tr);
}

/* ─────────────────────────────────────────
   SECTION 3 — STITCHING ROW
───────────────────────────────────────── */
function addStitchRow(designId) {
  if (!stitchCounters[designId]) stitchCounters[designId] = 0;
  stitchCounters[designId]++;
  var rowId = stitchCounters[designId];

  var tbody = document.getElementById('stitch-tbody-' + designId);
  var tr = document.createElement('tr');
  tr.id = 'stitch-row-' + designId + '-' + rowId;
  tr.innerHTML =
    '<td>' + rowId + '</td>' +
    '<td><input type="text" placeholder="e.g. 90" /></td>' +
    '<td><input type="text" placeholder="e.g. 85" /></td>' +
    '<td><button class="remove-row-btn" onclick="removeRow(\'stitch-row-' + designId + '-' + rowId + '\')" title="Remove">&#x2715;</button></td>';
  tbody.appendChild(tr);
}

/* ─────────────────────────────────────────
   COLLECT ALL DATA from a design block
───────────────────────────────────────── */
function collectRows(blockId) {
  var fabricRows = [];
  document.querySelectorAll('#fabric-tbody-' + blockId + ' tr').forEach(function(row) {
    var inp = row.querySelectorAll('input');
    fabricRows.push({
      partyName   : inp[0] ? inp[0].value : '',
      fabricName  : inp[1] ? inp[1].value : '',
      colour      : inp[2] ? inp[2].value : '',
      workFab     : inp[3] ? inp[3].value : '',
      plainFab    : inp[4] ? inp[4].value : '',
      totalFab    : inp[5] ? inp[5].value : '',
      receivedFab : inp[6] ? inp[6].value : '',
      workPcs     : inp[7] ? inp[7].value : ''
    });
  });

  var embParty = document.getElementById('emb-party-' + blockId) ? document.getElementById('emb-party-' + blockId).value : '';
  var embDate  = document.getElementById('emb-date-' + blockId) ? document.getElementById('emb-date-' + blockId).value : '';
  var embRows = [];
  document.querySelectorAll('#emb-tbody-' + blockId + ' tr').forEach(function(row) {
    var inp = row.querySelectorAll('input');
    embRows.push({
      partyName    : embParty,
      date         : embDate,
      sentFront    : inp[0] ? inp[0].value : '',
      sentBack     : inp[1] ? inp[1].value : '',
      sentSleeve   : inp[2] ? inp[2].value : '',
      returnFront  : inp[3] ? inp[3].value : '',
      returnBack   : inp[4] ? inp[4].value : '',
      returnSleeve : inp[5] ? inp[5].value : ''
    });
  });

  var stitchParty = document.getElementById('stitch-party-' + blockId) ? document.getElementById('stitch-party-' + blockId).value : '';
  var stitchDate  = document.getElementById('stitch-date-' + blockId) ? document.getElementById('stitch-date-' + blockId).value : '';
  var stitchRows = [];
  document.querySelectorAll('#stitch-tbody-' + blockId + ' tr').forEach(function(row) {
    var inp = row.querySelectorAll('input');
    stitchRows.push({
      partyName   : stitchParty,
      sentDate    : stitchDate,
      expectedPcs : inp[0] ? inp[0].value : '',
      receivedPcs : inp[1] ? inp[1].value : ''
    });
  });

  return { fabricRows: fabricRows, embRows: embRows, stitchRows: stitchRows };
}

/* ─────────────────────────────────────────
   FILL DATA back into a design block
───────────────────────────────────────── */
function fillRows(blockId, data) {
  var fabricRows = data.fabricRows || [];
  var embRows    = data.embRows    || [];
  var stitchRows = data.stitchRows || [];

  /* Fabric */
  document.getElementById('fabric-tbody-' + blockId).innerHTML = '';
  fabricCounters[blockId] = 0;
  fabricRows.forEach(function(r) {
    addFabricRow(blockId);
    var rowId = fabricCounters[blockId];
    var inp = document.getElementById('fabric-row-' + blockId + '-' + rowId).querySelectorAll('input');
    [r.partyName, r.fabricName, r.colour, r.workFab, r.plainFab, r.totalFab, r.receivedFab, r.workPcs]
      .forEach(function(v, i) { if (inp[i]) inp[i].value = v || ''; });
  });

  /* Embroidery */
  document.getElementById('emb-tbody-' + blockId).innerHTML = '';
  embroideryCounters[blockId] = 0;
  // Fill single party/date from first row
  if (embRows.length > 0) {
    var ep = document.getElementById('emb-party-' + blockId);
    var ed = document.getElementById('emb-date-' + blockId);
    if (ep) ep.value = embRows[0].partyName || '';
    if (ed) ed.value = embRows[0].date || '';
  }
  embRows.forEach(function(r) {
    addEmbroideryRow(blockId);
    var rowId = embroideryCounters[blockId];
    var inp = document.getElementById('emb-row-' + blockId + '-' + rowId).querySelectorAll('input');
    [r.sentFront, r.sentBack, r.sentSleeve,
     r.returnFront, r.returnBack, r.returnSleeve]
      .forEach(function(v, i) { if (inp[i]) inp[i].value = v || ''; });
  });

  /* Stitching */
  document.getElementById('stitch-tbody-' + blockId).innerHTML = '';
  stitchCounters[blockId] = 0;
  // Fill single party/date from first row
  if (stitchRows.length > 0) {
    var sp = document.getElementById('stitch-party-' + blockId);
    var sd = document.getElementById('stitch-date-' + blockId);
    if (sp) sp.value = stitchRows[0].partyName || '';
    if (sd) sd.value = stitchRows[0].sentDate || '';
  }
  stitchRows.forEach(function(r) {
    addStitchRow(blockId);
    var rowId = stitchCounters[blockId];
    var inp = document.getElementById('stitch-row-' + blockId + '-' + rowId).querySelectorAll('input');
    [r.expectedPcs, r.receivedPcs]
      .forEach(function(v, i) { if (inp[i]) inp[i].value = v || ''; });
  });
}

/* ─────────────────────────────────────────
   REMOVE HELPERS
───────────────────────────────────────── */
function removeRow(rowId) {
  var row = document.getElementById(rowId);
  if (row) row.remove();
}

function removeDesign(id) {
  var block = document.getElementById('design-' + id);
  if (block) block.remove();
}

/* ─────────────────────────────────────────
   IMAGE HELPERS WITH CROP EDITOR
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
  reader.onload = function(evt) {
    var img = new Image();
    img.onload = function() {
      _cropState.id = id;
      _cropState.img = img;
      showCropModal(img);
    };
    img.src = evt.target.result;
  };
  reader.readAsDataURL(file);
}

function showCropModal(img) {
  // Create modal if not exists
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

    // Add styles
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

  // Calculate display size that fits the viewport
  var maxW = Math.min(window.innerWidth * 0.7, 600);
  var maxH = Math.min(window.innerHeight * 0.55, 500);
  var scale = Math.min(maxW / img.width, maxH / img.height, 1);
  var displayW = Math.round(img.width * scale);
  var displayH = Math.round(img.height * scale);

  // Set canvas to display size (1:1 pixel mapping with screen)
  canvas.width = displayW;
  canvas.height = displayH;
  canvas.style.width = displayW + 'px';
  canvas.style.height = displayH + 'px';
  ctx.drawImage(img, 0, 0, displayW, displayH);

  // Store the scale factor from display to original image
  _cropState.scaleToOriginal = img.width / displayW;
  _cropState.displayW = displayW;
  _cropState.displayH = displayH;

  // Reset selection
  var sel = document.getElementById('crop-selection');
  sel.style.display = 'none';
  _cropState.startX = 0;
  _cropState.startY = 0;
  _cropState.endX = displayW;
  _cropState.endY = displayH;
  _cropState.dragging = false;

  // Mouse events for selection
  var wrap = canvas.parentElement;
  wrap.onmousedown = function(e) {
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
  wrap.onmousemove = function(e) {
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
  wrap.onmouseup = function() { _cropState.dragging = false; };

  // Touch events for mobile
  wrap.ontouchstart = function(e) {
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
  wrap.ontouchmove = function(e) {
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
  wrap.ontouchend = function() { _cropState.dragging = false; };
}

function applyCrop() {
  var img = _cropState.img;
  var s = _cropState.scaleToOriginal;

  var x = Math.round(Math.min(_cropState.startX, _cropState.endX) * s);
  var y = Math.round(Math.min(_cropState.startY, _cropState.endY) * s);
  var w = Math.round(Math.abs(_cropState.endX - _cropState.startX) * s);
  var h = Math.round(Math.abs(_cropState.endY - _cropState.startY) * s);

  // If no selection or too small, use full image
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

function loadImagePreview(file, id) {
  var reader = new FileReader();
  reader.onload = function(evt) { setDropZoneImage(id, evt.target.result); };
  reader.readAsDataURL(file);
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
  img.onclick = function(e) { e.stopPropagation(); showImagePreview(src); };
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
  t.style.background = color || '#2e7d32';
  t.style.display = 'block';
  setTimeout(function() { t.style.display = 'none'; }, 3000);
}
