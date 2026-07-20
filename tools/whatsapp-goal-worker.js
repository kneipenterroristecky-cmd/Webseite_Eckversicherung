/**
 * Cloudflare Worker: WhatsApp → GitHub Goal Trigger + Kunden-Dokumenten-Weiterleitung
 *
 * Secrets (im Cloudflare Dashboard unter Workers → Settings → Variables eintragen):
 *   WHATSAPP_VERIFY_TOKEN   – frei wählbarer String, z.B. "mein-geheimer-token-2025"
 *   WHATSAPP_ACCESS_TOKEN   – aus Meta Developer Console (bereits als GitHub Secret vorhanden)
 *   WHATSAPP_PHONE_NUMBER_ID – aus Meta Developer Console (bereits als GitHub Secret vorhanden)
 *   WHATSAPP_TO_NUMBER      – deine WhatsApp-Nummer mit Ländervorwahl, OHNE +, z.B. "4917432258850"
 *   GITHUB_PAT              – der PAT_WORKFLOW Token aus GitHub Secrets
 *   GITHUB_REPO             – "kneipenterroristecky-cmd/Webseite_Eckversicherung"
 *   DOCUMENT_RELAY_URL      – die Apps-Script-Web-App-URL (siehe Code.gs, dashboard.html Zeile 231)
 *   DOCUMENT_RELAY_SECRET   – frei wählbarer String, MUSS mit DOCUMENT_RELAY_SECRET in Code.gs übereinstimmen
 *   ANTHROPIC_API_KEY       – fuer die Versicherungskontext-Pruefung von PDFs/Bildern (Modell claude-haiku-4-5)
 *   WORKER_ADMIN_SECRET     – frei waehlbarer String, schuetzt die 'teach'-Aktion (siehe unten)
 *
 * KV-Namespace-Bindung (siehe tools/wrangler.toml):
 *   SELIN_MEMORY – dauerhaftes Gedaechtnis fuer Selin (analog zu memory/*.md in der
 *                  Buero-Automation, aber Cloudflare-KV statt Datei, weil dieser Worker
 *                  ausserhalb des Arbeits-PCs laeuft). teach.ps1 fuegt Notizen per
 *                  POST { action: 'teach', secret: WORKER_ADMIN_SECRET, mitarbeiter: 'selin',
 *                  notiz: '...' } an diese selbe Worker-URL hinzu - kein wrangler auf dem
 *                  Arbeits-PC noetig.
 *   SOPHIE_MEMORY – dauerhaftes Gedaechtnis + Gespraechsstatus fuer Sophie (Daniels
 *                  persoenliche Assistentin, siehe unten). Gleicher teach.ps1-Mechanismus,
 *                  mitarbeiter: 'sophie'.
 *
 * ── SOPHIE (persoenliche Assistentin) ────────────────────────────────────
 * Zweite WhatsApp-Nummer, eigener Charakter (warmherzig, direkt, leichter Witz),
 * antwortet NUR Daniel (from === myNumber), NIE Kunden/Kontakten. Beantwortet
 * Fragen zum aktuellen Firmenstatus (ueber die Apps-Script-Bruecke, siehe
 * SOPHIE_SECRET/Code.gs) und kann Aenderungen an der Firmenstruktur (z.B.
 * Mitarbeiter pausieren) vorschlagen - fuehrt aber NIE selbststaendig aus,
 * sondern fragt IMMER erst nach Bestaetigung, bevor sie einen Aenderungsantrag
 * stellt (den apply-pending-changes.ps1 dann lokal umsetzt).
 * Zusaetzliche Secrets:
 *   SOPHIE_PHONE_NUMBER_ID  – Metas phone_number_id von Sophies eigener WhatsApp-Nummer
 *   SOPHIE_ACCESS_TOKEN     – Access Token fuer Sophies Nummer (meist gleich WHATSAPP_ACCESS_TOKEN,
 *                             wenn beide Nummern im selben Meta-Business-Konto liegen)
 *   SOPHIE_SECRET           – MUSS mit SOPHIE_SECRET in Code.gs uebereinstimmen
 *
 * ── SOPHIE PER SPRACHNACHRICHT (kostenlos statt Vapi/Twilio/ElevenLabs) ──
 * Kein echter Telefonanruf (der kostet immer etwas, egal welcher Anbieter),
 * stattdessen: Daniel schickt Sophie eine WhatsApp-Sprachnachricht, der
 * Worker transkribiert sie direkt in der Cloud ueber Cloudflare Workers AI
 * (Modell '@cf/openai/whisper-large-v3-turbo', mehrsprachig, auch Deutsch;
 * Binding 'AI' in wrangler.toml, im Cloudflare-Workers-Gratiskontingent
 * enthalten, kein zusaetzlicher Account noetig). Der erkannte Text laeuft
 * danach exakt durch dieselbe handleSophieMessage()-Pipeline wie normaler
 * WhatsApp-Text. Sophie antwortet als Text zurueck (keine Sprachausgabe -
 * TTS gibt es bei Workers AI nicht, und lokale TTS auf dem Arbeits-PC waere
 * nur so aktuell wie der naechste Task-Scheduler-Lauf, also kein Echtzeit-
 * Gespraech). tools/sophie-vapi-assistant.md bleibt als Referenz liegen,
 * falls spaeter doch ein echter Anruf gewuenscht wird - wird aber aktuell
 * NICHT genutzt.
 *
 * Schickt ein Kunde/Kontakt eine WhatsApp-Nachricht mit PDF- oder Bild-Anhang
 * (unabhängig von der Absender-Nummer, aber NIE aus Gruppen), wird zunaechst per
 * Claude geprueft, ob der Inhalt ueberhaupt einen Versicherungs-/Maklerbezug hat
 * (diese Nummer ist die private Nummer von Daniel, Kontakte schicken auch mal
 * private PDFs/Bilder ohne jeden Bezug - die sollen nie weiterverarbeitet werden).
 * Nur bei erkanntem Bezug wird das Dokument heruntergeladen und per Mail an
 * Daniels Postfach weitergeleitet - dort übernimmt die Büro-Automation
 * (classify-inbox.ps1) die Erkennung von Kunde/Vertrag und legt es in die
 * PW-Warteschlange.
 *
 * FESTER GRUNDSATZ: Dieser Worker antwortet NIEMALS selbststaendig auf
 * WhatsApp-Nachrichten von Kunden/Kontakten - weder mit einer Bestaetigung
 * noch sonst irgendeiner automatischen Antwort. handleCustomerMedia() sendet
 * bewusst keine Antwort an "from". Die /goal-, /status- und /hilfe-Befehle
 * (die einzigen Stellen, die ueberhaupt eine WhatsApp-Antwort verschicken)
 * sind hart auf "from === myNumber" beschraenkt, koennen also nur von Daniels
 * eigener Nummer ausgeloest werden. Dieser Grundsatz darf ohne ausdrueckliche
 * neue Anweisung von Daniel nicht aufgeweicht werden.
 */

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // ── GET: WhatsApp Webhook-Verifizierung ──────────────────────────────
    if (request.method === 'GET') {
      const mode      = url.searchParams.get('hub.mode');
      const token     = url.searchParams.get('hub.verify_token');
      const challenge = url.searchParams.get('hub.challenge');

      if (mode === 'subscribe' && token === env.WHATSAPP_VERIFY_TOKEN) {
        return new Response(challenge, { status: 200 });
      }
      return new Response('Forbidden', { status: 403 });
    }

    // ── POST: Eingehende WhatsApp-Nachricht ──────────────────────────────
    if (request.method === 'POST') {
      let body;
      try {
        body = await request.json();
      } catch {
        return new Response('Bad Request', { status: 400 });
      }

      // ── Admin: Selin/Sophie per teach.ps1 etwas dauerhaft beibringen ─────
      // Kein WhatsApp-Webhook-Payload, sondern ein direkter Aufruf von teach.ps1.
      if (body.action === 'teach') {
        if (body.secret !== env.WORKER_ADMIN_SECRET) {
          return new Response(JSON.stringify({ ok: false, error: 'Unauthorized' }), { status: 403 });
        }
        const kv = body.mitarbeiter === 'sophie' ? env.SOPHIE_MEMORY : env.SELIN_MEMORY;
        const memKey = body.mitarbeiter === 'sophie' ? 'sophie' : 'selin';
        const bestehend = (await kv.get(memKey)) || '';
        const datum = new Date().toISOString().slice(0, 10);
        const neu = bestehend + `- [${datum}] ${body.notiz}\n`;
        await kv.put(memKey, neu);
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }

      const value = body?.entry?.[0]?.changes?.[0]?.value;
      const message = value?.messages?.[0];
      if (!message) {
        return new Response('OK', { status: 200 });
      }

      const from = message.from; // Absender-Nummer ohne +
      const myNumber = env.WHATSAPP_TO_NUMBER.replace(/^\+/, '');

      // ── Sophie (persoenliche Assistentin) - eigene Nummer, eigene Logik ──
      if (value?.metadata?.phone_number_id === env.SOPHIE_PHONE_NUMBER_ID) {
        if (message.type === 'text' && from === myNumber) {
          await handleSophieMessage(env, message.text.body.trim());
        }
        if (message.type === 'audio' && from === myNumber) {
          await handleSophieVoiceNote(env, message.audio);
        }
        return new Response('OK', { status: 200 });
      }

      // ── Gruppen-Nachrichten NIE verarbeiten ──────────────────────────────
      // Diese Nummer ist keine reine Business-Nummer, sondern kann auch in
      // WhatsApp-Gruppen sein. Nachrichten aus Gruppen sollen niemals in die
      // Kunden-Dokumenten-Pipeline gelangen. Da uns noch kein echtes Gruppen-
      // Payload von Meta vorliegt, pruefen wir auf das dokumentierte
      // 'group_id'-Feld und loggen den Rohdaten zur Kontrolle/Verfeinerung.
      const isGroupMessage = !!(message.group_id || body?.entry?.[0]?.changes?.[0]?.value?.metadata?.group_id);
      if (isGroupMessage) {
        console.log('Gruppen-Nachricht erkannt und ignoriert:', JSON.stringify(message));
        return new Response('OK', { status: 200 });
      }

      // ── Kunden-Dokument (PDF/Bild) - unabhaengig vom Absender, aber nie aus Gruppen ──
      const isPdfDocument = message.type === 'document' && message.document?.mime_type === 'application/pdf';
      const isImage = message.type === 'image' && ['image/jpeg', 'image/png', 'image/webp'].includes(message.image?.mime_type);

      if (isPdfDocument || isImage) {
        console.log('Eingehendes Dokument/Bild (zur Gruppen-Kontrolle):', JSON.stringify(message));
        await handleCustomerMedia(env, message, from, isPdfDocument ? 'document' : 'image');
        return new Response('OK', { status: 200 });
      }

      // Ab hier: nur noch der interne /goal-Bot - nur Text von der eigenen Nummer
      if (message.type !== 'text' || from !== myNumber) {
        return new Response('OK', { status: 200 });
      }

      const text = message.text.body.trim();

      // ── /goal Befehl ───────────────────────────────────────────────────
      if (text.startsWith('/goal')) {
        const goal = text.slice(5).trim();

        if (!goal) {
          await sendWhatsApp(env, [
            '❓ *Kein Goal angegeben.*',
            '',
            'Beispiel:',
            '/goal Erstelle eine neue Unterseite für Unfallversicherung'
          ].join('\n'));
          return new Response('OK', { status: 200 });
        }

        // GitHub Actions triggern
        const resp = await fetch(
          `https://api.github.com/repos/${env.GITHUB_REPO}/actions/workflows/goal.yml/dispatches`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${env.GITHUB_PAT}`,
              'Content-Type': 'application/json',
              'User-Agent': 'WhatsApp-Goal-Webhook/1.0'
            },
            body: JSON.stringify({
              ref: 'master',
              inputs: {
                goal:         goal,
                issue_number: '0',
                source:       'whatsapp'
              }
            })
          }
        );

        if (resp.ok) {
          await sendWhatsApp(env, [
            '🚀 *Goal gestartet!*',
            '',
            `_${goal}_`,
            '',
            'Claude Code arbeitet daran. Du bekommst eine Nachricht wenn es fertig ist.'
          ].join('\n'));
        } else {
          const err = await resp.text();
          await sendWhatsApp(env, `❌ Fehler beim Starten:\n${err}`);
        }

        return new Response('OK', { status: 200 });
      }

      // ── /status Befehl ─────────────────────────────────────────────────
      if (text === '/status') {
        const runs = await fetch(
          `https://api.github.com/repos/${env.GITHUB_REPO}/actions/runs?per_page=3`,
          {
            headers: {
              'Authorization': `Bearer ${env.GITHUB_PAT}`,
              'User-Agent': 'WhatsApp-Goal-Webhook/1.0'
            }
          }
        ).then(r => r.json());

        const lines = ['📊 *Letzte Workflow-Runs:*', ''];
        for (const run of (runs.workflow_runs || []).slice(0, 3)) {
          const icon = run.conclusion === 'success' ? '✅' :
                       run.status    === 'in_progress' ? '⏳' : '❌';
          lines.push(`${icon} ${run.name} – ${run.status}`);
        }
        await sendWhatsApp(env, lines.join('\n'));
        return new Response('OK', { status: 200 });
      }

      // ── /hilfe Befehl ──────────────────────────────────────────────────
      if (text === '/hilfe' || text === '/help') {
        await sendWhatsApp(env, [
          '🤖 *Claude Code via WhatsApp*',
          '',
          '*/goal <Aufgabe>* – Startet Claude Code',
          '*/status* – Zeigt letzte Workflow-Runs',
          '*/hilfe* – Diese Hilfe',
          '',
          'Beispiele:',
          '/goal Erstelle Unterseite für Grundfähigkeitsversicherung',
          '/goal Überarbeite den Hero-Text auf der Startseite',
          '/goal Füge fehlende Meta-Beschreibungen zu allen Seiten hinzu'
        ].join('\n'));
        return new Response('OK', { status: 200 });
      }

      return new Response('OK', { status: 200 });
    }

    return new Response('Method Not Allowed', { status: 405 });
  }
};

