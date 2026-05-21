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


def get_filenames(client, goal: str) -> list[str]:
    """Kleiner Planungs-Call: welche Dateien sollen erstellt/geändert werden?"""
    response = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=100,
        system="Antworte nur mit HTML-Dateinamen (eine pro Zeile), keine Erklärungen. Dateinamen: kleinbuchstaben, bindestrich statt leerzeichen, .html Endung.",
        messages=[{"role": "user", "content": f"Welche HTML-Dateien müssen erstellt oder geändert werden?\nAuftrag: {goal}"}],
    )
    text = response.content[0].text
    files = re.findall(r'[\w-]+\.html', text)
    print(f"Geplante Dateien: {files}")
    return files


def generate_single_file(client, goal: str, filename: str, context: str) -> str | None:
    """Generiert genau eine HTML-Datei."""
    user_message = f"Erstelle NUR die Datei '{filename}'.\n\nAuftrag: {goal}\n\n{context}"
    response = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=8192,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": user_message}],
    )
    output = response.content[0].text
    cost = (response.usage.input_tokens * 0.8 + response.usage.output_tokens * 4) / 1_000_000
    print(f"  Tokens: {response.usage.input_tokens} in / {response.usage.output_tokens} out (~${cost:.4f})")

    # Vollständiger Block mit schließendem Tag
    pattern = re.compile(r'<file path="[^"]+">[\r\n]*(.*?)</file>', re.DOTALL)
    match = pattern.search(output)
    if match:
        return match.group(1).strip()

    # Abgeschnittener Block (kein schließendes </file>) – trotzdem den HTML-Inhalt nehmen
    truncated = re.compile(r'<file path="[^"]+">[\r\n]*(<!DOCTYPE.*)', re.DOTALL)
    match = truncated.search(output)
    if match:
        print("  Hinweis: Response abgeschnitten – HTML trotzdem gespeichert.")
        return match.group(1).strip()

    # Direktes HTML ohne file-Tag
    stripped = output.strip()
    if stripped.startswith("<!DOCTYPE") or stripped.startswith("<html"):
        return stripped

    print(f"  Kein HTML gefunden. Response-Anfang: {output[:200]}")
    return None


def main():
    goal = os.environ.get("GOAL", "").strip()
    if not goal:
        print("Fehler: GOAL Umgebungsvariable nicht gesetzt.")
        sys.exit(1)

    print(f"Goal: {goal}")

    client = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])
    context = build_context(goal)
    total_cost = 0.0

    # Schritt 1: Dateiliste ermitteln
    filenames = get_filenames(client, goal)
    if not filenames:
        print("Keine Dateinamen erkannt – versuche direkte Generierung.")
        filenames = ["output.html"]

    # Schritt 2: Jede Datei einzeln generieren
    files_written = []
    for fname in filenames:
        print(f"\n── Generiere: {fname}")
        content = generate_single_file(client, goal, fname, context)
        if content and write_file(fname, content):
            files_written.append(fname)
            print(f"  ✓ Geschrieben: {fname}")
        else:
            print(f"  ✗ Fehlgeschlagen: {fname}")

    if not files_written:
        print("\nKeine Dateien erstellt.")
        sys.exit(1)

    print(f"\nFertig: {len(files_written)} Datei(en) erstellt/geändert.")

    # Bild-Review wenn Bilder vorhanden
    if re.search(r'<img\s', output, re.IGNORECASE):
        print("\n── Bild-Review-Agent ────────────────────────────────")
        image_review(client, files_written, response.usage)


def image_review(client, files_written: list, prev_usage):
    """Zweiter fokussierter API-Call: prüft nur die Bild-URLs in den erstellten Dateien."""

    # Nur img-Tags aus den erstellten Dateien sammeln
    img_snippets = []
    for fname in files_written:
        content = read_file(fname) or ""
        imgs = re.findall(r'<img[^>]+src="([^"]+)"[^>]*>', content)
        if imgs:
            img_snippets.append(f"{fname}:\n" + "\n".join(f"  - {src}" for src in imgs))

    if not img_snippets:
        print("Keine Bilder gefunden – Review übersprungen.")
        return

    files_content = ""
    for fname in files_written:
        content = read_file(fname) or ""
        if "<img" in content:
            files_content += f"\n<file path=\"{fname}\">\n{content}\n</file>\n"

    review_prompt = f"""Prüfe die Bilder in diesen Dateien für eine Versicherungswebseite.

Bilder die verwendet wurden:
{chr(10).join(img_snippets)}

Kriterien:
- Passt das Bild thematisch EXAKT zum Seiteninhalt?
- Hell, lebendig, echte Situation (keine abstrakten Stock-Fotos)?
- Professionell und seriös?

Falls ein Bild NICHT passt: Gib die korrigierte Datei als <file path="...">...</file> Block aus.
Falls ALLE Bilder passen: Antworte nur mit: OK

{files_content}"""

    review_response = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=8192,
        system="Du bist Bildprüfer für eine Versicherungswebseite. Antworte entweder mit 'OK' oder mit korrigierten <file path=\"...\">...</file> Blöcken. Keine Erklärungen.",
        messages=[{"role": "user", "content": review_prompt}],
    )

    review_output = review_response.content[0].text.strip()
    cost = (review_response.usage.input_tokens * 0.8 + review_response.usage.output_tokens * 4) / 1_000_000
    print(f"Review-Tokens: {review_response.usage.input_tokens} input / {review_response.usage.output_tokens} output (~${cost:.4f})")

    if review_output.strip().upper() == "OK":
        print("✓ Alle Bilder geprüft und freigegeben.")
        return

    pattern = re.compile(r'<file path="([^"]+)">(.*?)</file>', re.DOTALL)
    for match in pattern.finditer(review_output):
        file_path = match.group(1).strip()
        file_content = match.group(2).strip()
        if write_file(file_path, file_content):
            print(f"✓ Bild korrigiert in: {file_path}")


if __name__ == "__main__":
    main()
