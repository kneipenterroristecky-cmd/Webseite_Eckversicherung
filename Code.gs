// ================================================================
//  Daniel Eck – Versicherungsmakler – Analytics + Voice-Agent Backend
//  Google Apps Script
//
//  ANALYTICS SETUP (einmalig, ca. 5 Minuten):
//  1. Öffne https://sheets.google.com → neues Sheet erstellen
//  2. Menü: Erweiterungen → Apps Script
//  3. Diesen Code vollständig einfügen (alten Code ersetzen)
//  4. DASHBOARD_PW und NOTIFY_EMAIL anpassen
//  5. Klick: Bereitstellen → Neue Bereitstellung
//     → Typ: Web-App  |  Ausführen als: Ich  |  Zugriff: Jeder
//  6. Genehmigen (Erweitert → trotzdem öffnen)
//  7. URL kopieren → in analytics.js Zeile 8 eintragen
//
//  VOICE-AGENT SETUP (einmalig, ca. 15 Minuten):
//  1. Kostenloses Konto auf vapi.ai erstellen
//  2. Settings > API Keys → Key kopieren → VAPI_API_KEY eintragen
//  3. Phone Numbers > Add Phone Number → Twilio-Verbindung einrichten
//     (twilio.com → kostenloses Konto → DE-Nummer kaufen: +49, ca. 1$/Monat)
//     Vapi Phone Number ID kopieren → VAPI_PHONE_NUMBER_ID eintragen
//  4. Zeitgesteuerten Trigger einrichten:
//     - Apps Script Menü: Trigger (Wecker-Symbol links)
//     - + Trigger hinzufügen
//     - Funktion: processCallLeads
//     - Ereignisquelle: Zeitgesteuert → Stundenbasiert → Jede Stunde
//     ODER: Funktion setupCallTrigger() einmalig manuell ausführen
// ================================================================

var SHEET        = 'Events';
var LEADS_SHEET  = 'Anruf-Leads';
var DASHBOARD_PW = 'Defekt102!';
var NOTIFY_EMAIL = 'daniel@eckversicherung.de';

// ── WHATSAPP-DOKUMENTEN-WEITERLEITUNG ────────────────────────────
// Muss exakt mit DOCUMENT_RELAY_SECRET im Cloudflare Worker uebereinstimmen
// (tools/whatsapp-goal-worker.js)
var DOCUMENT_RELAY_SECRET = 'Sr6kqDZLNqfXzfjCmkgcCw-h_Oa--vRk';

// ── VAPI VOICE AGENT KONFIGURATION ───────────────────────────────
var VAPI_API_KEY         = 'DEIN_VAPI_API_KEY';          // ← nach vapi.ai Setup eintragen
var VAPI_PHONE_NUMBER_ID = 'DEINE_VAPI_PHONE_NUMBER_ID'; // ← Vapi Phone Number ID eintragen
var CALL_HOUR_FROM       = 10;   // Anrufe ab 10:00 Uhr (Europe/Berlin)
var CALL_HOUR_TO         = 18;   // Anrufe bis 18:00 Uhr (Europe/Berlin)
var CALL_DELAY_HOURS     = 24;   // Stunden nach Anmeldung vor erstem Anruf
var LEAD_SECRET          = 'ECK_VOICE_2024'; // Spam-Schutz für Lead-Endpoint
// ─────────────────────────────────────────────────────────────────

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

// ----------------------------------------------------------------
// POST-Handler: Analytics-Events + Voice-Lead-Speicherung
// ----------------------------------------------------------------
function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);

    if (data.action === 'store_lead') {
      if (data.secret !== LEAD_SECRET) return out_({ ok: false, err: 'Unauthorized' });
      var id = storeLead_(data);
      return out_({ ok: true, id: id });
    }

    if (data.action === 'whatsapp_pdf') {
      if (data.secret !== DOCUMENT_RELAY_SECRET) return out_({ ok: false, err: 'Unauthorized' });
      var relayId = relayWhatsAppDocument_(data);
      return out_({ ok: true, id: relayId });
    }

    save_(data);
    return out_({ ok: true });
  } catch (ex) {
    return out_({ ok: false, err: ex.message });
  }
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
    p.vid     || ''
  ]);

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
// WhatsApp-Kundendokument per Mail an Daniels Postfach weiterleiten
// (landet dort, wo classify-inbox.ps1 der Buero-Automation es findet)
// ----------------------------------------------------------------
function relayWhatsAppDocument_(data) {
  var bytes    = Utilities.base64Decode(data.pdfBase64);
  var filename = data.filename || 'whatsapp-dokument.pdf';
  var mimeType = data.mimeType || 'application/pdf';
  var blob     = Utilities.newBlob(bytes, mimeType, filename);
  var absender = data.from || 'unbekannt';

  MailApp.sendEmail({
    to:      NOTIFY_EMAIL,
    subject: '📎 WhatsApp-Dokument von ' + absender,
    body:
      'Ein Kunde hat per WhatsApp ein Dokument geschickt.\n\n' +
      'Absender-Nummer: ' + absender + '\n' +
      'Dateiname: ' + filename + '\n\n' +
      'Das Dokument haengt an dieser Mail an und wird von der Buero-Automation ' +
      'automatisch geprueft (Kunde/Vertrag erkennen, in die PW-Warteschlange legen).',
    attachments: [blob]
  });

  return 'ok';
}

