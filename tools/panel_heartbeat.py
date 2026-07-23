#!/usr/bin/env python3
"""
Meldet dem Buero-Kontrollpanel (Cloudflare Worker), welcher PR-Mitarbeiter
gerade arbeitet - derselbe /api/heartbeat-Endpunkt, den auch Daniels
PowerShell-Automation (buero-automation: memory-ai.ps1, Send-EmployeeHeartbeat)
nutzt. Faellt bewusst niemals hart: ein Problem beim Melden darf den
eigentlichen Content-Job (Blog/Bild/Veroeffentlichung) nie zum Absturz
bringen.

Aufruf aus den GitHub-Actions-Workflows:
  python tools/panel_heartbeat.py nadine "schreibt den Blog-Beitrag"
  python tools/panel_heartbeat.py clear

Braucht die Umgebungsvariablen PANEL_WORKER_URL und PANEL_SYNC_SECRET
(Secrets im Repo) - fehlen sie, wird der Aufruf still uebersprungen.
"""
import os
import sys

import requests

PANEL_WORKER_URL = os.environ.get("PANEL_WORKER_URL", "").rstrip("/")
PANEL_SYNC_SECRET = os.environ.get("PANEL_SYNC_SECRET", "")


def heartbeat(employee, taetigkeit=None):
    if not PANEL_WORKER_URL or not PANEL_SYNC_SECRET:
        print("Panel-Heartbeat uebersprungen (PANEL_WORKER_URL/PANEL_SYNC_SECRET nicht gesetzt).")
        return
    try:
        requests.post(
            f"{PANEL_WORKER_URL}/api/heartbeat",
            params={"secret": PANEL_SYNC_SECRET},
            json={"employee": employee, "taetigkeit": taetigkeit},
            timeout=10,
        )
    except Exception as e:
        print(f"Panel-Heartbeat fehlgeschlagen (ignoriert): {e}")


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "clear":
        heartbeat(None)
    elif len(sys.argv) > 1:
        mitarbeiter = sys.argv[1]
        taetigkeit_arg = sys.argv[2] if len(sys.argv) > 2 else None
        heartbeat(mitarbeiter, taetigkeit_arg)
    else:
        print("Nutzung: panel_heartbeat.py <mitarbeiter> [taetigkeit]  ODER  panel_heartbeat.py clear")
