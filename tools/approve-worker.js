/**
 * Cloudflare Worker: Ein-Klick-Buttons für Blog-Entwurf-Mails
 *
 * Ersetzt die Links in den Freigabe-Mails (Workflow 1 & 3), die bisher auf die
 * GitHub-Actions-Seite führten (dort musste man am Handy erst den Tab aufziehen,
 * "Run workflow" antippen und Eingaben machen). Diese Links hier lösen die
 * Workflows per einfachem GET-Tap direkt aus – kein GitHub-Login, kein Dropdown.
 *
 * Endpunkte:
 *   GET  /approve?token=...          → Workflow 2 (veröffentlichen), keine Eingaben nötig
 *   GET  /suggest-image?token=...    → Workflow 3 mit suggest_new_image=true
 *   GET  /change?token=...           → zeigt ein kleines Handy-Formular (Titel/Text ändern)
 *   POST /change?token=...           → verarbeitet das Formular, löst Workflow 3 aus
 *
 * Secrets (im Cloudflare Dashboard unter Workers → Settings → Variables eintragen):
 *   GITHUB_PAT   – derselbe PAT_WORKFLOW-Token wie beim whatsapp-goal-worker
 *   GITHUB_REPO  – "kneipenterroristecky-cmd/Webseite_Eckversicherung"
 *   APPROVE_TOKEN – frei wählbarer, langer Zufalls-String (schützt die Links,
 *                   da sie ohne GitHub-Login funktionieren – nur wer den Link aus
 *                   der Mail hat, kann etwas auslösen)
 *
 * Die fertige Worker-URL (z.B. https://blog-approve.DEIN-SUBDOMAIN.workers.dev)
 * und der APPROVE_TOKEN müssen zusätzlich als GitHub-Secrets
 * "APPROVE_WORKER_URL" bzw. "APPROVE_TOKEN" hinterlegt werden, damit die
 * Mail-Workflows (1 und 3) die richtigen Links in die Mail schreiben können.
 */

const PAGE_STYLE = `
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    body{font-family:Arial,sans-serif;background:#f1f5f9;margin:0;padding:24px 16px;
      display:flex;align-items:center;justify-content:center;min-height:100vh}
    .card{background:#fff;border-radius:12px;padding:24px 20px;max-width:420px;width:100%;
      box-shadow:0 1px 4px rgba(0,0,0,.08)}
    h1{font-size:18px;margin:0 0 8px;color:#172d50}
    p{font-size:14px;line-height:1.5;color:#374151;margin:0 0 16px}
    label{display:block;font-size:12px;font-weight:700;color:#94a3b8;text-transform:uppercase;
      letter-spacing:.5px;margin:14px 0 4px}
    input,textarea{width:100%;box-sizing:border-box;padding:10px 12px;border:1px solid #cbd5e1;
      border-radius:6px;font-size:15px;font-family:Arial,sans-serif}
    textarea{min-height:80px;resize:vertical}
    button{width:100%;margin-top:18px;background:#16a34a;color:#fff;border:none;padding:14px;
      border-radius:6px;font-size:15px;font-weight:700}
    .status{font-size:40px;text-align:center;margin-bottom:4px}
  </style>
`;

function page(title, bodyHtml) {
  return `<!DOCTYPE html><html lang="de"><head><meta charset="utf-8"><title>${title}</title>${PAGE_STYLE}</head>
  <body><div class="card">${bodyHtml}</div></body></html>`;
}

async function dispatchWorkflow(env, workflowFile, inputs) {
  return fetch(
    `https://api.github.com/repos/${env.GITHUB_REPO}/actions/workflows/${workflowFile}/dispatches`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.GITHUB_PAT}`,
        'Content-Type': 'application/json',
        'User-Agent': 'Approve-Worker/1.0'
      },
      body: JSON.stringify({ ref: 'master', inputs: inputs || {} })
    }
  );
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const token = url.searchParams.get('token');

    if (!env.APPROVE_TOKEN || token !== env.APPROVE_TOKEN) {
      return new Response(page('Kein Zugriff', `
        <div class="status">🔒</div>
        <h1>Link ungültig</h1>
        <p>Dieser Link ist abgelaufen oder falsch. Bitte die aktuelle Mail verwenden.</p>
      `), { status: 403, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    }

    // ── Freigeben & veröffentlichen (Workflow 2) ─────────────────────────
    if (url.pathname === '/approve') {
      const resp = await dispatchWorkflow(env, 'publish-blog-post.yml');
      return new Response(page('Freigegeben', resp.ok ? `
        <div class="status">✅</div>
        <h1>Beitrag wird veröffentlicht</h1>
        <p>Der Blog-Beitrag wird jetzt live gestellt und auf Facebook/Instagram/WhatsApp geteilt. Das dauert ein paar Minuten.</p>
      ` : `
        <div class="status">❌</div>
        <h1>Fehler beim Starten</h1>
        <p>Bitte kurz warten und den Link nochmal antippen, oder Daniel Bescheid geben.</p>
      `), { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    }

    // ── Neues Bild vorschlagen (Workflow 3, suggest_new_image) ───────────
    if (url.pathname === '/suggest-image') {
      const resp = await dispatchWorkflow(env, 'request-changes.yml', { suggest_new_image: 'true' });
      return new Response(page('Neues Bild', resp.ok ? `
        <div class="status">🖼️</div>
        <h1>Neues Bild wird gesucht</h1>
        <p>Die KI sucht jetzt ein passenderes Bild und schickt in ein paar Minuten eine neue Vorschau-Mail.</p>
      ` : `
        <div class="status">❌</div>
        <h1>Fehler beim Starten</h1>
        <p>Bitte kurz warten und den Link nochmal antippen, oder Daniel Bescheid geben.</p>
      `), { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    }

    // ── Ändern: Formular anzeigen (GET) oder verarbeiten (POST) ──────────
    if (url.pathname === '/change') {
      if (request.method === 'GET') {
        return new Response(page('Entwurf ändern', `
          <h1>✏️ Entwurf ändern</h1>
          <p>Leer lassen, was gleich bleiben soll.</p>
          <form method="POST" action="/change?token=${encodeURIComponent(token)}">
            <label>Neuer Titel</label>
            <input type="text" name="new_title" placeholder="z.B. Hausratversicherung: Was zählt dazu?">
            <label>Neuer Facebook/Instagram-Text</label>
            <textarea name="new_summary" placeholder="Neuer Social-Media-Text..."></textarea>
            <button type="submit">Änderung senden</button>
          </form>
        `), { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
      }

      if (request.method === 'POST') {
        const form = await request.formData();
        const inputs = {
          new_title:   (form.get('new_title') || '').toString().trim(),
          new_summary: (form.get('new_summary') || '').toString().trim()
        };
        const resp = await dispatchWorkflow(env, 'request-changes.yml', inputs);
        return new Response(page('Änderung gesendet', resp.ok ? `
          <div class="status">✏️</div>
          <h1>Änderung wird angewendet</h1>
          <p>Du bekommst in ein paar Minuten eine aktualisierte Vorschau-Mail.</p>
        ` : `
          <div class="status">❌</div>
          <h1>Fehler beim Starten</h1>
          <p>Bitte kurz warten und nochmal versuchen, oder Daniel Bescheid geben.</p>
        `), { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
      }
    }

    return new Response('Not Found', { status: 404 });
  }
};