// ----------------------------------------------------------------
// Voice-Lead speichern
// ----------------------------------------------------------------
function storeLead_(data) {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(LEADS_SHEET) || initLeadsSheet_(ss);
  var now   = new Date();
  var id    = 'LEAD_' + now.getTime();

  sheet.appendRow([
    id,
    Utilities.formatDate(now, 'Europe/Berlin', 'dd.MM.yyyy'),
    Utilities.formatDate(now, 'Europe/Berlin', 'HH:mm'),
    data.vorname  || '',
    data.nachname || '',
    data.email    || '',
    data.phone    || '',
    'pending',
    '',
    '',
    ''
  ]);

  try { notifyNewLead_(data, now); } catch (ex) {}
  return id;
}

// ----------------------------------------------------------------
// Anruf-Leads Sheet initialisieren
// ----------------------------------------------------------------
function initLeadsSheet_(ss) {
  var s = ss.insertSheet(LEADS_SHEET);
  var h = ['Lead-ID','Datum','Uhrzeit','Vorname','Nachname','E-Mail','Telefon','Status','Anruf-Zeit','Ergebnis','Notizen'];
  s.appendRow(h);
  s.setFrozenRows(1);
  s.getRange(1, 1, 1, h.length)
    .setBackground('#0c1c3e').setFontColor('#ffffff').setFontWeight('bold');
  [120,90,70,100,100,180,130,90,100,120,160].forEach(function(w, i) {
    s.setColumnWidth(i + 1, w);
  });
  return s;
}

// ----------------------------------------------------------------
// processCallLeads – stündlich per Trigger ausgeführt
// Prüft Zeitfenster und startet Vapi-Anrufe für reife Leads
// ----------------------------------------------------------------
function processCallLeads() {
  if (VAPI_API_KEY === 'DEIN_VAPI_API_KEY') return;

  var now        = new Date();
  var berlinHour = parseInt(Utilities.formatDate(now, 'Europe/Berlin', 'H'), 10);
  var berlinDay  = parseInt(Utilities.formatDate(now, 'Europe/Berlin', 'u'), 10); // 1=Mo … 7=So

  if (berlinDay >= 6) return;
  if (berlinHour < CALL_HOUR_FROM || berlinHour >= CALL_HOUR_TO) return;

  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(LEADS_SHEET);
  if (!sheet || sheet.getLastRow() < 2) return;

  var vals = sheet.getDataRange().getValues();
  var hdrs = vals[0];

  var colDatum  = hdrs.indexOf('Datum');
  var colZeit   = hdrs.indexOf('Uhrzeit');
  var colName   = hdrs.indexOf('Vorname');
  var colNname  = hdrs.indexOf('Nachname');
  var colTel    = hdrs.indexOf('Telefon');
  var colStatus = hdrs.indexOf('Status');
  var colAnruf  = hdrs.indexOf('Anruf-Zeit');
  var colResult = hdrs.indexOf('Ergebnis');

  for (var i = 1; i < vals.length; i++) {
    var row = vals[i];
    if (String(row[colStatus]) !== 'pending') continue;

    var datumStr = String(row[colDatum]) + ' ' + String(row[colZeit]);
    var teile    = datumStr.match(/(\d+)\.(\d+)\.(\d+) (\d+):(\d+)/);
    if (!teile) continue;
    var erstellt = new Date(+teile[3], +teile[2] - 1, +teile[1], +teile[4], +teile[5]);
    if ((now - erstellt) / 3600000 < CALL_DELAY_HOURS) continue;

    var phone   = String(row[colTel]).trim();
    var vorname = String(row[colName]).trim();
    var nachname= String(row[colNname]).trim();

    try {
      var result = createVapiCall_(phone, vorname, nachname);
      sheet.getRange(i + 1, colStatus + 1).setValue('calling');
      sheet.getRange(i + 1, colAnruf  + 1).setValue(Utilities.formatDate(now, 'Europe/Berlin', 'dd.MM.yyyy HH:mm'));
      sheet.getRange(i + 1, colResult + 1).setValue('Vapi-ID: ' + (result.id || 'unbekannt'));
    } catch (ex) {
      sheet.getRange(i + 1, colStatus + 1).setValue('error');
      sheet.getRange(i + 1, colResult + 1).setValue('Fehler: ' + ex.message);
    }

    Utilities.sleep(2000);
  }
}

