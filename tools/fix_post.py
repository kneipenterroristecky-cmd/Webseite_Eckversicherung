#!/usr/bin/env python3
"""
Nadine ueberarbeitet den aktuellen Blog-Entwurf gezielt anhand EINES
einzelnen Befunds von Herrn Brandt (ausgeloest ueber den Panel-Button
"Nadine soll aendern" -> /api/pr-finding-fix im panel-worker-Repo ->
.github/workflows/fix-pr-finding.yml, das dieses Skript aufruft und danach
tools/pr_review.py erneut laufen laesst).

Aendert bewusst NUR Artikeltext, Facebook-Text und Instagram-Caption -
Titel und Bild bleiben unangetastet (dafuer gibt es bereits Workflow 3,
request-changes.yml, inkl. Neu-Rendern des Social-Bilds).
"""
import json
import os
import re
import sys

import anthropic

FINDING = os.environ.get("FINDING", "").strip()
if not FINDING:
    print("Fehler: FINDING Umgebungsvariable nicht gesetzt.")
    sys.exit(1)

with open("tools/draft_meta.json", encoding="utf-8") as f:
    meta = json.load(f)

blog_pfad = os.path.join("blog", "posts", meta["filename"])
if not os.path.exists(blog_pfad):
    print(f"Entwurf '{meta['filename']}' existiert nicht mehr (bereits veroeffentlicht oder zurueckgezogen) - nichts zu aendern.")
    sys.exit(1)

with open(blog_pfad, encoding="utf-8") as f:
    blog_html = f.read()

# Dieselben Marker wie in tools/blog_post_template.html rund um {{CONTENT}} -
# so laesst sich der Artikeltext isoliert ersetzen, ohne den Rest der Seite
# (Header, Autor-Box, Footer) anzufassen.
CONTENT_START = 'class="blog-hero-img" />'
CONTENT_END = "<!-- Autor-Box -->"
start_idx = blog_html.find(CONTENT_START)
end_idx = blog_html.find(CONTENT_END)
if start_idx == -1 or end_idx == -1 or end_idx <= start_idx:
    print("Fehler: Artikeltext im Entwurf nicht gefunden (Template-Marker verschoben?).")
    sys.exit(1)
content_start = start_idx + len(CONTENT_START)
current_content_html = blog_html[content_start:end_idx].strip()

client = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])

prompt = f"""Du bist ich - Daniel Eck, Versicherungsmakler aus Schmalkalden. Du hast folgenden Blog-Beitrag und die dazugehoerigen Social-Media-Texte geschrieben:

Titel: {meta.get('title', '')}

Artikeltext (HTML):
{current_content_html}

Facebook-Text: {meta.get('social_summary', '')}

Instagram-Caption: {meta.get('instagram_caption', '')}

Herr Brandt (Abteilungsleitung PR & Social Media) hat bei der Pruefung folgenden Befund gemeldet:
"{FINDING}"

Korrigiere GENAU das, was der Befund beschreibt - alles andere (Stil, Laenge, uebrige Inhalte) bleibt unveraendert. Halte dich an dieselben Regeln wie beim ersten Entwurf: Ich-Perspektive, Sie-Anrede (immer gross: Sie/Ihnen/Ihre), keine Behauptung jahrzehntelanger eigener Erfahrung, Artikeltext nur als h2/p/ul/li-HTML-Fragment (keine komplette Seite, kein html/head/body).

Antworte in GENAU diesem Format (kein JSON, kein Markdown-Codeblock, nichts davor/danach), auch wenn ein Abschnitt inhaltlich unveraendert bleibt - dann diesen Abschnitt einfach identisch wiederholen:

===ARTIKELTEXT===
(hier der vollstaendige, korrigierte Artikeltext als HTML-Fragment)
===FACEBOOK===
(hier der Facebook-Text, eine Zeile)
===INSTAGRAM===
(hier die Instagram-Caption)
===ENDE==="""

resp = client.messages.create(
    model="claude-opus-4-5",
    max_tokens=4000,
    messages=[{"role": "user", "content": prompt}],
)
raw = resp.content[0].text


def extract_section(name, text):
    m = re.search(rf'==={name}===\s*(.*?)\s*(?====[A-Z]+===)', text, re.DOTALL)
    return m.group(1).strip() if m else None


new_content_html = extract_section("ARTIKELTEXT", raw)
new_facebook = extract_section("FACEBOOK", raw)
new_instagram = extract_section("INSTAGRAM", raw)

if not new_content_html:
    print("Fehler: kein Artikeltext im erwarteten Format erhalten.")
    print(raw[:500])
    sys.exit(1)

blog_html = blog_html[:content_start] + "\n\n    " + new_content_html + "\n\n    " + blog_html[end_idx:]
with open(blog_pfad, "w", encoding="utf-8") as f:
    f.write(blog_html)

if new_facebook:
    meta["social_summary"] = new_facebook
if new_instagram:
    meta["instagram_caption"] = new_instagram
with open("tools/draft_meta.json", "w", encoding="utf-8") as f:
    json.dump(meta, f, ensure_ascii=False, indent=2)

print(f"✅ Nadine hat den Entwurf ueberarbeitet - Befund: {FINDING[:120]}")
