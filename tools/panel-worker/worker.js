// Buero-Panel API - Cloudflare Worker
//
// Verbindet das webbasierte Kontrollpanel (Browser, ueberall im Internet
// erreichbar) mit der lokalen Buero-Automation auf Daniels Laptop, die keine
// eigene oeffentliche IP hat und nicht direkt aus dem Internet erreichbar sein
// soll. Der Worker ist reine Vermittlungsstelle (KV als Briefkasten):
//
//   Panel (Browser)              Worker (KV)              Laptop (panel-sync.ps1)
//   ------------------            -----------              -----------------------
//   GET  /api/status    <---  "status"-Eintrag   <---  POST /api/sync (pusht Status)
//   POST /api/command   --->  "commands"-Queue   --->  GET  /api/sync (holt Kommandos ab)
//                                                       POST /api/sync (quittiert sie)
//
// Zwei getrennte Geheimnisse: PANEL_PASSWORD (Mensch im Browser, per ?pw=)
// und SYNC_SECRET (nur der Laptop kennt es, per ?secret=) - ein geleaktes
// Panel-Passwort erlaubt dadurch nie, sich als Laptop auszugeben und beliebige
// Status-Daten unterzuschieben.

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function json(data, status = 200) {
  // charset=utf-8 explizit im Content-Type: ohne das dekodiert Invoke-RestMethod
  // in Windows PowerShell 5.1 UTF-8-Antworten falsch (Mojibake bei Umlauten/ss)
  // - dieselbe Falle wie bei Invoke-ClaudeMessages in common.ps1.
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...CORS_HEADERS },
  });
}

const ERLAUBTE_KOMMANDOS = new Set([
  "pauseEmployee",
  "reactivateEmployee",
  "setThreshold",
  "addEmployeeNote",
  "triggerRun",
  "requestFix",
  "confirmFix",
]);

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: CORS_HEADERS });
    }

    // --- Panel (Browser, Passwort) ---
    if (url.pathname === "/api/status" && request.method === "GET") {
      if (url.searchParams.get("pw") !== env.PANEL_PASSWORD) {
        return json({ error: "Falsches Passwort" }, 401);
      }
      const status = (await env.PANEL_DATA.get("status")) || "null";
      return json({ status: JSON.parse(status) });
    }

    if (url.pathname === "/api/command" && request.method === "POST") {
      let body;
      try {
        body = await request.json();
      } catch {
        return json({ error: "Ungueltiges JSON" }, 400);
      }
      if (body.pw !== env.PANEL_PASSWORD) {
        return json({ error: "Falsches Passwort" }, 401);
      }
      if (!ERLAUBTE_KOMMANDOS.has(body.type)) {
        return json({ error: "Unbekannter Kommandotyp" }, 400);
      }
      const commandsRaw = (await env.PANEL_DATA.get("commands")) || "[]";
      const commands = JSON.parse(commandsRaw);
      commands.push({
        id: crypto.randomUUID(),
        type: body.type,
        payload: body.payload || {},
        createdAt: new Date().toISOString(),
      });
      await env.PANEL_DATA.put("commands", JSON.stringify(commands));
      return json({ ok: true });
    }

    // --- Laptop (panel-sync.ps1, eigenes Geheimnis) ---
    if (url.pathname === "/api/sync" && request.method === "GET") {
      if (url.searchParams.get("secret") !== env.SYNC_SECRET) {
        return json({ error: "Falsches Secret" }, 401);
      }
      const commandsRaw = (await env.PANEL_DATA.get("commands")) || "[]";
      return json({ commands: JSON.parse(commandsRaw) });
    }

    if (url.pathname === "/api/sync" && request.method === "POST") {
      if (url.searchParams.get("secret") !== env.SYNC_SECRET) {
        return json({ error: "Falsches Secret" }, 401);
      }
      let body;
      try {
        body = await request.json();
      } catch {
        return json({ error: "Ungueltiges JSON" }, 400);
      }
      if (body.status) {
        await env.PANEL_DATA.put("status", JSON.stringify(body.status));
      }
      if (Array.isArray(body.appliedCommandIds) && body.appliedCommandIds.length > 0) {
        const commandsRaw = (await env.PANEL_DATA.get("commands")) || "[]";
        const commands = JSON.parse(commandsRaw).filter(
          (c) => !body.appliedCommandIds.includes(c.id)
        );
        await env.PANEL_DATA.put("commands", JSON.stringify(commands));
      }
      return json({ ok: true });
    }

    return json({ error: "Nicht gefunden" }, 404);
  },
};