// ----------------------------------------------------------------
// Vapi-Anruf starten
// ----------------------------------------------------------------
function createVapiCall_(phone, vorname, nachname) {
  var e164 = formatPhone_(phone);
  if (!e164) throw new Error('Ungueltige Telefonnummer: ' + phone);

  var systemPrompt =
    'Du bist ein freundlicher KI-Assistent von Daniel Eck, unabhaengigem Versicherungsmakler in Schmalkalden. '
  + 'Du rufst Personen an, die sich auf eckversicherung.de fuer kostenlose Versicherungstools angemeldet haben. '
  + 'Dein Ziel: In maximal 4 Minuten herausfinden, ob ein kostenloses Beratungsgespraech mit Daniel sinnvoll waere.\n\n'
  + 'GESPRAECHSLEITFADEN:\n'
  + '1. Kurze freundliche Begrueszung: "Guten Tag, hier ist ein KI-Assistent von Eck Versicherungen. '
  +    'Sie haben sich kuerzlich auf unserer Website fuer kostenlose Versicherungstools angemeldet."\n'
  + '2. Frage 1: "Haben Sie Ihre Versicherungen in den letzten 2 Jahren ueberprufen lassen?"\n'
  + '3. Frage 2: "Gibt es einen Bereich – zum Beispiel Haftpflicht, Berufsunfaehigkeit oder KFZ – '
  +    'bei dem Sie sich nicht sicher sind, ob Sie gut abgesichert sind?"\n'
  + '4. Bei Interesse: "Daniel Eck kann das in einem kostenlosen 20-Minuten-Gespraech genau pruefen. '
  +    'Waere das etwas fuer Sie?"\n'
  + '5. Bei JA: "Wunderbar! Ich gebe das direkt weiter – Daniel meldet sich in den naechsten 1 bis 2 Werktagen '
  +    'persoenlich bei Ihnen."\n'
  + '6. Bei NEIN: Freundlich und ohne Druck verabschieden.\n\n'
  + 'REGELN:\n'
  + '- Immer auf Deutsch sprechen\n'
  + '- Freundlich, ruhig, nie aufdringlich\n'
  + '- Maximal 5 Minuten\n'
  + '- Bei "keine Zeit": kurzen Rueckruf zu einem anderen Zeitpunkt anbieten\n'
  + '- Wenn gefragt ob Mensch oder KI: ehrlich antworten, dass du ein KI-Assistent bist\n'
  + '- Keine Produktverkauefe, keine Abschluesse – nur fuer ein Gespraech mit Daniel qualifizieren';

  var payload = {
    phoneNumberId: VAPI_PHONE_NUMBER_ID,
    customer: {
      number: e164,
      name:   vorname + ' ' + nachname
    },
    assistant: {
      name: 'Eck Versicherungen Assistent',
      model: {
        provider:    'openai',
        model:       'gpt-4o-mini',
        messages:    [{ role: 'system', content: systemPrompt }],
        temperature: 0.6,
        maxTokens:   200
      },
      voice: {
        provider:        '11labs',
        voiceId:         'pFZP5JQG7iQjIQuC4Bku',
        stability:        0.5,
        similarityBoost:  0.75
      },
      firstMessage:             'Guten Tag, ' + vorname + '! Hier ist ein Assistent von Eck Versicherungen. Habe ich gerade einen kurzen Moment?',
      endCallFunctionEnabled:    true,
      backgroundSound:           'office',
      maxDurationSeconds:        300
    }
  };

  var response = UrlFetchApp.fetch('https://api.vapi.ai/call/phone', {
    method:             'post',
    headers: {
      'Authorization': 'Bearer ' + VAPI_API_KEY,
      'Content-Type':  'application/json'
    },
    payload:            JSON.stringify(payload),
    muteHttpExceptions: true
  });

  var result = JSON.parse(response.getContentText());
  if (response.getResponseCode() !== 201) {
    throw new Error('Vapi API ' + response.getResponseCode() + ': ' + JSON.stringify(result));
  }
  return result;
}

