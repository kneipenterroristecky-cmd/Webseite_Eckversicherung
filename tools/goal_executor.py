"""
goal_executor.py – Template-basierter Ansatz.
Haiku generiert nur den Seiteninhalt als JSON (~2-3 Cent/Seite).
Python baut das vollständige HTML aus dem Template.
"""
import json
import os
import re
import sys
from pathlib import Path

import anthropic

REPO_ROOT = Path(".")
MODEL_PLAN   = "claude-haiku-4-5-20251001"   # günstig – nur für Planung & Review
MODEL_CONTENT = "claude-haiku-4-5-20251001"  # günstig – nur JSON-Daten, kein HTML


# ── HTML-Template (Python baut das fertige HTML) ───────────────────────────

def build_html(d: dict) -> str:
    def cards_html():
        out = []
        for c in d.get("cards", []):
            items = "".join(
                f'<li><div class="cov-check"><i class="fas fa-check"></i></div>'
                f'<span>{it}</span></li>'
                for it in c.get("items", [])
            )
            pid = c.get("pexels", "3786215")
            out.append(f"""
      <div class="cov-card reveal">
        <div class="cov-card-img">
          <img src="https://images.pexels.com/photos/{pid}/pexels-photo-{pid}.jpeg?auto=compress&cs=tinysrgb&w=800"
               alt="{c.get('alt','Bild')}" loading="lazy" />
          <div class="cov-card-img-overlay">
            <div class="optional-badge" style="margin-bottom:0;">
              <i class="fas {c.get('icon','fa-shield')}"></i> {c.get('badge','')}
            </div>
            <div class="cov-card-title">{c.get('title','')}</div>
          </div>
        </div>
        <div class="cov-card-body">
          <p class="cov-card-desc">{c.get('desc','')}</p>
          <ul class="cov-list">{items}</ul>
        </div>
      </div>""")
        return "".join(out)

    def compare_html():
        out = []
        for g in d.get("compare", []):
            items = "".join(
                f'<li><div class="gew-icon"><i class="fas fa-check"></i></div><span>{it}</span></li>'
                for it in g.get("items", [])
            )
            out.append(f"""
      <div class="gew-card reveal">
        <div class="gew-card-header">
          <div class="gew-card-header-icon"><i class="fas {g.get('icon','fa-shield')}"></i></div>
          <div><h3>{g.get('title','')}</h3><p>{g.get('sub','')}</p></div>
        </div>
        <div class="gew-card-body"><ul class="gew-list">{items}</ul></div>
      </div>""")
        return "".join(out)

    def trust_html():
        return "".join(
            f'<div class="page-hero-trust-item">'
            f'<div class="page-hero-trust-icon"><i class="fas fa-check"></i></div>{t}</div>'
            for t in d.get("trust", [])
        )

    def faq_html():
        out = []
        for f in d.get("faq", []):
            out.append(f"""
        <div class="faq-item reveal">
          <button class="faq-q" aria-expanded="false">
            <span>{f.get('q','')}</span><i class="fas fa-chevron-down faq-chevron"></i>
          </button>
          <div class="faq-a" role="region">
            <div class="faq-a-inner">{f.get('a','')}</div>
          </div>
        </div>""")
        return "".join(out)

    title      = d.get("title", "Versicherung – Daniel Eck – Versicherungsmakler")
    meta_desc  = d.get("meta_desc", "")
    category   = d.get("category", "PRIVATE VERSICHERUNGEN")
    hero_title = d.get("hero_title", title)
    hero_sub   = d.get("hero_sub", "")
    intro      = d.get("intro", "")
    cta_title  = d.get("cta_title", f"Warum {d.get('short_title', 'diese Versicherung')} über mich abschließen?")

    return f"""<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>{title}</title>
  <meta name="description" content="{meta_desc}" />
  <link rel="icon" type="image/svg+xml" href="favicon.svg" />
  <link rel="stylesheet" href="style.css?v=5" />
  <link rel="stylesheet" href="https://assets.calendly.com/assets/external/widget.css" />
  <script src="https://assets.calendly.com/assets/external/widget.js"></script>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Inter:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,400&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css" />
  <style>
    .page-hero{{position:relative;overflow:hidden;background:var(--navy)}}
    .page-hero-bg{{position:absolute;inset:0;background-image:url('gespraech.png');background-size:cover;background-position:center;opacity:.18}}
    .page-hero::after{{content:'';position:absolute;inset:0;background:linear-gradient(90deg,rgba(23,45,80,.95) 50%,rgba(23,45,80,.5) 100%);pointer-events:none}}
    .page-hero-split{{max-width:1200px;margin:0 auto;padding:88px 28px;position:relative;z-index:1;display:grid;grid-template-columns:1fr 320px;align-items:center;gap:60px;min-height:480px}}
    .page-hero-left{{display:flex;flex-direction:column;align-items:flex-start;text-align:left;gap:22px}}
    .page-hero-title{{font-size:clamp(32px,4vw,52px);font-weight:900;color:#fff;letter-spacing:-.4px;margin:0;line-height:1.1}}
    .page-hero-sub{{font-size:17px;color:rgba(255,255,255,.7);line-height:1.7;margin:0;max-width:520px}}
    .page-hero-trust{{display:flex;flex-direction:column;gap:10px}}
    .page-hero-trust-item{{display:flex;align-items:center;gap:12px;font-size:15px;color:rgba(255,255,255,.9);font-weight:600}}
    .page-hero-trust-icon{{width:22px;height:22px;border-radius:50%;background:rgba(96,165,250,.3);display:flex;align-items:center;justify-content:center;color:#60a5fa;font-size:10px;flex-shrink:0}}
    .page-hero-buttons{{display:flex;gap:14px;flex-wrap:wrap;margin-top:8px}}
    .page-hero-btn-primary{{display:inline-flex;align-items:center;gap:9px;background:rgb(33,103,204);color:#fff;font-size:16px;font-weight:700;padding:16px 32px;border-radius:50px;text-decoration:none;border:none;cursor:pointer;transition:background .2s,transform .2s,box-shadow .2s;box-shadow:0 4px 20px rgba(33,103,204,.4)}}
    .page-hero-btn-primary:hover{{background:#1a50c8;transform:translateY(-2px);box-shadow:0 8px 28px rgba(33,103,204,.5)}}
    .page-hero-btn-secondary{{display:inline-flex;align-items:center;gap:9px;background:transparent;color:#fff;font-size:16px;font-weight:600;padding:15px 30px;border-radius:50px;text-decoration:none;border:2px solid rgba(255,255,255,.4);transition:border-color .2s,background .2s,transform .2s}}
    .page-hero-btn-secondary:hover{{border-color:#fff;background:rgba(255,255,255,.08);transform:translateY(-2px)}}
    .page-hero-photo{{display:flex;align-items:center;justify-content:center}}
    .page-hero-photo img{{width:280px;height:280px;border-radius:50%;object-fit:cover;object-position:center top;border:5px solid rgba(255,255,255,.2);box-shadow:0 20px 60px rgba(0,0,0,.4);display:block}}
    @media(max-width:860px){{.page-hero-split{{grid-template-columns:1fr;gap:36px;padding:60px 24px}}.page-hero-photo{{display:none}}.page-hero-left{{align-items:center;text-align:center}}.page-hero-sub{{max-width:100%}}.page-hero-buttons{{justify-content:center}}.page-hero-trust{{align-items:center}}}}
    .kfz-content{{max-width:1100px;margin:0 auto;padding:72px 28px 96px}}
    .kfz-intro{{max-width:700px;margin:0 auto 72px;text-align:center}}
    .kfz-intro p{{font-size:17px;color:var(--gray-500);line-height:1.8}}
    .optional-badge{{display:inline-flex;align-items:center;gap:7px;background:rgba(26,80,200,.08);border:1px solid rgba(26,80,200,.25);color:var(--blue);font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;padding:4px 12px;border-radius:100px;margin-bottom:10px}}
    .kfz-coverage{{display:grid;grid-template-columns:repeat(3,1fr);gap:24px;margin-bottom:72px}}
    .cov-card{{background:#fff;border:1.5px solid var(--gray-100);border-radius:20px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.06);display:flex;flex-direction:column}}
    .cov-card-img{{position:relative;height:220px;overflow:hidden}}
    .cov-card-img img{{width:100%;height:100%;object-fit:cover;display:block}}
    .cov-card-img-overlay{{position:absolute;inset:0;background:linear-gradient(to top,rgba(23,45,80,.45) 0%,rgba(23,45,80,0) 100%);display:flex;flex-direction:column;justify-content:flex-end;padding:16px 20px;gap:6px}}
    .cov-card-img-overlay .optional-badge{{background:rgba(255,255,255,.15);border-color:rgba(255,255,255,.5);color:#fff;align-self:flex-start}}
    .cov-card-title{{font-size:18px;font-weight:900;color:#fff;line-height:1.2;margin:0}}
    .cov-card-body{{padding:20px 22px 24px;flex:1}}
    .cov-card-desc{{font-size:13px;color:var(--gray-500);line-height:1.6;margin-bottom:16px}}
    .cov-list{{list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:9px}}
    .cov-list li{{display:flex;align-items:flex-start;gap:10px;font-size:13px;color:var(--gray-500);line-height:1.5}}
    .cov-check{{width:22px;height:22px;border-radius:6px;background:rgba(26,80,200,.1);display:flex;align-items:center;justify-content:center;color:var(--blue);font-size:11px;flex-shrink:0;margin-top:1px}}
    .kfz-section-title{{font-size:24px;font-weight:900;color:var(--navy);margin-bottom:8px}}
    .kfz-section-sub{{font-size:15px;color:var(--gray-500);margin-bottom:36px}}
    .gew-grid{{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:20px;margin-bottom:72px}}
    .gew-card{{background:#fff;border:1.5px solid var(--gray-100);border-radius:20px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.06)}}
    .gew-card-header{{background:var(--navy);padding:20px 22px;display:flex;align-items:flex-start;gap:14px;height:130px;overflow:hidden}}
    .gew-card-header-icon{{width:40px;height:40px;border-radius:10px;background:rgba(255,255,255,.12);display:flex;align-items:center;justify-content:center;font-size:18px;color:#fff;flex-shrink:0}}
    .gew-card-header h3{{font-size:15px;font-weight:800;color:#fff;margin:0;overflow-wrap:break-word;hyphens:auto}}
    .gew-card-header p{{font-size:12px;color:rgba(255,255,255,.6);margin:3px 0 0}}
    .gew-card-body{{padding:18px 22px 22px}}
    .gew-list{{list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:9px}}
    .gew-list li{{display:flex;align-items:center;gap:10px;font-size:14px;color:var(--gray-500);padding:7px 10px;border-radius:8px;margin:0 -10px}}
    .gew-icon{{width:26px;height:26px;border-radius:7px;background:rgba(26,80,200,.08);display:flex;align-items:center;justify-content:center;color:var(--blue);font-size:12px;flex-shrink:0}}
    .kfz-makler{{background:var(--navy);border-radius:20px;padding:0 52px 0 0;margin-bottom:56px;display:grid;grid-template-columns:220px 1fr 1fr;gap:48px;align-items:stretch;overflow:hidden}}
    .kfz-makler-photo{{width:100%;height:100%;object-fit:cover;object-position:top center;display:block;min-height:320px}}
    .kfz-makler-left{{padding:48px 0}}
    .kfz-makler-left h2{{font-size:26px;font-weight:900;color:#fff;margin-bottom:14px;line-height:1.25}}
    .kfz-makler-left p{{font-size:15px;color:rgba(255,255,255,.65);line-height:1.7;margin-bottom:28px}}
    .kfz-makler-advantages{{display:flex;flex-direction:column;gap:14px;padding:48px 0;justify-content:center}}
    .adv-item{{display:flex;align-items:center;gap:14px}}
    .adv-icon{{width:38px;height:38px;border-radius:10px;background:rgba(26,80,200,.35);display:flex;align-items:center;justify-content:center;color:#93c5fd;font-size:16px;flex-shrink:0}}
    .adv-text strong{{display:block;color:#fff;font-size:14px;font-weight:700}}
    .adv-text span{{color:rgba(255,255,255,.55);font-size:13px}}
    @media(max-width:860px){{.kfz-coverage{{grid-template-columns:1fr}}.kfz-makler{{grid-template-columns:1fr;padding:0;gap:0}}.kfz-makler-photo{{height:260px;min-height:unset}}.kfz-makler-left{{padding:28px 24px 20px}}.kfz-makler-advantages{{padding:0 24px 28px}}}}
  </style>
</head>
<body>
  <div class="topbar">
    <div class="topbar-container">
      <div class="topbar-right"><a href="tel:+491743225885"><i class="fas fa-phone"></i><span>0174 / 322 58 85</span></a><a href="mailto:daniel@eckversicherung.de"><i class="fas fa-envelope"></i><span>daniel@eckversicherung.de</span></a></div>
    </div>
  </div>
  <header class="navbar" id="navbar">
    <div class="navbar-container">
      <a href="start.html" class="logo"><img src="Logo Eck weis.png" alt="Daniel Eck Versicherungsmakler" class="logo-img" /><div class="logo-text"><span class="logo-name" style="color:rgb(33,103,204)">Daniel Eck</span><span class="logo-subtitle">Versicherungsmakler</span></div></a>
      <nav class="nav-links" id="navLinks"><a href="private-versicherungen.html" class="nav-link active">Private Versicherungen</a><a href="gewerbliche-versicherungen.html" class="nav-link">Gewerbliche Versicherungen</a><a href="start.html#team" class="nav-link">Über uns</a><a href="faq.html" class="nav-link">FAQ</a><a href="blog/index.html" class="nav-link">Ratgeber &amp; Tipps</a><a href="onlineabschluss.html" class="btn btn-nav btn-online-abschluss"><i class="fas fa-laptop"></i> Onlineabschluss</a><button onclick="openCalendlyDirect();window._track&&_track('cta','Termin – Navbar')" class="btn btn-nav" style="background-color:rgb(33,103,204)">Termin buchen</button></nav>
      <button class="hamburger" id="hamburger" aria-label="Menü"><span></span><span></span><span></span></button>
    </div>
  </header>

  <section class="page-hero">
    <div class="page-hero-bg"></div>
    <div class="page-hero-split">
      <div class="page-hero-left">
        <div class="section-label left" style="margin-bottom:4px;"><span class="label-bar short"></span><span>{category}</span></div>
        <h1 class="page-hero-title">{hero_title}</h1>
        <p class="page-hero-sub">{hero_sub}</p>
        <div class="page-hero-trust">{trust_html()}</div>
        <div class="page-hero-buttons">
          <button class="page-hero-btn-primary" onclick="openCalendlyDirect()"><i class="fas fa-calendar-check"></i> Termin buchen</button>
          <a href="tel:+491743225885" class="page-hero-btn-secondary"><i class="fas fa-phone"></i> 0174 / 322 58 85</a>
        </div>
      </div>
      <div class="page-hero-photo"><img src="Dummybild 1_rund.png" alt="Daniel Eck – Ihr Versicherungsmakler" /></div>
    </div>
  </section>

  <div class="kfz-content">
    <div class="kfz-intro reveal"><p>{intro}</p></div>
    <div class="kfz-coverage">{cards_html()}</div>

    <div class="reveal">
      <div class="kfz-section-title">Worauf ich beim Vergleich achte</div>
      <div class="kfz-section-sub">Diese Punkte entscheiden, welchen Schutz Sie wirklich erhalten.</div>
    </div>
    <div class="gew-grid">{compare_html()}</div>

    <div style="padding-top:120px;padding-bottom:120px;border-top:1px solid #e2e8f0;">
      <div class="section-label reveal" style="justify-content:center;margin-bottom:12px;"><span class="label-bar"></span><span>FAQ</span><span class="label-bar"></span></div>
      <h2 class="section-title reveal" style="text-align:center;margin-bottom:36px;">Häufige Fragen</h2>
      <div class="faq-list">{faq_html()}</div>
    </div>

    <div class="kfz-makler reveal">
      <img src="Dummybild 1.png" alt="Daniel Eck – Versicherungsmakler" class="kfz-makler-photo" />
      <div class="kfz-makler-left">
        <h2>{cta_title}</h2>
        <p>Als unabhängiger Versicherungsmakler vergleiche ich für Sie Angebote von über 100 Versicherern – kostenlos und ohne versteckte Kosten.</p>
        <button class="page-hero-btn-primary" onclick="openCalendlyDirect()"><i class="fas fa-calendar-check"></i> Jetzt Termin buchen</button>
      </div>
      <div class="kfz-makler-advantages">
        <div class="adv-item"><div class="adv-icon"><i class="fas fa-scale-balanced"></i></div><div class="adv-text"><strong>Unabhängige Beratung</strong><span>Kein Vertrieb, kein Verkaufsdruck</span></div></div>
        <div class="adv-item"><div class="adv-icon"><i class="fas fa-magnifying-glass"></i></div><div class="adv-text"><strong>Marktvergleich</strong><span>100+ Versicherer im Blick</span></div></div>
        <div class="adv-item"><div class="adv-icon"><i class="fas fa-shield-halved"></i></div><div class="adv-text"><strong>Betreuung im Schadenfall</strong><span>Ich bin für Sie da</span></div></div>
        <div class="adv-item"><div class="adv-icon"><i class="fas fa-euro-sign"></i></div><div class="adv-text"><strong>Kostenlos</strong><span>Meine Beratung ist für Sie gratis</span></div></div>
      </div>
    </div>
  </div>

  <footer class="footer">
    <div class="footer-container">
      <div class="footer-brand"><img src="Logo Eck weis.png" alt="Daniel Eck" class="footer-logo" /><p>Unabhängiger Versicherungsmakler in Schmalkalden &amp; Nürnberg. Persönliche Beratung, faire Vergleiche.</p></div>
      <div class="footer-links"><h4>Versicherungen</h4><a href="private-versicherungen.html">Private Versicherungen</a><a href="gewerbliche-versicherungen.html">Gewerbliche Versicherungen</a><a href="onlineabschluss.html">Onlineabschluss</a></div>
      <div class="footer-links"><h4>Unternehmen</h4><a href="start.html#team">Über uns</a><a href="faq.html">FAQ</a><a href="blog/index.html">Ratgeber</a><a href="kontakt.html">Kontakt</a></div>
      <div class="footer-links"><h4>Rechtliches</h4><a href="impressum.html">Impressum</a><a href="datenschutz.html">Datenschutz</a><a href="erstinformation.html">Erstinformation</a></div>
    </div>
    <div class="footer-bottom"><p>© 2025 Daniel Eck Versicherungsmakler · <a href="impressum.html">Impressum</a> · <a href="datenschutz.html">Datenschutz</a></p></div>
  </footer>

  <script src="analytics.js" defer></script>
  <script src="cookie.js" defer></script>
  <script src="chatbot.js" defer></script>
  <script>
    const hamburger=document.getElementById('hamburger');
    const navLinks=document.getElementById('navLinks');
    if(hamburger)hamburger.addEventListener('click',()=>{{hamburger.classList.toggle('open');navLinks.classList.toggle('open')}});
    document.querySelectorAll('.faq-q').forEach(btn=>{{
      btn.addEventListener('click',()=>{{
        const expanded=btn.getAttribute('aria-expanded')==='true';
        document.querySelectorAll('.faq-q').forEach(b=>{{b.setAttribute('aria-expanded','false');b.nextElementSibling.style.maxHeight=null}});
        if(!expanded){{btn.setAttribute('aria-expanded','true');btn.nextElementSibling.style.maxHeight=btn.nextElementSibling.scrollHeight+'px'}}
      }});
    }});
    const navbar=document.getElementById('navbar');
    window.addEventListener('scroll',()=>navbar.classList.toggle('scrolled',window.scrollY>10));
    document.querySelectorAll('.reveal').forEach(el=>{{
      new IntersectionObserver(([e])=>e.isIntersecting&&e.target.classList.add('visible'),{{threshold:.1}}).observe(el);
    }});
    function openCalendlyDirect(){{Calendly.initPopupWidget({{url:'https://calendly.com/daniel-eckversicherung/beratung'}});return false}}
  </script>
</body>
</html>"""


