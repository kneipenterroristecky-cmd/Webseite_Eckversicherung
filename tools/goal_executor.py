"""
goal_executor.py – Günstige Alternative zu claude-code-action.
Ein einziger Claude API-Call statt eines autonomen Agenten.
Kosten: ~2-5 Cent pro Aufruf statt mehrere Euro.
"""
import os
import re
import sys
from pathlib import Path

import anthropic

REPO_ROOT = Path(".")
TEMPLATE_FILE = "grundfaehigkeitsversicherung.html"
MAX_TEMPLATE_LINES = 320


def read_file(path, max_lines=None):
    try:
        with open(path, encoding="utf-8") as f:
            lines = f.readlines()
            if max_lines:
                lines = lines[:max_lines]
            return "".join(lines)
    except Exception:
        return None


def write_file(path_str, content):
    path = Path(path_str)
    if ".." in path.parts or path.is_absolute():
        print(f"Übersprungen (unsicherer Pfad): {path_str}")
        return False
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)
    return True


def build_context(goal: str) -> str:
    goal_lower = goal.lower()

    # Liste aller vorhandenen HTML-Dateien
    html_files = sorted(f.name for f in REPO_ROOT.glob("*.html"))

    # Template für neue Seiten
    template = read_file(TEMPLATE_FILE, MAX_TEMPLATE_LINES) or ""

    # Bereits erwähnte Dateien direkt einlesen (für Änderungen an bestehenden Seiten)
    extra_files = {}
    for fname in html_files:
        name_clean = fname.replace(".html", "").replace("-", " ").replace("_", " ")
        if name_clean in goal_lower or fname.replace(".html", "") in goal_lower:
            content = read_file(fname)
            if content:
                extra_files[fname] = content

    parts = [
        f"Vorhandene HTML-Seiten: {', '.join(html_files)}",
        "",
        f"Template ({TEMPLATE_FILE}, erste {MAX_TEMPLATE_LINES} Zeilen):",
        template,
    ]

    for fname, content in extra_files.items():
        parts += ["", f"Inhalt von {fname}:", content]

    return "\n".join(parts)


SYSTEM_PROMPT = """Du bist Webentwickler für die Webseite von Daniel Eck (Versicherungsmakler, Nürnberg/Schmalkalden).

WICHTIG: Stelle NIEMALS Rückfragen. Interpretiere das Goal bestmöglich und erstelle sofort die Dateien.

Antworte NUR mit Datei-Blöcken in diesem Format – keine Erklärungen, kein Fließtext, keine Fragen:

<file path="dateiname.html">
vollständiger Dateiinhalt
</file>

Regeln:
- Dateiname: kleinbuchstaben, bindestrich statt leerzeichen, z.B. "tier-op-versicherung.html"
- Design exakt wie das Template (gleiche CSS-Klassen, gleiche Struktur, gleiche Sektionen)
- Vollständige HTML-Dateien – keine Platzhalter, kein "...", kein Abkürzen
- Bilder: Pexels-URLs (https://images.pexels.com/photos/ID/pexels-photo-ID.jpeg?auto=compress&cs=tinysrgb&w=800), thematisch passend, hell und lebendig
- Sprache: Deutsch, professionell, Ich-Perspektive ("ich prüfe für Sie", "ich vergleiche")
- Titel-Format: "Versicherungsname – Daniel Eck – Versicherungsmakler"
- Navbar, Topbar, Footer identisch zum Template kopieren
- Bei mehreren Seiten: alle in separaten <file> Blöcken ausgeben"""


def main():
    goal = os.environ.get("GOAL", "").strip()
    if not goal:
        print("Fehler: GOAL Umgebungsvariable nicht gesetzt.")
        sys.exit(1)

    print(f"Goal: {goal}")

    context = build_context(goal)
    user_message = f"Goal: {goal}\n\n{context}"

    print(f"Kontext: {len(user_message):,} Zeichen (~{len(user_message)//4:,} Tokens)")

    client = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])

    response = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=8192,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": user_message}],
    )

    output = response.content[0].text
    print(f"Response: {len(output):,} Zeichen")
    print(f"Tokens: {response.usage.input_tokens} input / {response.usage.output_tokens} output")

    # Kosten schätzen (Haiku: $0.80/MTok input, $4/MTok output)
    cost_usd = (response.usage.input_tokens * 0.8 + response.usage.output_tokens * 4) / 1_000_000
    print(f"Geschätzte Kosten: ${cost_usd:.4f} (~{cost_usd * 0.92:.4f} EUR)")

    # Datei-Blöcke parsen
    pattern = re.compile(r'<file path="([^"]+)">(.*?)</file>', re.DOTALL)
    files_written = []

    for match in pattern.finditer(output):
        file_path = match.group(1).strip()
        file_content = match.group(2).strip()
        if write_file(file_path, file_content):
            files_written.append(file_path)
            print(f"✓ Geschrieben: {file_path}")

    if not files_written:
        print("\nKeine Dateien erstellt. Response-Anfang:")
        print(output[:800])
        sys.exit(1)

    print(f"\nFertig: {len(files_written)} Datei(en) erstellt/geändert.")


if __name__ == "__main__":
    main()
