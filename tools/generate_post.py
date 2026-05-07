#!/usr/bin/env python3
"""
Erstellt einen wöchentlichen Blog-Beitrag mit Claude (KI) im Stil von Daniel Eck.
"""
import os, json, re, datetime, anthropic

SITE_URL = os.environ.get("SITE_URL", "https://kneipenterroristecky-cmd.github.io/Webseite_Eckversicherung")

# ── Thema der Woche bestimmen ─────────────────────────────────────────────────
with open("tools/topics.json", encoding="utf-8") as f:
    topics = json.load(f)

# Saisonales Thema: Monat bestimmt die Themengruppe, Woche im Monat den Beitrag
today_preview = datetime.date.today()
month_key = str(today_preview.month)
week_of_month = (today_preview.day - 1) // 7  # 0=Woche1 … 3=Woche4
month_topics = topics[month_key]
topic = month_topics[week_of_month % len(month_topics)]

print(f"📌 Thema diese Woche: {topic['title']}")

# ── Bild-URLs aus topics.json (stabile Unsplash-CDN-URLs) ─────────────────────
og_image = topic.get("og_image", "https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=1200&h=630&fit=crop&auto=format")
_og_base = og_image.split("?")[0]
og_image = f"{_og_base}?w=1200&h=630&fit=crop&auto=format"
ig_img_url_global = f"{_og_base}?w=1080&h=1080&fit=crop&auto=format"
print(f"   📸 Bild: {_og_base}")

# ── Blog-Beitrag schreiben ────────────────────────────────────────────────────
client = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])

beitrag = client.messages.create(
    model="claude-opus-4-5",
    max_tokens=4000,
    messages=[{
        "role": "user",
        "content": f"""Du bist ich – Daniel Eck, Versicherungsmakler aus Schmalkalden (Daniel Eck – Versicherungsmakler, Talstraße 73).

Hintergrund (nur intern, nicht explizit erwähnen):
- Unser Betrieb existiert seit 2002, mein Vater hat ihn gegründet, ich führe ihn weiter
- Das Unternehmen steht für jahrzehntelange Erfahrung – das darf ruhig anklingen
- Mein eigenes Einsteigsjahr NICHT erwähnen – einfach selbstbewusst als Makler schreiben

Schreibe einen kompakten, praxisnahen Blog-Beitrag in der Ich-Perspektive über: **{topic['title']}**

Wichtig: Schreibe immer aus der Ich-Perspektive. Nicht "Daniel Eck empfiehlt" sondern "Ich empfehle".
Der Leser wird mit „Sie" angesprochen – IMMER großgeschrieben: „Sie", „Ihr", „Ihnen", „Ihre". Niemals kleinschreiben.

Schreibstil:
- Persönlich, direkt – wie ein kurzes Gespräch unter vier Augen
- Kein Fachchinesisch, keine seltenen Fremdwörter oder Juristenwörter – nur alltagstaugliche Sprache die jeder versteht
- Konkrete Tipps und Zahlen, keine leeren Floskeln
- Ehrlich: Fallstricke und Nachteile nicht verschweigen

Struktur (nur HTML-Content, KEINE komplette HTML-Seite):
- Einleitung: 2-3 Sätze, direkt ins Thema (als <p>)
- 3 Abschnitte mit <h2>-Überschrift und je 2 knappen <p>-Absätzen
- Eine <ul>-Liste mit 5-6 konkreten Tipps
- Abschluss: 1-2 Sätze mit persönlicher Einladung – OHNE Telefonnummer, Adresse oder Verweis auf die Seite. Einfach natürlich enden, z.B. "Das schaue ich gerne gemeinsam mit Ihnen durch." oder "Sprechen Sie mich einfach an."

Grundsatz für den gesamten Text: Ich prüfe das FÜR die Kunden – nicht "das sollten Sie selbst tun" sondern "das prüfe ich für Sie". Der Kunde muss sich um nichts kümmern, ich übernehme das. Beispiel statt "Das sollten Sie auch tun:" lieber "Das prüfe ich für Sie:" oder "Das schaue ich bei jedem Vertrag durch:".

Ziel: ca. 300-400 Wörter – prägnant, kein Fülltext.
Gib NUR den HTML-Inhalt aus (h2, p, ul, li Tags). Kein html/head/body."""
    }]
)
content_html = beitrag.content[0].text