async function sendWhatsApp(env, message) {
  await sendWhatsAppTo(env, env.WHATSAPP_TO_NUMBER, message, env.WHATSAPP_PHONE_NUMBER_ID, env.WHATSAPP_ACCESS_TOKEN);
}

async function sendWhatsAppTo(env, to, message, phoneNumberId, accessToken) {
  await fetch(
    `https://graph.facebook.com/v19.0/${phoneNumberId}/messages`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: to,
        type: 'text',
        text: { body: message }
      })
    }
  );
}

// ── Kunden-Dokument/Bild pruefen, herunterladen und per Mail weiterleiten ──
async function handleCustomerMedia(env, message, from, kind) {
  try {
    const mediaObj  = kind === 'document' ? message.document : message.image;
    const mediaId   = mediaObj.id;
    const mimeType  = mediaObj.mime_type;
    const extension = kind === 'document' ? 'pdf' : (mimeType.split('/')[1] || 'jpg');
    const filename  = mediaObj.filename || `whatsapp-${kind === 'document' ? 'dokument' : 'bild'}-${mediaId}.${extension}`;

    // 1. Media-URL bei Meta abrufen
    const metaResp = await fetch(`https://graph.facebook.com/v19.0/${mediaId}`, {
      headers: { 'Authorization': `Bearer ${env.WHATSAPP_ACCESS_TOKEN}` }
    });
    const metaData = await metaResp.json();
    if (!metaData.url) {
      throw new Error('Keine Media-URL von Meta erhalten: ' + JSON.stringify(metaData));
    }

    // 2. Datei herunterladen
    const fileResp = await fetch(metaData.url, {
      headers: { 'Authorization': `Bearer ${env.WHATSAPP_ACCESS_TOKEN}` }
    });
    const buffer = await fileResp.arrayBuffer();
    const base64 = arrayBufferToBase64(buffer);

    // 3. Versicherungskontext pruefen - private Nummer bekommt auch private
    //    PDFs/Bilder ohne jeden Bezug, die nie weiterverarbeitet werden sollen.
    const relevant = await hatVersicherungsbezug(env, base64, mimeType, kind);
    if (!relevant) {
      console.log(`Kein Versicherungsbezug erkannt, verworfen: ${filename} von ${from}`);
      return;
    }

    // 4. An die Apps-Script-Web-App weiterleiten - die verschickt die Mail
    const relayResp = await fetch(env.DOCUMENT_RELAY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action:    'whatsapp_pdf',
        secret:    env.DOCUMENT_RELAY_SECRET,
        filename:  filename,
        mimeType:  mimeType,
        pdfBase64: base64,
        from:      from
      })
    });
    if (!relayResp.ok) {
      throw new Error('Weiterleitung an Apps Script fehlgeschlagen: ' + relayResp.status);
    }
  } catch (ex) {
    console.error('Fehler bei WhatsApp-Dokument-Weiterleitung:', ex);
  }
}

