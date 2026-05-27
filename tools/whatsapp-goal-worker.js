/**
 * Cloudflare Worker: WhatsApp → GitHub Goal Trigger
 *
 * Secrets (im Cloudflare Dashboard unter Workers → Settings → Variables eintragen):
 *   WHATSAPP_VERIFY_TOKEN   – frei wählbarer String, z.B. "mein-geheimer-token-2025"
 *   WHATSAPP_ACCESS_TOKEN   – aus Meta Developer Console (bereits als GitHub Secret vorhanden)
 *   WHATSAPP_PHONE_NUMBER_ID – aus Meta Developer Console (bereits als GitHub Secret vorhanden)
 *   WHATSAPP_TO_NUMBER      – deine WhatsApp-Nummer mit Ländervorwahl, OHNE +, z.B. "4917432258850"
 *   GITHUB_PAT              – der PAT_WORKFLOW Token aus GitHub Secrets
 *   GITHUB_REPO             – "kneipenterroristecky-cmd/Webseite_Eckversicherung"
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

      // Nur Text-Nachrichten verarbeiten
      if (!message || message.type !== 'text') {
        return new Response('OK', { status: 200 });
      }

      const text = message.text.body.trim();
      const from = message.from; // Absender-Nummer ohne +

      // Nur Nachrichten von deiner eigenen Nummer
      const myNumber = env.WHATSAPP_TO_NUMBER.replace(/^\+/, '');
      if (from !== myNumber) {
        return new Response('OK', { status: 200 });
      }

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
        to: env.WHATSAPP_TO_NUMBER,
        type: 'text',
        text: { body: message }
      })
    }
  );
}
