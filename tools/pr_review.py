#!/usr/bin/env python3
"""
Herr Brandt (Abteilungsleitung PR & Social Media) prueft Nadines Text und
Jonas' Bilder, BEVOR die Freigabe-Anfrage per WhatsApp an Daniel geht - genau
wie Frau Berger/Herr Wagner/Herr Klein ihre Abteilung pruefen, bevor etwas bei
Frau Nowak/Daniel landet.

Findet er ein Problem, meldet er es an dieselbe "prFindings"-Warteschlange im
Panel-Worker, die panel-sync.ps1 regelmaessig abholt und in Frau Nowaks
normale Tagespruefung einspeist (siehe buero-automation: common.ps1,
Sync-PrFindings). Dieses Skript beendet sich dann mit Exit-Code 1 - die
nachfolgenden Workflow-Schritte (Metadaten vorbereiten, WhatsApp-Freigabe
senden) werden dadurch automatisch uebersprungen, ohne dass es dafuer eigene
if-Bedingungen braucht. Der Entwurf selbst bleibt trotzdem im Repository
committet (das passiert im Schritt davor) - nur die Freigabe-Anfrage an
Daniel wird zurueckgehalten.
"""
import json
import os
import re
import sys

import requests

PANEL_WORKER_URL = os.environ.get("PANEL_WORKER_URL", "").rstrip("/")
PANEL_SYNC_SECRET = os.environ.get("PANEL_SYNC_SECRET", "")
ABTEILUNG = "Herr Brandt (PR & Social Media)"


def melde_befund(text):
    print(f"  Befund: {text}")
    if not PANEL_WORKER_URL or not PANEL_SYNC_SECRET:
        return
    try:
        requests.post(
            f"{PANEL_WORKER_URL}/api/pr-finding",
            params={"secret": PANEL_SYNC_SECRET},
            json={"department": ABTEILUNG, "finding": text},
            timeout=10,
        )
    except Exception as e:
        print(f"  (Befund konnte nicht ans Panel gemeldet werden: {e})")


probleme = []

# ── 1. Meta-Daten pruefen ─────────────────────────────────────────────────
try:
    with open("tools/draft_meta.json", encoding="utf-8") as f:
        meta = json.load(f)
except Exception as e:
    print(f"❌ draft_meta.json konnte nicht gelesen werden: {e}")
    melde_befund(f"draft_meta.json konnte nicht gelesen werden: {e}")
    sys.exit(1)

PFLICHTFELDER = ["filename", "title", "date_de", "instagram_caption", "social_summary"]
for feld in PFLICHTFELDER:
    wert = meta.get(feld)
    if not wert or (isinstance(wert, str) and not wert.strip()):
        probleme.append(f"Pflichtfeld '{feld}' fehlt oder ist leer in draft_meta.json.")

PLATZHALTER = ["TODO", "LOREM IPSUM", "PLACEHOLDER", "{{", "[BILD]", "XXX"]
pruef_texte = {
    "title": meta.get("title") or "",
    "instagram_caption": meta.get("instagram_caption") or "",
    "social_summary": meta.get("social_summary") or "",
}
for feldname, text in pruef_texte.items():
    for marker in PLATZHALTER:
        if marker in text.upper():
            probleme.append(f"Platzhaltertext '{marker}' im Feld '{feldname}' gefunden.")

# ── 2. Blog-Datei pruefen ─────────────────────────────────────────────────
blog_pfad = None
if not meta.get("filename"):
    probleme.append("Kein Dateiname (filename) in draft_meta.json hinterlegt.")
else:
    blog_pfad = os.path.join("blog", "posts", meta["filename"])
    if not os.path.exists(blog_pfad):
        probleme.append(f"Blog-Datei nicht gefunden: {blog_pfad}")
    elif os.path.getsize(blog_pfad) < 500:
        probleme.append(f"Blog-Datei verdächtig klein ({os.path.getsize(blog_pfad)} Bytes): {blog_pfad}")

# ── 3. Social-Media-Bilder pruefen ────────────────────────────────────────
BILDER = ["social/latest-ig.png", "social/latest-ig-heiko.png", "social/latest-ig-beide.png"]
for pfad in BILDER:
    if not os.path.exists(pfad):
        probleme.append(f"Social-Media-Bild fehlt: {pfad}")
    elif os.path.getsize(pfad) < 20_000:
        probleme.append(f"Social-Media-Bild verdächtig klein ({os.path.getsize(pfad)//1024} KB), möglicherweise fehlerhaft gerendert: {pfad}")

# ── 4. Inhaltliche KI-Prüfung (nur wenn die technischen Prüfungen sauber sind -
# spart den API-Aufruf, wenn ohnehin schon ein technisches Problem feststeht) ──
api_key = os.environ.get("ANTHROPIC_API_KEY", "")
if not probleme and api_key and blog_pfad:
    try:
        import anthropic
        client = anthropic.Anthropic(api_key=api_key)
        with open(blog_pfad, encoding="utf-8") as f:
            blog_html = f.read()
        pruef_msg = client.messages.create(
            model="claude-haiku-4-5",
            max_tokens=400,
            messages=[{
                "role": "user",
                "content": f"""Prüfe folgenden Blog-Beitrag und die Instagram-Caption eines Versicherungsmaklers auf offensichtliche Fehler: Rechtschreib-/Grammatikfehler, abgebrochene oder unsinnige Sätze, Wiederholungen, oder inhaltliche Widersprüche zwischen Titel und Text.

Titel: {meta.get('title', '')}

Blog-HTML:
{blog_html}

Instagram-Caption:
{meta.get('instagram_caption', '')}

Antworte NUR als JSON: {{"ok": true}} wenn alles in Ordnung ist, sonst {{"ok": false, "problem": "kurze konkrete Beschreibung des Fehlers"}}"""
            }]
        )
        raw = pruef_msg.content[0].text
        match = re.search(r'\{.*\}', raw, re.DOTALL)
        ergebnis = json.loads(match.group()) if match else {"ok": True}
        if not ergebnis.get("ok", True):
            probleme.append(f"Inhaltliche Prüfung: {ergebnis.get('problem', 'unbekanntes Problem')}")
    except Exception as e:
        print(f"⚠️  KI-Inhaltsprüfung übersprungen (Fehler: {e}) - technische Prüfungen waren aber unauffällig.")
elif not api_key:
    print("⚠️  ANTHROPIC_API_KEY nicht gesetzt - inhaltliche KI-Prüfung übersprungen, nur technische Prüfungen durchgeführt.")

# ── Ergebnis ───────────────────────────────────────────────────────────────
if probleme:
    print(f"❌ Herr Brandt hat {len(probleme)} Problem(e) gefunden - Freigabe-Anfrage an Daniel wird NICHT verschickt:")
    for p in probleme:
        melde_befund(p)
    sys.exit(1)

print("✅ Herr Brandt: keine Probleme gefunden, Entwurf wird zur Freigabe an Daniel geschickt.")
