#!/usr/bin/env python3
"""
Regelkreis Nadine <-> Herr Brandt fuer EINEN Workflow-Lauf (Workflow 1
"Blog-Beitrag erstellen" ohne FINDING-Env: Herr Brandt prueft zuerst frisch -
oder Workflow 4 "Verursacher behebt PR-Befund" mit FINDING-Env: Nadine
behebt zuerst genau den vom Panel gemeldeten Befund). Bei einem Problem
ueberarbeitet Nadine sofort erneut und Herr Brandt prueft wieder - alles in
diesem einen Lauf, bis zu MAX_VERSUCHE mal.

Grund fuer die Obergrenze: Herr Brandts inhaltliche Pruefung ist bei jedem
Durchlauf ein frischer KI-Aufruf und kann theoretisch immer wieder eine neue
Kleinigkeit finden - ohne Obergrenze waere das ein potenziell endloser,
kostenpflichtiger Kreislauf (live am 2026-07-27 beobachtet: derselbe
Panel-Button wurde mehrfach geklickt, jedes Mal ein NEUER Befund statt einer
Freigabe). Nach MAX_VERSUCHE erfolglosen Versuchen wird Daniel GENAU EINMAL
informiert (Panel-Befund + WhatsApp-Sofortmeldung) statt bei jedem
Zwischenstand erneut.
"""
import os
import sys

from fix_post import ueberarbeite
from panel_heartbeat import heartbeat
from pr_review import lade_und_pruefe, melde_befund, sende_wa_sofortmeldung

MAX_VERSUCHE = int(os.environ.get("MAX_VERSUCHE", "3"))


def selbstheilung(erster_befund):
    finding = erster_befund
    probleme = []
    for versuch in range(1, MAX_VERSUCHE + 1):
        if finding:
            print(f"\n── Versuch {versuch}/{MAX_VERSUCHE}: Nadine überarbeitet ──")
            print(f"   Befund: {finding[:200]}")
            heartbeat("nadine", f"überarbeitet den Text (Versuch {versuch}/{MAX_VERSUCHE})")
            ueberarbeite(finding)

        print(f"── Versuch {versuch}/{MAX_VERSUCHE}: Herr Brandt prüft ──")
        heartbeat("brandt", f"prüft den Entwurf (Versuch {versuch}/{MAX_VERSUCHE})")
        probleme = lade_und_pruefe()
        if not probleme:
            print("✅ Herr Brandt: keine Probleme (mehr) gefunden.")
            heartbeat(None)
            return True

        print(f"❌ Herr Brandt: {len(probleme)} Problem(e) gefunden.")
        finding = " / ".join(probleme)

    print(f"\n⚠️ Nach {MAX_VERSUCHE} Versuchen weiterhin offen - Daniel wird einmalig informiert, kein weiterer automatischer Versuch.")
    heartbeat(None)
    for p in probleme:
        melde_befund(p)
    sende_wa_sofortmeldung(
        [f"Nach {MAX_VERSUCHE} automatischen Überarbeitungsversuchen weiterhin offen:"] + probleme
    )
    return False


if __name__ == "__main__":
    ok = selbstheilung(os.environ.get("FINDING", "").strip() or None)
    sys.exit(0 if ok else 1)
