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

      const message = body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
      if (!message) {
        return new Response('OK', { status: 200 });
      }

      const from = message.from; // Absender-Nummer ohne +
      const myNumber = env.WHATSAPP_TO_NUMBER.replace(/^\+/, '');

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

      // ── Kunden-Dokument (PDF) - unabhaengig vom Absender, aber nie aus Gruppen ──
      if (message.type === 'document' && message.document?.mime_type === 'application/pdf') {
        console.log('Eingehendes Dokument (zur Gruppen-Kontrolle):', JSON.stringify(message));
        await handleCustomerDocument(env, message, from);
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
  await sendWhatsAppTo(env, env.WHATSAPP_TO_NUMBER, message);
}

async function sendWhatsAppTo(env, to, message) {
  await fetch(
    `https://graph.facebook.com/v19.0/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`,
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

// ── Kunden-Dokument herunterladen und per Mail weiterleiten ──────────────
async function handleCustomerDocument(env, message, from) {
  try {
    const mediaId  = message.document.id;
    const filename = message.document.filename || `whatsapp-dokument-${mediaId}.pdf`;

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

    // 3. An die Apps-Script-Web-App weiterleiten - die verschickt die Mail
    const relayResp = await fetch(env.DOCUMENT_RELAY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action:    'whatsapp_pdf',
        secret:    env.DOCUMENT_RELAY_SECRET,
        filename:  filename,
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

function arrayBufferToBase64(buffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}