// ── Per Claude pruefen, ob Inhalt einen Versicherungs-/Maklerbezug hat ────
// Bei Klassifizierungs-Fehlern (API-Problem etc.) wird sicherheitshalber
// WEITERGELEITET (fail-open), damit nie ein echtes Kundendokument verloren
// geht - die Buero-Automation (classify-inbox.ps1) klassifiziert ohnehin
// nochmal nach und sortiert echten Muell dort als "irrelevant" aus.
async function hatVersicherungsbezug(env, base64, mimeType, kind) {
  try {
    const contentBlock = kind === 'document'
      ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } }
      : { type: 'image', source: { type: 'base64', media_type: mimeType, data: base64 } };

    const memory = (await env.SELIN_MEMORY.get('selin')) || '';
    const memoryBlock = memory
      ? `Bisherige Anweisungen von Daniel, die du IMMER befolgen musst:\n${memory}\n\n`
      : '';

    const body = {
      model: 'claude-haiku-4-5',
      max_tokens: 200,
      messages: [{
        role: 'user',
        content: [
          contentBlock,
          {
            type: 'text',
            text: memoryBlock +
                  'Pruefe, ob dieses Dokument/Bild einen Bezug zu Versicherungen, Vertraegen, ' +
                  'Schaeden oder der Taetigkeit eines Versicherungsmaklers hat (z.B. Vertragsunterlagen, ' +
                  'Schadenmeldung, Risikofragen, Rechnung einer Versicherungsgesellschaft, ' +
                  'Kundenkorrespondenz zu Versicherungen). Privater Inhalt ohne jeden solchen Bezug ' +
                  '(z.B. Urlaubsfotos, private Chats, Memes, Werbung) zaehlt NICHT. ' +
                  'Antworte ausschliesslich im vorgegebenen JSON-Format.'
          }
        ]
      }],
      output_config: {
        format: {
          type: 'json_schema',
          schema: {
            type: 'object',
            properties: { versicherungsbezug: { type: 'boolean' } },
            required: ['versicherungsbezug'],
            additionalProperties: false
          }
        }
      }
    };

    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    if (!resp.ok) {
      throw new Error('Claude-API-Fehler: ' + resp.status + ' ' + (await resp.text()));
    }

    const data = await resp.json();
    const textBlock = (data.content || []).find(b => b.type === 'text');
    if (!textBlock) {
      throw new Error('Keine Text-Antwort von Claude erhalten: ' + JSON.stringify(data));
    }

    const parsed = JSON.parse(textBlock.text);
    return !!parsed.versicherungsbezug;
  } catch (ex) {
    console.error('Fehler bei Versicherungsbezug-Pruefung, leite sicherheitshalber weiter:', ex);
    return true;
  }
}

