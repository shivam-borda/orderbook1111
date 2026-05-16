/**
 * print.js
 * Opens a clean print window for one of three pipeline sections:
 *   'fabric'      — Our Copy (Fabric Order Details)
 *   'embroidery'  — Embroidery Pipeline
 *   'stitch'      — Stitching Party Copy
 *
 * Print format: Table layout with column headers and data rows.
 */

// ─── SET YOUR LOGO URL HERE ───
// Paste a full URL (https://...) or a local path (e.g. 'logo.png')
var LOGO_URL = 'logo.png';
// ───────────────────────────────

// Pre-load logo as base64 for print windows
var _logoDataUrl = '';
(function() {
  if (!LOGO_URL) return;
  var img = new Image();
  img.onload = function() {
    var c = document.createElement('canvas');
    c.width = img.naturalWidth;
    c.height = img.naturalHeight;
    c.getContext('2d').drawImage(img, 0, 0);
    try { _logoDataUrl = c.toDataURL('image/png'); } catch(e) { _logoDataUrl = LOGO_URL; }
  };
  img.onerror = function() { _logoDataUrl = LOGO_URL; };
  img.src = LOGO_URL;
})();

function printAs(mode) {
  var config = {
    fabric: {
      title: 'OUR COPY \u2013 FABRIC ORDER DETAILS',
      heading: 'Fabric Order',
      icon: '&#x1F9F5;',
      thColor: '#3949ab',
      fields: ['Party Name', 'Fabric Name', 'Colour', 'Work Fab', 'Plain Fab', 'Total Fab', 'Received Fab', 'Work Pcs'],
      tbodyPrefix: 'fabric-tbody-'
    },
    embroidery: {
      title: 'EMBROIDERY PIPELINE',
      heading: 'Embroidery Job Work',
      icon: '&#x1FAE7;',
      thColor: '#6a1b9a',
      fields: ['Sent Front', 'Sent Back', 'Sent Sleeve', 'Return Front', 'Return Back', 'Return Sleeve'],
      tbodyPrefix: 'emb-tbody-'
    },
    stitch: {
      title: 'STITCHING PARTY COPY',
      heading: 'Stitching Job Work',
      icon: '&#x2702;&#xFE0F;',
      thColor: '#00695c',
      fields: ['Expected Pcs', 'Received Pcs'],
      tbodyPrefix: 'stitch-tbody-'
    }
  };

  // Support legacy 'internal' mode mapping to 'fabric'
  if (mode === 'internal') mode = 'fabric';

  var cfg = config[mode];
  if (!cfg) { alert('Unknown print mode.'); return; }

  var designs = document.querySelectorAll('.design-block');
  if (!designs.length) { alert('No designs to print.'); return; }

  var blocksHtml = '';

  designs.forEach(function(block) {
    var id      = block.id.split('-')[1];
    var orderNo = document.getElementById('orderno-' + id).value || '';
    var dno     = document.getElementById('dno-'    + id).value || '';
    var fabric  = document.getElementById('fabric-' + id).value || '';
    var date    = document.getElementById('date-'   + id).value || '';

    // Party and Date info for specific modes
    var party = '';
    var pDate = '';
    var pDateLabel = 'Date';
    if (mode === 'embroidery') {
      var pEl = document.getElementById('emb-party-' + id);
      var dEl = document.getElementById('emb-date-' + id);
      party = pEl ? pEl.value : '';
      pDate = dEl ? dEl.value : '';
    } else if (mode === 'stitch') {
      var pEl = document.getElementById('stitch-party-' + id);
      var dEl = document.getElementById('stitch-date-' + id);
      party = pEl ? pEl.value : '';
      pDate = dEl ? dEl.value : '';
      pDateLabel = 'Sent Date';
    }

    // Image
    var imgEl  = block.querySelector('img.preview-img');
    var imgTag = imgEl
      ? '<img src="' + imgEl.src + '" style="max-width:120px;max-height:120px;height:auto;border-radius:6px;" />'
      : '<div style="width:80px;height:80px;border:1px dashed #999;border-radius:6px;display:flex;align-items:center;justify-content:center;color:#999;font-size:0.7rem;">No Image</div>';

    // Header info with proper borders
    var cellStyle = 'border:1px solid #333;padding:8px 12px;font-size:0.9rem;';
    var keyStyle  = cellStyle + 'font-weight:700;background:#f0f0f0;width:120px;white-space:nowrap;';
    var valStyle  = cellStyle;

    var headerHtml =
      '<div style="font-size:1.4rem;font-weight:900;color:#e65100;margin-bottom:10px;letter-spacing:1px;">' +
        'Order No: ' + escHtml(orderNo) + ' &nbsp;&nbsp;&nbsp; Design No: ' + escHtml(dno) +
      '</div>' +
      '<table style="width:100%;border-collapse:collapse;margin-bottom:16px;border:2px solid #333;">' +
        '<tr>' +
          '<td rowspan="3" style="' + cellStyle + 'text-align:center;vertical-align:middle;width:140px;">' + imgTag + '</td>' +
          '<td style="' + keyStyle + '">Party Name</td>' +
          '<td style="' + valStyle + '">' + escHtml(mode === 'fabric' ? 'OUR COPY' : (party || '\u2014')) + '</td>' +
        '</tr>' +
        '<tr>' +
          '<td style="' + keyStyle + '">' + pDateLabel + '</td>' +
          '<td style="' + valStyle + '">' + escHtml(mode === 'fabric' ? date : (pDate || '\u2014')) + '</td>' +
        '</tr>' +
        '<tr>' +
          '<td style="' + keyStyle + '">Fabric Type</td>' +
          '<td style="' + valStyle + '">' + escHtml(fabric || '\u2014') + '</td>' +
        '</tr>' +
      '</table>';

    // Build TABLE format for data rows
    var tbody = document.getElementById(cfg.tbodyPrefix + id);
    var tableHtml = '';

    // For embroidery/stitch: show party name and date above the table
    var sectionInfoHtml = '';

    if (tbody) {
      var rows = tbody.querySelectorAll('tr');
      if (rows.length > 0) {
        // Table header
        var thStyle = 'border:1px solid #333;padding:8px 10px;font-size:0.8rem;font-weight:700;color:#fff;background:' + cfg.thColor + ';text-align:center;';
        var tdStyle = 'border:1px solid #333;padding:8px 10px;font-size:0.85rem;text-align:center;';

        tableHtml += '<table style="width:100%;border-collapse:collapse;border:2px solid #333;">';
        tableHtml += '<thead><tr>';
        tableHtml += '<th style="' + thStyle + '">#</th>';
        for (var h = 0; h < cfg.fields.length; h++) {
          tableHtml += '<th style="' + thStyle + '">' + cfg.fields[h] + '</th>';
        }
        tableHtml += '</tr></thead>';

        // Table body rows
        tableHtml += '<tbody>';
        rows.forEach(function(row, idx) {
          var inputs = row.querySelectorAll('input');
          var bgColor = idx % 2 === 0 ? '#ffffff' : '#f5f5f5';
          tableHtml += '<tr style="background:' + bgColor + ';">';
          tableHtml += '<td style="' + tdStyle + 'font-weight:700;">' + (idx + 1) + '</td>';
          for (var i = 0; i < cfg.fields.length; i++) {
            var val = (inputs[i] ? inputs[i].value : '') || '';
            tableHtml += '<td style="' + tdStyle + '">' + escHtml(val) + '</td>';
          }
          tableHtml += '</tr>';
        });
        tableHtml += '</tbody></table>';
      }
    }

    blocksHtml +=
      '<div style="background:#fff;border:2px solid #333;border-radius:8px;' +
           'padding:18px 20px;margin-bottom:24px;page-break-inside:avoid;">' +
        headerHtml + sectionInfoHtml + tableHtml +
      '</div>';
  });

  // Open print window
  var win = window.open('', '_blank', 'width=900,height=700');
  win.document.write(
    '<!DOCTYPE html><html><head><meta charset="UTF-8"/>' +
    '<title>' + cfg.title + '</title>' +
    '<style>' +
      'body{font-family:Segoe UI,Arial,sans-serif;padding:20px;background:#fff;color:#222;}' +
      '.logo-wrap{text-align:center;margin-bottom:12px;}' +
      '.logo-wrap img{max-height:150px;width:auto;}' +
      'h1{text-align:center;font-size:1.3rem;letter-spacing:2px;text-transform:uppercase;' +
         'color:' + cfg.thColor + ';margin-bottom:6px;}' +
      'p.sub{text-align:center;font-size:0.75rem;color:#888;margin-bottom:20px;letter-spacing:1px;}' +
      'table{border-collapse:collapse;width:100%;}' +
      '@media print{' +
        'body{padding:8px;}' +
        '-webkit-print-color-adjust:exact;' +
        'print-color-adjust:exact;' +
      '}' +
    '</style>' +
    '</head><body>' +
    '<div class="logo-wrap">' + (_logoDataUrl ? '<img src="' + _logoDataUrl + '" alt="Logo" />' : '') + '</div>' +
    '<h1>' + cfg.icon + ' ' + cfg.heading + '</h1>' +
    blocksHtml +
    '<script>window.onload=function(){window.print();}<\/script>' +
    '</body></html>'
  );
  win.document.close();
}
