#!/usr/bin/env python3
"""
Social-Lead-Scout – einmaliges Aufräumen des Altbestands.

Die ersten Läufe (vor Einführung der Claude-Relevanzprüfung, siehe
social_lead_scout.py) haben noch viele Fehltreffer (generische Forums-
Themenlisten, Jobanzeigen, Vertreter-Werbung) ins Google Sheet geschrieben.
Dieses Skript holt alle aktuell "neu"/"in Bearbeitung" markierten Treffer
per social_lead_list, prüft jeden nachträglich mit derselben Claude-Logik
und setzt Fehltreffer auf Status "kein Interesse" (landet damit automatisch
im Archiv-Tab im Panel) - es wird nichts gelöscht, nur der Status geändert.

Manuell auslösbar über den Workflow social-lead-cleanup.yml (Actions-Tab,
"Run workflow") - kein Cron, da nur bei Bedarf noetig.
"""
import os
import sys
import time

import requests

try:
    import anthropic
except ImportError:
    anthropic = None

from social_lead_scout import RELEVANZ_PROMPT, CLAUDE_MODEL


def ist_relevant(client, thema, titel):
    try:
        resp = client.messages.create(
            model=CLAUDE_MODEL,
            max_tokens=5,
            messages=[{"role": "user", "content": RELEVANZ_PROMPT.format(thema=thema, titel=titel, snippet=titel)}],
        )
        return resp.content[0].text.strip().upper().startswith("JA")
    except Exception as e:
        print(f"⚠️  Pruefung fehlgeschlagen ({e}) - Treffer bleibt sicherheitshalber wie er ist.")
        return None


def run():
    apps_script_url = os.environ.get("APPS_SCRIPT_URL", "").strip()
    secret = os.environ.get("SOCIAL_SCOUT_SECRET", "").strip()
    anthropic_key = os.environ.get("ANTHROPIC_API_KEY", "").strip()

    if not apps_script_url or not secret:
        print("❌ APPS_SCRIPT_URL/SOCIAL_SCOUT_SECRET fehlen.")
        sys.exit(1)
    if not anthropic_key or anthropic is None:
        print("❌ ANTHROPIC_API_KEY fehlt oder anthropic-Paket nicht installiert - Aufräumen ohne Relevanzprüfung ergibt keinen Sinn.")
        sys.exit(1)

    client = anthropic.Anthropic(api_key=anthropic_key)

    resp = requests.post(apps_script_url, json={"action": "social_lead_list", "secret": secret}, timeout=45)
    resp.raise_for_status()
    data = resp.json()
    if not data.get("ok"):
        print(f"❌ Konnte Leads nicht laden: {data.get('err')}")
        sys.exit(1)

    leads = data.get("leads", [])
    zu_pruefen = [l for l in leads if l.get("status") in ("neu", "in Bearbeitung")]
    print(f"🔎 {len(zu_pruefen)} von {len(leads)} Treffern werden geprüft ...")

    archiviert = 0
    behalten = 0
    unklar = 0

    for lead in zu_pruefen:
        relevant = ist_relevant(client, lead.get("thema", ""), lead.get("titel", ""))
        if relevant is None:
            unklar += 1
            continue
        if relevant:
            behalten += 1
            continue

        for versuch in range(1, 4):
            try:
                upd = requests.post(
                    apps_script_url,
                    json={"action": "social_lead_update", "secret": secret, "id": lead["id"], "status": "kein Interesse"},
                    timeout=30,
                )
                upd.raise_for_status()
                if upd.json().get("ok"):
                    archiviert += 1
                else:
                    print(f"⚠️  Update fehlgeschlagen für {lead['id']}: {upd.json()}")
                break
            except Exception as e:
                print(f"⚠️  Update-Versuch {versuch}/3 fehlgeschlagen für {lead['id']}: {e}")
                if versuch < 3:
                    time.sleep(3)
        time.sleep(0.3)  # Anthropic-Rate-Limit schonen

    print(f"✅ Fertig: {archiviert} archiviert (kein Interesse), {behalten} behalten, {unklar} unklar/übersprungen.")


if __name__ == "__main__":
    run()