function arrayBufferToBase64(buffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

// ══════════════════════════════════════════════════════════════════════
// SOPHIE - Daniels persoenliche Assistentin
// ══════════════════════════════════════════════════════════════════════

const SOPHIE_PERSONALITY =
  'Du bist Sophie, die persoenliche Assistentin von Daniel Eck, unabhaengigem ' +
  'Versicherungsmakler in Schmalkalden. Du bist warmherzig, direkt und hast einen ' +
  'leichten, sympathischen Witz - wie eine erfahrene, geschaetzte Buero-Managerin, ' +
  'die genau weiss was los ist und Daniel den Ruecken freihaelt. Du sprichst ihn ' +
  'locker aber respektvoll an, keine Floskeln, keine Business-Phrasen. Du bist die ' +
  'einzige Ansprechpartnerin, die er direkt anrufen oder anschreiben kann, um sich ' +
  'einen Ueberblick ueber seine digitale Firma zu verschaffen (Petra, Bilal, Uwe, ' +
  'Rita, Herbert, Selin und ihre Abteilungsleiter) oder etwas daran zu aendern.\n\n' +
  'FESTER GRUNDSATZ: Du fuehrst NIEMALS selbststaendig eine Aenderung an der ' +
  'Firmenstruktur aus (Mitarbeiter pausieren/aktivieren, Einstellungen aendern). ' +
  'Du schlaegst die Aenderung konkret vor und fragst explizit nach Bestaetigung. ' +
  'Nur wenn Daniel in einer SEPARATEN, folgenden Nachricht eindeutig bestaetigt ' +
  '("ja", "mach das", "genau" o.ae.), gilt die Aenderung als bestaetigt.';

async function sophieBridgeCall(env, action, extra) {
  const resp = await fetch(env.DOCUMENT_RELAY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, secret: env.SOPHIE_SECRET, ...extra })
  });
  return await resp.json();
}

