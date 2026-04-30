#!/usr/bin/env python3
"""
Erstellt einen wöchentlichen Blog-Beitrag mit Claude (KI) im Stil von Daniel Eck.
"""
import os, json, re, datetime, anthropic

SITE_URL = os.environ.get("SITE_URL", "https://kneipenterroristecky-cmd.github.io/Webseite_Eckversicherung")

# ── Thema der Woche bestimmen ─────────────────────────────────────────────────
with open("tools/topics.json", encoding="utf-8") as f:
    topics = json.load(f)

# Rotiert automatisch durch alle Themen (Kalenderwoche als Index)
week = datetime.date.today().isocalendar()[1]
topic = topics[week % len(topics)]

print(f"📌 Thema diese Woche: {topic['title']}")

# ── Blog-Beitrag schreiben ────────────────────────────────────────────────────
client = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])

beitrag = client.messages.create(
    model="claude-opus-4-5",
    max_tokens=2500,
    messages=[{
        "role": "user",
        "content": f"""Du bist Daniel Eck, Versicherungsmakler aus Schmalkalden (VersicherungsEck, Talstraße 73).
Du führst einen unabhängigen Versicherungsmaklerbetrieb in 3. Generation.

Schreibe einen praxisnahen Blog-Beitrag auf Deutsch über: **{topic['title']}**

Dein Schreibstil:
- Persönlich und direkt, du sprichst den Leser mit „Sie" an
- Kein Fachchinesisch – einfache, klare Sprache
- Echte Tipps aus deinem Makleralltag, konkrete Beispiele
- Du bist ehrlich: auch wenn etwas kompliziert ist, sagst du es
- Keine leeren Floskeln wie „In der heutigen schnelllebigen Zeit..."

Struktur (nur HTML-Content, KEINE komplette HTML-Seite):
- Einleitung: 2-3 Sätze die direkt in das Thema einsteigen (als <p>)
- 3-4 Abschnitte mit <h2>-Überschrift und 2-3 <p>-Absätzen
- Falls passend: eine <ul>-Liste mit konkreten Tipps
- Abschluss: kurzer persönlicher Abschnitt mit Einladung zum Gespräch

Gib NUR den HTML-Inhalt aus (h2, p, ul, li Tags). Kein html/head/body."""
    }]
)
content_html = beitrag.content[0].text

# ── Meta-Daten für Social Media generieren ────────────────────────────────────
meta_msg = client.messages.create(
    model="claude-haiku-4-5-20251001",
    max_tokens=500,
    messages=[{
        "role": "user",
        "content": f"""Für einen Blog-Beitrag von Versicherungsmakler Daniel Eck über "{topic['title']}" erstelle:

Ausgabe als JSON (keine weiteren Erklärungen):
{{
  "title": "Überschrift max 65 Zeichen",
  "social_summary": "Teaser für Facebook max 180 Zeichen, persönlich und neugierig machend",
  "instagram_caption": "Caption max 280 Zeichen + Zeilenumbruch + 6 deutsche Hashtags wie #Versicherung #Schmalkalden",
  "slug": "url-freundlicher-dateiname-ohne-umlaute-nur-bindestriche"
}}"""
    }]
)

raw = meta_msg.content[0].text
match = re.search(r'\{.*\}', raw, re.DOTALL)
meta = json.loads(match.group())

# ── HTML-Datei erstellen ──────────────────────────────────────────────────────
today = datetime.date.today()
date_de = today.strftime("%d.%m.%Y")
date_iso = today.isoformat()
filename = f"{date_iso}-{meta['slug']}.html"
post_url = f"{SITE_URL}/blog/posts/{filename}"

with open("tools/blog_post_template.html", encoding="utf-8") as f:
    template = f.read()

html = (template
    .replace("{{TITLE}}", meta['title'])
    .replace("{{DATE_DE}}", date_de)
    .replace("{{DATE_ISO}}", date_iso)
    .replace("{{TOPIC_LABEL}}", topic['label'])
    .replace("{{CONTENT}}", content_html)
    .replace("{{POST_URL}}", post_url)
    .replace("{{SLUG}}", meta['slug'])
)

os.makedirs("blog/posts", exist_ok=True)
with open(f"blog/posts/{filename}", "w", encoding="utf-8") as f:
    f.write(html)

# ── Metadaten speichern (für publish_post.py) ─────────────────────────────────
draft_meta = {
    "filename": filename,
    "title": meta['title'],
    "date_de": date_de,
    "date_iso": date_iso,
    "slug": meta['slug'],
    "social_summary": meta['social_summary'],
    "instagram_caption": meta['instagram_caption'],
    "post_url": post_url,
    "topic": topic['title'],
    "label": topic['label'],
    "unsplash_query": topic.get("unsplash_query", "insurance finance")
}

with open("tools/draft_meta.json", "w", encoding="utf-8") as f:
    json.dump(draft_meta, f, ensure_ascii=False, indent=2)

# ── GitHub Actions Outputs ────────────────────────────────────────────────────
with open(os.environ.get("GITHUB_OUTPUT", "/dev/null"), "a") as fh:
    fh.write(f"post_filename={filename}\n")
    fh.write(f"post_title={meta['title']}\n")

print(f"\n✅ Entwurf erstellt: blog/posts/{filename}")
print(f"📝 Titel: {meta['title']}")
print(f"🔗 URL: {post_url}")