// ----------------------------------------------------------------
// Telefonnummer in E.164-Format umwandeln (+49XXXXXXXXX)
// ----------------------------------------------------------------
function formatPhone_(raw) {
  var digits = String(raw).replace(/\D/g, '');
  if (digits.indexOf('0049') === 0) digits = digits.slice(4);
  if (digits.indexOf('49')   === 0 && digits.length > 11) digits = digits.slice(2);
  if (digits.indexOf('0')    === 0) digits = digits.slice(1);
  if (digits.length < 9 || digits.length > 12) return null;
  return '+49' + digits;
}

// ----------------------------------------------------------------
// Daniel per E-Mail über neuen Voice-Lead informieren
// ----------------------------------------------------------------
function notifyNewLead_(data, now) {
  var zeit = Utilities.formatDate(now, 'Europe/Berlin', 'dd.MM.yyyy HH:mm');
  MailApp.sendEmail({
    to:      NOTIFY_EMAIL,
    subject: '📞 Neuer Voice-Lead: ' + (data.vorname || '') + ' ' + (data.nachname || ''),
    body:
      'Hallo Daniel,\n\n'
    + 'ein neuer Interessent hat sich für einen KI-Anruf angemeldet:\n\n'
    + '  Name:    ' + (data.vorname || '') + ' ' + (data.nachname || '') + '\n'
    + '  E-Mail:  ' + (data.email   || '') + '\n'
    + '  Telefon: ' + (data.phone   || '') + '\n'
    + '  Zeit:    ' + zeit + '\n\n'
    + 'Der Anruf erfolgt automatisch am nächsten Werktag zwischen '
    + CALL_HOUR_FROM + ':00 und ' + CALL_HOUR_TO + ':00 Uhr\n'
    + '(frühestens ' + CALL_DELAY_HOURS + ' Stunden nach Anmeldung).\n\n'
    + 'Alle Leads im Sheet:\n' + SpreadsheetApp.getActiveSpreadsheet().getUrl() + '\n\n'
    + '– Dein Voice-Agent-System'
  });
}

// ----------------------------------------------------------------
// Trigger einmalig einrichten (einmal manuell ausführen)
// ----------------------------------------------------------------
function setupCallTrigger() {
  ScriptApp.getProjectTriggers().forEach(function(t) {
    if (t.getHandlerFunction() === 'processCallLeads') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('processCallLeads')
    .timeBased()
    .everyHours(1)
    .create();
  Logger.log('Trigger erstellt: processCallLeads laeuft jetzt jede Stunde.');
}

// ----------------------------------------------------------------
// E-Mail-Benachrichtigung (Analytics)
// ----------------------------------------------------------------
function notify_(betreff, p, now) {
  var ort  = [p.city, p.country].filter(Boolean).join(', ') || 'Unbekannt';
  var zeit = Utilities.formatDate(now, 'Europe/Berlin', 'dd.MM.yyyy HH:mm');
  var body =
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
// Sheet initialisieren (Analytics)
// ----------------------------------------------------------------
function initSheet_(ss) {
  var s = ss.insertSheet(SHEET);
  var h = ['Datum','Uhrzeit','Typ','Seite','Referrer',
           'Gerät','Browser','OS','Sprache','Land','Stadt','Session','Extra','BesucherID'];
  s.appendRow(h);
  s.setFrozenRows(1);
  s.getRange(1, 1, 1, h.length)
    .setBackground('#172d50').setFontColor('#ffffff').setFontWeight('bold');
  [100,70,90,160,140,80,80,80,70,110,110,100,110,100].forEach(function(w, i) {
    s.setColumnWidth(i + 1, w);
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
  var rows = vals.slice(1).reverse().map(function(r) {
    var o = {};
    hdrs.forEach(function(h, i) { o[h] = String(r[i]); });
    return o;
  });
  return out_({ ok: true, rows: rows, total: rows.length });
}

function out_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