async function handleSophieMessage(env, text) {
  try {
    const pendingRaw = await env.SOPHIE_MEMORY.get('sophie_pending');
    const pending = pendingRaw ? JSON.parse(pendingRaw) : null;

    if (pending) {
      const entscheidung = await sophieClassifyConfirmation(env, text, pending);
      if (entscheidung === 'confirm') {
        await sophieBridgeCall(env, 'sophie_request_change', { change: pending });
        await env.SOPHIE_MEMORY.delete('sophie_pending');
        await sendSophieReply(env, `Erledigt: ${pending.description}. Sobald der Arbeits-PC das naechste Mal laeuft, ist es aktiv.`);
        return;
      }
      if (entscheidung === 'reject') {
        await env.SOPHIE_MEMORY.delete('sophie_pending');
        await sendSophieReply(env, 'Alles klar, hab ich verworfen.');
        return;
      }
      // 'other': veraltete/abgebrochene Rueckfrage - loeschen und normal weitermachen
      await env.SOPHIE_MEMORY.delete('sophie_pending');
    }

    const memory = (await env.SOPHIE_MEMORY.get('sophie')) || '';
    const statusResult = await sophieBridgeCall(env, 'sophie_get_status', {});
    const status = statusResult.ok ? statusResult.status : null;

    const antwort = await sophieRespond(env, text, memory, status);

    if (antwort.proposedChange) {
      await env.SOPHIE_MEMORY.put('sophie_pending', JSON.stringify(antwort.proposedChange));
    }
    await sendSophieReply(env, antwort.reply);
  } catch (ex) {
    console.error('Fehler bei Sophie:', ex);
    await sendSophieReply(env, 'Sorry, da ist gerade technisch etwas schiefgelaufen. Magst du das nochmal schreiben?');
  }
}