# ── Hilfsfunktionen ────────────────────────────────────────────────────────

def read_file(path, max_lines=None):
    try:
        with open(path, encoding="utf-8") as f:
            lines = f.readlines()
            return "".join(lines[:max_lines] if max_lines else lines)
    except Exception:
        return None


def write_file(path_str: str, content: str) -> bool:
    path = Path(path_str)
    if ".." in path.parts or path.is_absolute():
        print(f"Übersprungen (unsicherer Pfad): {path_str}")
        return False
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)
    return True


def estimate_cost(usage, label=""):
    cost = (usage.input_tokens * 0.8 + usage.output_tokens * 4) / 1_000_000
    print(f"  {label}Tokens: {usage.input_tokens} in / {usage.output_tokens} out (~${cost:.4f})")
    return cost


# ── Schritt 1: Planungs-Call ───────────────────────────────────────────────

def get_filenames(client, goal: str) -> list[str]:
    resp = client.messages.create(
        model=MODEL_PLAN,
        max_tokens=80,
        system="Antworte nur mit HTML-Dateinamen (eine pro Zeile). Kleinbuchstaben, Bindestrich statt Leerzeichen, .html Endung.",
        messages=[{"role": "user", "content": f"Welche HTML-Dateien müssen erstellt oder geändert werden?\nAuftrag: {goal}"}],
    )
    files = re.findall(r'[\w-]+\.html', resp.content[0].text)
    estimate_cost(resp.usage, "Plan-Call – ")
    print(f"Geplante Dateien: {files}")
    return files