# ── Meta-Daten für Social Media generieren ────────────────────────────────────
meta_msg = client.messages.create(
    model="claude-haiku-4-5-20251001",
    max_tokens=1200,
    messages=[{
        "role": "user",
        "content": f"""Für einen Blog-Beitrag von Versicherungsmakler Daniel Eck (Daniel Eck – Versicherungsmakler Schmalkalden) über "{topic['title']}" erstelle kurze, knackige Social-Media-Texte in der Ich-Perspektive.

WICHTIG: Die Social-Media-Texte müssen inhaltlich EXAKT zum folgenden Artikel passen – insbesondere die genannte Versicherungsart (z.B. Gebäudeversicherung, Hausrat, KFZ etc.) muss übereinstimmen. Nichts erfinden was nicht im Artikel steht.

Artikelinhalt:
{content_html}

Ausgabe als JSON (keine weiteren Erklärungen):
{{
  "title": "Überschrift max 60 Zeichen",
  "social_summary": "Facebook-Post: max 120 Zeichen, Ich-Form, ein einziger Satz mit Mehrwert. IMMER Sie/Ihnen/Ihre (niemals du/dich)",
  "instagram_caption": "Instagram-Caption mit echtem Mehrwert – da kein direkter Link möglich ist, muss der Text alleine überzeugen. Aufbau: 1 starker Einstiegssatz, dann 3-4 konkrete Punkte oder Tipps aus dem Artikel (als kurze Absätze mit Zeilenumbrüchen), abschließend ein Satz der zum Handeln einlädt (z.B. 'Schreiben Sie mir einfach.' oder 'Ich schaue das gerne für Sie durch.'). Danach Leerzeile + 7-10 passende Hashtags. Gesamtlänge: 600-900 Zeichen. IMMER Sie/Ihnen/Ihre (niemals du/dich). Hashtags NUR korrekte deutsche Wörter, keine Abkürzungen. z.B. #Versicherung #Elementarschutz #Schmalkalden #Versicherungsmakler",
  "slug": "url-freundlicher-dateiname-ohne-umlaute-nur-bindestriche",
  "ig_before": "Schlagzeile vor dem Highlight, max 20 Zeichen, kann leer sein",
  "ig_highlight": "Ein markantes Wort oder kurze Phrase die blau hervorgehoben wird, max 15 Zeichen",
  "ig_after": "Optionaler Text nach dem Highlight, max 20 Zeichen, kann leer sein",
  "ig_sub": "Kurzer Untertitel für das Bild, max 80 Zeichen, Ich-Form, IMMER Sie/Ihnen/Ihre (niemals du/dich)",
  "ig_cta": "CTA-Button Text, max 28 Zeichen, mit Pfeil am Ende z.B. →"
}}"""
    }]
)

raw = meta_msg.content[0].text
match = re.search(r'\{.*\}', raw, re.DOTALL)
meta = json.loads(match.group())

# ── Social-Media-Bild HTML erstellen ─────────────────────────────────────────
LABEL_EMOJIS = {
    "KFZ": "🚗", "Vorsorge": "🛡️", "Kranken": "🏥",
    "Privat": "🏠", "Gewerbe": "🏢", "Ratgeber": "📋"
}
emoji = LABEL_EMOJIS.get(topic["label"], "📋")
ig_before   = meta.get("ig_before", "").strip()
ig_highlight = meta.get("ig_highlight", "").strip()
ig_after    = meta.get("ig_after", "").strip()
ig_sub      = meta.get("ig_sub", meta.get("social_summary", "")[:80]).strip()
ig_cta      = meta.get("ig_cta", "Jetzt beraten lassen →").strip()

h1_lines = []
if ig_before:
    h1_lines.append(ig_before)
if ig_highlight:
    h1_lines.append(f'<span>{ig_highlight}</span>')
if ig_after:
    h1_lines.append(ig_after)
h1_content = "<br>".join(h1_lines) if h1_lines else meta["title"]

ig_img_url = ig_img_url_global

social_html = f"""<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8" />
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700;800;900&display=swap" rel="stylesheet" />
<style>
  * {{ margin: 0; padding: 0; box-sizing: border-box; }}
  body {{ width: 1080px; height: 1080px; overflow: hidden; font-family: 'Inter', Arial, sans-serif; }}
  .wrap {{ width: 1080px; height: 1080px; position: relative; }}
  .bg-img {{ position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }}
  .overlay {{ position: absolute; inset: 0; background: linear-gradient(to bottom, rgba(10,25,50,.08) 0%, rgba(10,25,50,.45) 45%, rgba(10,25,50,.93) 100%); }}
  .content {{ position: absolute; inset: 0; display: flex; flex-direction: column; justify-content: flex-end; padding: 64px; }}
  .tag {{ display: inline-flex; align-items: center; gap: 10px; background: rgba(33,103,204,.4); border: 1px solid rgba(100,160,255,.5); color: #a8d0ff; font-size: 28px; font-weight: 700; padding: 10px 28px; border-radius: 100px; letter-spacing: .06em; text-transform: uppercase; width: fit-content; margin-bottom: 36px; }}
  h1 {{ font-size: 108px; font-weight: 900; color: #fff; line-height: 1.04; margin-bottom: 30px; letter-spacing: -.025em; }}
  h1 span {{ color: #4d9fff; }}
  .sub {{ font-size: 40px; color: rgba(255,255,255,.78); font-weight: 500; line-height: 1.5; max-width: 920px; }}
</style>
</head>
<body>
<div class="wrap">
  <img class="bg-img" src="{ig_img_url}" />
  <div class="overlay"></div>
  <div class="content">
    <div class="tag">{emoji} {topic['label']}</div>
    <h1>{h1_content}</h1>
    <p class="sub">{ig_sub}</p>
  </div>
</div>
</body>
</html>"""

os.makedirs("social", exist_ok=True)
with open("social/latest-ig.html", "w", encoding="utf-8") as f:
    f.write(social_html)
print("✅ Social Image HTML erstellt: social/latest-ig.html")

# ── HTML-Datei erstellen ──────────────────────────────────────────────────────
today = datetime.date.today()
date_de = today.strftime("%d.%m.%Y")
date_iso = today.isoformat()
filename = f"{date_iso}-{meta['slug']}.html"
post_url = f"{SITE_URL}/blog/posts/{filename}"


social_image_url = f"{SITE_URL.rstrip('/')}/social/latest-ig.png"

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
    .replace("{{OG_IMAGE}}", og_image)
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
    "unsplash_query": topic.get("unsplash_query", "insurance finance"),
    "og_image": og_image,
    "social_image_url": social_image_url
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