async function sendSophieReply(env, message) {
  await sendWhatsAppTo(env, env.WHATSAPP_TO_NUMBER, message, env.SOPHIE_PHONE_NUMBER_ID, env.SOPHIE_ACCESS_TOKEN || env.WHATSAPP_ACCESS_TOKEN);
}

async function sophieClassifyConfirmation(env, text, pending) {
  const body = {
    model: 'claude-haiku-4-5',
    max_tokens: 100,
    messages: [{
      role: 'user',
      content: `Du hast Daniel vorgeschlagen: "${pending.description}". Seine Antwort darauf: "${text}". ` +
        `Bestaetigt er das (confirm), lehnt er ab (reject), oder redet er ueber etwas anderes (other)? ` +
        `Antworte ausschliesslich im vorgegebenen JSON-Format.`
    }],
    output_config: {
      format: {
        type: 'json_schema',
        schema: {
          type: 'object',
          properties: { entscheidung: { type: 'string', enum: ['confirm', 'reject', 'other'] } },
          required: ['entscheidung'],
          additionalProperties: false
        }
      }
    }
  };
  try {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await resp.json();
    const textBlock = (data.content || []).find(b => b.type === 'text');
    return JSON.parse(textBlock.text).entscheidung;
  } catch (ex) {
    console.error('Fehler bei Sophies Bestaetigungs-Einordnung:', ex);
    return 'other';
  }
}

