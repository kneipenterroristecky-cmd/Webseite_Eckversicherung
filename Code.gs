// ================================================================
//  Daniel Eck – Versicherungsmakler – Analytics Backend
//  Google Apps Script
//
//  SETUP (einmalig, ca. 5 Minuten):
//  1. Öffne https://sheets.google.com → neues Sheet erstellen
//  2. Menü: Erweiterungen → Apps Script
//  3. Diesen Code vollständig einfügen (alten Code ersetzen)
//  4. DASHBOARD_PW und NOTIFY_EMAIL anpassen
//  5. Klick: Bereitstellen → Neue Bereitstellung
//     → Typ: Web-App  |  Ausführen als: Ich  |  Zugriff: Jeder
//  6. Genehmigen (Erweitert → trotzdem öffnen)
//  7. URL kopieren → in analytics.js Zeile 8 eintragen
// ================================================================

var SHEET        = 'Events';
var DASHBOARD_PW = 'Defekt102!';                    // ← Passwort
var NOTIFY_EMAIL = 'daniel@eckversicherung.de';     // ← Benachrichtigungs-E-Mail

// ----------------------------------------------------------------
// GET-Handler: Tracking + Dashboard-Daten
// ----------------------------------------------------------------
function doGet(e) {
  var p = e.parameter;

  if (p.action === 'data') {
    if (p.pw !== DASHBOARD_PW) return out_({ ok: false, err: 'Unauthorized' });
    return getData_();
  }

  save_(p);
  return ContentService.createTextOutput('1').setMimeType(ContentService.MimeType.TEXT);
}

// POST-Handler (Fallback)
function doPost(e) {
  try { save_(JSON.parse(e.postData.contents)); return out_({ ok: true }); }
  catch (ex) { return out_({ ok: false }); }
}

// ----------------------------------------------------------------
// Event speichern + ggf. E-Mail senden
// ----------------------------------------------------------------
function save_(p) {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET) || initSheet_(ss);

  var now = new Date();
  sheet.appendRow([
    Utilities.formatDate(now, 'Europe/Berlin', 'dd.MM.yyyy'),
    Utilities.formatDate(now, 'Europe/Berlin', 'HH:mm'),
    p.type    || 'pageview',
    p.page    || '/',
    p.ref     || 'Direkt',
    p.device  || '',
    p.browser || '',
    p.os      || '',
    p.lang    || '',
    p.country || '',
    p.city    || '',
    p.sid     || '',
    p.extra   || '',
    p.vid     || ''   // persistente Besucher-ID
  ]);

  // E-Mail-Benachrichtigungen für wichtige Events
  try {
    if (p.type === 'quiz' && p.extra === 'Abgeschlossen') {
      notify_('Quiz abgeschlossen', p, now);
    }
    if (p.type === 'funnel' && p.extra === 'Start') {
      notify_('Funnel gestartet – neuer Lead!', p, now);
    }
  } catch (ex) {}
}

// ----------------------------------------------------------------
// E-Mail-Benachrichtigung
// ----------------------------------------------------------------
function notify_(betreff, p, now) {
  var ort    = [p.city, p.country].filter(Boolean).join(', ') || 'Unbekannt';
  var zeit   = Utilities.formatDate(now, 'Europe/Berlin', 'dd.MM.yyyy HH:mm');
  var body   =
    'Hallo Daniel,\n\n' +
    'auf Daniel Eck – Versicherungsmakler.de ist gerade etwas passiert:\n\n' +
    '  Ereignis:  ' + betreff + '\n' +
    '  Zeit:      ' + zeit    + '\n' +
    '  Gerät:     ' + (p.device  || '–') + '  /  ' + (p.browser || '–') + '\n' +
    '  Ort:       ' + ort     + '\n' +
    '  Herkunft:  ' + (p.ref  || 'Direkt') + '\n\n' +
    'Jetzt Dashboard öffnen:\n' +
    'https://eckversicherung.netlify.app/dashboard.html\n\n' +
    '– Dein Analytics-System';

  MailApp.sendEmail({
    to:      NOTIFY_EMAIL,
    subject: '🔔 ' + betreff + ' – Daniel Eck – Versicherungsmakler',
    body:    body
  });
}

// ----------------------------------------------------------------
// Sheet initialisieren
// ----------------------------------------------------------------
function initSheet_(ss) {
  var s = ss.insertSheet(SHEET);
  var h = ['Datum','Uhrzeit','Typ','Seite','Referrer',
           'Gerät','Browser','OS','Sprache','Land','Stadt','Session','Extra','BesucherID'];
  s.appendRow(h);
  s.setFrozenRows(1);
  s.getRange(1, 1, 1, h.length)
    .setBackground('#172d50').setFontColor('#ffffff').setFontWeight('bold');
  [100,70,90,160,140,80,80,80,70,110,110,100,110,100].forEach(function(w,i){
    s.setColumnWidth(i+1, w);
  });
  return s;
}

// ----------------------------------------------------------------
// Alle Events zurückgeben (für Dashboard)
// ----------------------------------------------------------------
function getData_() {
  var s = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET);
  if (!s || s.getLastRow() < 2) return out_({ ok: true, rows: [] });

  var vals = s.getDataRange().getValues();
  var hdrs = vals[0];
  var rows = vals.slice(1).reverse().map(function (r) {
    var o = {};
    hdrs.forEach(function (h, i) { o[h] = String(r[i]); });
    return o;
  });
  return out_({ ok: true, rows: rows, total: rows.length });
}

function out_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
