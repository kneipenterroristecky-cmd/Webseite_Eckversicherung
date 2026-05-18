#!/usr/bin/env python3
"""
Erstellt einen wöchentlichen Blog-Beitrag mit Claude (KI) im Stil von Daniel Eck.
"""
import os, json, re, datetime, base64, requests, anthropic

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

# Portrait-Crop: Fokuspunkt aus topics.json nehmen wenn vorhanden, sonst KI-Analyse
_fp_x = topic.get("ig_fp_x")
_fp_y = topic.get("ig_fp_y")
if _fp_x is not None or _fp_y is not None:
    fp_x = _fp_x if _fp_x is not None else 0.5
    fp_y = _fp_y if _fp_y is not None else 0.5
    _ig_crop = f"crop=focalpoint&fp-x={fp_x}&fp-y={fp_y}"
    print(f"   📸 Bild: {_og_base} (crop: topics.json fp-x={fp_x}, fp-y={fp_y})")
else:
    # KI analysiert das Bild und bestimmt den optimalen Fokuspunkt für Hochformat
    try:
        _preview_url = f"{_og_base}?w=800&h=600&fit=crop&crop=center&auto=format"
        _r = requests.get(_preview_url, timeout=20, headers={"User-Agent": "Mozilla/5.0"})
        _r.raise_for_status()
        _b64 = base64.b64encode(_r.content).decode()
        _mime = _r.headers.get("content-type", "image/jpeg").split(";")[0]
        _fp_resp = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=100,
            messages=[{
                "role": "user",
                "content": [
                    {"type": "image", "source": {"type": "base64", "media_type": _mime, "data": _b64}},
                    {"type": "text", "text": (
                        "Dieses Bild wird für einen WhatsApp-Status im Hochformat (1080×1920) zugeschnitten. "
                        "Das Overlay bedeckt die untere Hälfte mit Text. Der wichtige Teil des Motivs "
                        "muss oben gut sichtbar sein.\n\n"
                        "Wo liegt das Hauptmotiv (z.B. Münzen, Gesicht, Gebäude)? "
                        "Antworte NUR mit JSON: {\"fp_x\": 0.0-1.0, \"fp_y\": 0.0-1.0} "
                        "(0=links/oben, 1=rechts/unten). Kein weiterer Text."
                    )}
                ]
            }]
        )
        _fp_data = json.loads(re.search(r'\{.*\}', _fp_resp.content[0].text, re.DOTALL).group())
        fp_x = round(float(_fp_data.get("fp_x", 0.5)), 2)
        fp_y = round(float(_fp_data.get("fp_y", 0.5)), 2)
        _ig_crop = f"crop=focalpoint&fp-x={fp_x}&fp-y={fp_y}"
        print(f"   📸 Bild: {_og_base} (KI-Fokuspunkt: fp-x={fp_x}, fp-y={fp_y})")
    except Exception as e:
        _ig_crop = "crop=entropy"
        print(f"   📸 Bild: {_og_base} (Fallback: entropy – {e})")
ig_img_url_global = f"{_og_base}?w=1080&h=1920&fit=crop&{_ig_crop}&auto=format"

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
  "ig_body": "2 Sätze für das Bild: Zeige konkret was gespart oder gewonnen werden kann. WICHTIG: Verwende NUR Zahlen und Fakten die exakt so auch im Blogbeitrag stehen – niemals eigene Zahlen erfinden. Kein Fachchinesisch. Max 160 Zeichen. IMMER Sie/Ihnen/Ihre.",
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
ig_body     = meta.get("ig_body", "").strip()
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
  body {{ width: 1080px; height: 1920px; overflow: hidden; font-family: 'Inter', Arial, sans-serif; }}
  .wrap {{ width: 1080px; height: 1920px; position: relative; }}
  .bg-img {{ position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }}
  .overlay {{ position: absolute; inset: 0; background: linear-gradient(to bottom, rgba(10,25,50,.05) 0%, rgba(10,25,50,.25) 45%, rgba(10,25,50,.90) 65%, rgba(10,25,50,.97) 100%); }}
  .content {{ position: absolute; inset: 0; display: flex; flex-direction: column; justify-content: flex-end; padding: 80px 76px 200px; }}
  h1 {{ font-size: 100px; font-weight: 900; color: #fff; line-height: 1.05; margin-bottom: 36px; letter-spacing: -.02em; }}
  h1 span {{ color: #4d9fff; }}
  .sub {{ font-size: 44px; color: rgba(255,255,255,.85); font-weight: 500; line-height: 1.5; margin-bottom: 28px; }}
  .body {{ font-size: 36px; color: rgba(255,255,255,.65); font-weight: 400; line-height: 1.65; margin-bottom: 52px; }}
  .cta {{ display: inline-flex; align-items: center; gap: 20px; background: #1a50c8; color: #fff; font-size: 38px; font-weight: 700; padding: 20px 44px; border-radius: 16px; margin-bottom: 64px; align-self: flex-start; }}
  .cta-arrow {{ display: inline-block; width: 0; height: 0; border-left: 18px solid transparent; border-right: 18px solid transparent; border-top: 26px solid #fff; margin-top: 4px; flex-shrink: 0; }}
  .divider {{ height: 1px; background: rgba(255,255,255,.18); margin-bottom: 48px; }}
  .brand-text strong {{ display: block; font-size: 52px; font-weight: 800; color: #fff; margin-bottom: 6px; }}
  .brand-text span {{ font-size: 42px; color: rgba(255,255,255,.55); font-weight: 400; }}
</style>
</head>
<body>
<div class="wrap">
  <img class="bg-img" src="{ig_img_url}" />
  <div class="overlay"></div>
  <div class="content">
    <h1>{h1_content}</h1>
    <p class="sub">{ig_sub}</p>
    <p class="body">{ig_body}</p>
    <div class="cta"><span class="cta-arrow"></span> Schreiben Sie mir</div>
    <div class="divider"></div>
    <div class="branding">
      <div class="brand-text">
        <strong>Daniel Eck</strong>
        <span>Versicherungsmakler</span>
      </div>
    </div>
  </div>
</div>
</body>
</html>"""

os.makedirs("social", exist_ok=True)
with open("social/latest-ig.html", "w", encoding="utf-8") as f:
    f.write(social_html)
print("✅ Social Image HTML erstellt: social/latest-ig.html")

heiko_html = social_html.replace("<strong>Daniel Eck</strong>", "<strong>Heiko Eck</strong>")
with open("social/latest-ig-heiko.html", "w", encoding="utf-8") as f:
    f.write(heiko_html)
print("✅ Social Image HTML erstellt: social/latest-ig-heiko.html")

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