# ── Schritt 2: Inhalt als JSON generieren ─────────────────────────────────

CONTENT_SCHEMA = """Antworte mit einem einzigen JSON-Objekt (kein Markdown, kein Code-Block):
{
  "title": "Versicherungsname – Daniel Eck – Versicherungsmakler",
  "short_title": "Versicherungsname",
  "meta_desc": "SEO-Beschreibung, max 155 Zeichen",
  "category": "KATEGORIE IN GROSSBUCHSTABEN",
  "hero_title": "Titel mit<br>Zeilenumbruch wenn sinnvoll",
  "hero_sub": "Untertitel-Text (1-2 Sätze)",
  "trust": ["Vertrauenspunkt 1", "Vertrauenspunkt 2", "Vertrauenspunkt 3"],
  "intro": "Einleitungstext (2-3 Sätze)",
  "cards": [
    {
      "icon": "fa-shield",
      "badge": "Badge-Text",
      "title": "Karten-Titel",
      "desc": "Kurzbeschreibung",
      "items": ["Punkt 1 mit <strong>Fettung</strong>", "Punkt 2", "Punkt 3", "Punkt 4", "Punkt 5"],
      "alt": "Bild-Alt-Text",
      "pexels": "PEXELS_FOTO_ID_NUR_ZAHLEN"
    }
  ],
  "compare": [
    {
      "icon": "fa-list-check",
      "title": "Vergleichs-Titel",
      "sub": "Untertitel",
      "items": ["Punkt 1", "Punkt 2", "Punkt 3"]
    }
  ],
  "faq": [
    {"q": "Frage?", "a": "Antwort (2-3 Sätze, aus Daniel Ecks Perspektive)"}
  ],
  "cta_title": "Warum [Versicherung] über mich abschließen?"
}

Regeln:
- Genau 3 cards, 4 compare-Einträge, 5 FAQ-Einträge
- Pexels-IDs: echte Foto-IDs zum Thema (z.B. Tiere: 1108099, 3802664, 애237691)
- Sprache: Deutsch, professionell, "ich prüfe für Sie"-Perspektive
- Keine HTML-Tags außer <br> und <strong>"""