async function sophieRespond(env, text, memory, status) {
  const memoryBlock = memory ? `Was du dir bisher gemerkt hast:\n${memory}\n\n` : '';
  const statusBlock = status
    ? `Aktueller Firmenstatus (Stand ${status.stand || 'unbekannt'}):\n${JSON.stringify(status, null, 2)}\n\n`
    : 'Firmenstatus liegt gerade nicht vor (noch nicht veroeffentlicht oder Verbindung fehlt).\n\n';

  const body = {
    model: 'claude-haiku-4-5',
    max_tokens: 1000,
    messages: [{
      role: 'user',
      content: SOPHIE_PERSONALITY + '\n\n' + memoryBlock + statusBlock +
        `Daniel schreibt dir gerade per WhatsApp: "${text}"\n\n` +
        'Antworte ihm direkt (reply). Falls er eine Aenderung an der Firmenstruktur ' +
        'wuenscht (z.B. einen Mitarbeiter pausieren/aktivieren), fuelle proposedChange ' +
        'aus und formuliere in reply eine klare Rueckfrage zur Bestaetigung - fuehre ' +
        'NICHTS direkt aus. employee ist der Mitarbeiter-Kuerzelname (z.B. "rita"), ' +
        'path ist der config.json-Pfad (fuer Pausieren: "employees.<name>.active", ' +
        'value dann false; zum Wiederaktivieren value true). Wenn keine Aenderung ' +
        'gewuenscht ist, lass proposedChange weg. Antworte ausschliesslich im ' +
        'vorgegebenen JSON-Format.'
    }],
    output_config: {
      format: {
        type: 'json_schema',
        schema: {
          type: 'object',
          properties: {
            reply: { type: 'string' },
            proposedChange: {
              anyOf: [
                {
                  type: 'object',
                  properties: {
                    employee:    { type: 'string' },
                    path:        { type: 'string' },
                    value:       { type: 'boolean' },
                    description: { type: 'string' }
                  },
                  required: ['employee', 'path', 'value', 'description'],
                  additionalProperties: false
                },
                { type: 'null' }
              ]
            }
          },
          required: ['reply', 'proposedChange'],
          additionalProperties: false
        }
      }
    }
  };

  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!resp.ok) {
    throw new Error('Claude-API-Fehler (Sophie): ' + resp.status + ' ' + (await resp.text()));
  }
  const data = await resp.json();
  const textBlock = (data.content || []).find(b => b.type === 'text');
  return JSON.parse(textBlock.text);
}