def generate_page_data(client, goal: str, filename: str) -> dict | None:
    resp = client.messages.create(
        model=MODEL_CONTENT,
        max_tokens=4000,
        system=CONTENT_SCHEMA,
        messages=[{"role": "user", "content": f"Erstelle Seiten-Inhalt für: {filename}\nAuftrag: {goal}"}],
    )
    cost = estimate_cost(resp.usage, f"{filename} – ")
    text = resp.content[0].text.strip()

    # JSON extrahieren (manchmal kommt es in ```json ... ```)
    json_match = re.search(r'\{.*\}', text, re.DOTALL)
    if not json_match:
        print(f"  Kein JSON in Response: {text[:200]}")
        return None
    try:
        return json.loads(json_match.group())
    except json.JSONDecodeError as e:
        print(f"  JSON-Fehler: {e}")
        return None


# ── Schritt 3: Bild-Review ─────────────────────────────────────────────────

def review_images(client, files_written: list[str]):
    img_info = []
    for fname in files_written:
        content = read_file(fname) or ""
        imgs = re.findall(r'src="(https://images\.pexels[^"]+)"[^>]*alt="([^"]*)"', content)
        for src, alt in imgs:
            img_info.append(f"  Datei {fname}: {alt} → {src}")

    if not img_info:
        return

    print("\n── Bild-Review ──────────────────────────────────────")
    resp = client.messages.create(
        model=MODEL_PLAN,
        max_tokens=300,
        system="Antworte mit 'OK' wenn alle Bilder passen, oder liste Dateien auf die korrigiert werden müssen (Format: 'ERSETZE datei.html: alte_id → neue_id').",
        messages=[{"role": "user", "content": f"Prüfe ob diese Pexels-Bilder thematisch zur Versicherungswebseite passen:\n" + "\n".join(img_info)}],
    )
    estimate_cost(resp.usage, "Review – ")
    result = resp.content[0].text.strip()
    print(f"  Review-Ergebnis: {result[:200]}")


# ── Hauptprogramm ──────────────────────────────────────────────────────────

def main():
    goal = os.environ.get("GOAL", "").strip()
    if not goal:
        print("Fehler: GOAL Umgebungsvariable nicht gesetzt.")
        sys.exit(1)

    print(f"Goal: {goal}")
    client = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])

    filenames = get_filenames(client, goal)
    if not filenames:
        print("Keine Dateinamen erkannt.")
        sys.exit(1)

    files_written = []
    for fname in filenames:
        print(f"\n── Generiere: {fname}")
        data = generate_page_data(client, goal, fname)
        if not data:
            print(f"  ✗ Keine Daten erhalten für {fname}")
            continue
        html = build_html(data)
        if write_file(fname, html):
            files_written.append(fname)
            print(f"  ✓ Geschrieben: {fname} ({len(html):,} Zeichen)")

    if not files_written:
        print("\nKeine Dateien erstellt.")
        sys.exit(1)

    review_images(client, files_written)
    print(f"\nFertig: {len(files_written)} Datei(en) erstellt.")


if __name__ == "__main__":
    main()
