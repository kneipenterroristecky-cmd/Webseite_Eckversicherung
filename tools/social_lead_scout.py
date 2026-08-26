#!/usr/bin/env python3
"""
Social-Lead-Scout – Neukundengewinn über soziale Medien.

Durchsucht (per SerpApi, das echte Google-Suchergebnisse als JSON liefert)
öffentlich indexierte Beiträge auf X/Twitter, Facebook, Instagram, Reddit &
Foren nach Sätzen wie "Suche Alternative zu ..." oder "Weiß jemand ..." rund
um Versicherungsthemen. Neue Treffer werden dedupliziert per URL, ins Google
Sheet "Social-Leads" (via Apps Script, siehe Code.gs) eingetragen und dort
per E-Mail zusammengefasst.

Läuft wöchentlich per GitHub Actions (.github/workflows/social-lead-scout.yml).
Secrets kommen aus Umgebungsvariablen, Themen/Suchmuster aus
tools/social_lead_scout_topics.json (keine Geheimnisse, wird committet).

Setup & Details: tools/social_lead_scout.md
"""
import json
import os
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import requests

try:
    import anthropic
except ImportError:
    anthropic = None

TOOLS_DIR     = Path(__file__).resolve().parent
TOPICS_PATH   = TOOLS_DIR / "social_lead_scout_topics.json"
SEEN_PATH     = TOOLS_DIR / "social_lead_scout_seen.json"
ROTATION_PATH = TOOLS_DIR / "social_lead_scout_rotation.json"

SERPAPI_URL = "https://serpapi.com/search"
CLAUDE_MODEL = "claude-haiku-4-5-20251001"


def load_json(path, default):
    if not path.exists():
        return default
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return default


def save_json(path, data):
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def load_secrets():
    secrets = {
        "serpapi_key": os.environ.get("SERPAPI_KEY", "").strip(),
        "apps_script_url": os.environ.get("APPS_SCRIPT_URL", "").strip(),
        "social_scout_secret": os.environ.get("SOCIAL_SCOUT_SECRET", "").strip(),
    }
    missing = [k.upper() for k, v in secrets.items() if not v]
    if missing:
        print(f"❌ Fehlende Umgebungsvariablen: {', '.join(missing)}")
        print("   Als GitHub Secrets hinterlegen, siehe tools/social_lead_scout.md.")
        sys.exit(1)
    # Optional: ohne ANTHROPIC_API_KEY laeuft der Scout weiter, aber ohne
    # inhaltliche Pruefung (nur Stichwort-/Domain-Filter) - schlechtere Qualitaet,
    # aber kein harter Abbruch.
    secrets["anthropic_api_key"] = os.environ.get("ANTHROPIC_API_KEY", "").strip()
    return secrets


def build_all_queries(cfg):
    """Alle Kombinationen aus Thema x Phrase x Plattform (fest sortiert, damit die Rotation stabil bleibt)."""
    ausschluss = " ".join(f'-{w}' if " " not in w else f'-"{w}"' for w in cfg.get("ausschluss_stichworte", []))
    queries = []
    for thema in cfg["themen"]:
        for phrase in cfg["phrase_templates"]:
            phrase_txt = phrase.format(thema=f'"{thema}"')
            for plat in cfg["platforms"]:
                q = f'{phrase_txt} {plat["site_filter"]} {ausschluss}'.strip()
                queries.append({"query": q, "topic": thema, "platform": plat["name"]})
    return queries


def next_batch(all_queries, cfg):
    """Rotiert durch alle Kombinationen, damit über mehrere Wochen alles einmal drankommt
    statt bei jedem Lauf dieselben ersten Kombinationen zu wiederholen."""
    state = load_json(ROTATION_PATH, {"index": 0})
    start = state["index"] % len(all_queries)
    n = cfg["max_queries_per_run"]

    batch = []
    i = start
    for _ in range(min(n, len(all_queries))):
        batch.append(all_queries[i])
        i = (i + 1) % len(all_queries)

    save_json(ROTATION_PATH, {"index": i})
    return batch


def serpapi_search(secrets, query, num, zeitfenster):
    params = {
        "api_key": secrets["serpapi_key"],
        "engine": "google",
        "q": query,
        "num": num,
        "gl": "de",
        "hl": "de",
    }
    if zeitfenster:
        params["tbs"] = zeitfenster
    r = requests.get(SERPAPI_URL, params=params, timeout=20)
    if r.status_code == 429:
        raise RuntimeError("SerpApi: Monatslimit erreicht (429) – Lauf wird abgebrochen.")
    r.raise_for_status()
    data = r.json()
    if data.get("error"):
        raise RuntimeError(f"SerpApi-Fehler: {data['error']}")
    return data.get("organic_results", [])


def guess_platform_label(url, fallback):
    domain_map = [
        ("x.com", "X/Twitter"), ("twitter.com", "X/Twitter"),
        ("facebook.com", "Facebook"), ("instagram.com", "Instagram"),
        ("tiktok.com", "TikTok"), ("reddit.com", "Reddit"),
    ]
    for domain, label in domain_map:
        if domain in url:
            return label
    return fallback


def is_own_domain(url, own_domains):
    return any(d in url for d in own_domains)


def is_makler_domain(url, makler_domains):
    return any(d in url for d in makler_domains)


RELEVANZ_PROMPT = """Du prüfst Suchtreffer für einen unabhängigen Versicherungsmakler, der neue Privat-/Geschäftskunden sucht.

Thema: {thema}
Titel: {titel}
Textausschnitt: {snippet}

Frage: Ist das ein Beitrag/Post/Kommentar einer echten Privatperson (oder eines Geschäftsinhabers in eigener Sache),
die/der tatsächlich nach einer {thema} sucht, unzufrieden mit ihrer/seiner aktuellen ist, eine Alternative sucht,
eine Empfehlung möchte oder eine kündigen/wechseln will?

Antworte NUR mit JA, wenn all das zutrifft. Antworte mit NEIN bei:
- Jobanzeigen/Stellenausschreibungen (auch wenn die Versicherung nur als Benefit erwähnt wird)
- Werbe-/Verkaufsposts von Versicherungsvertretern, Maklern, Agenturen oder Finanzberatern (auch wenn sie wie eine Kundenfrage klingen)
- Allgemeine Ratgeber-/News-Artikel ohne konkrete persönliche Suchabsicht
- Beiträgen, bei denen das Thema nur zufällig/am Rande erwähnt wird, es aber eigentlich um etwas anderes geht
- Reiner Produktbeschreibung ohne erkennbare Suchabsicht einer Person

Antworte NUR mit einem einzigen Wort: JA oder NEIN."""


def ist_relevanter_lead(client, thema, titel, snippet):
    if client is None:
        return True
    try:
        resp = client.messages.create(
            model=CLAUDE_MODEL,
            max_tokens=5,
            messages=[{"role": "user", "content": RELEVANZ_PROMPT.format(thema=thema, titel=titel, snippet=snippet)}],
        )
        antwort = resp.content[0].text.strip().upper()
        return antwort.startswith("JA")
    except Exception as e:
        print(f"⚠️  Relevanzprüfung fehlgeschlagen ({e}) - Treffer wird sicherheitshalber behalten.")
        return True


def run():
    cfg = load_json(TOPICS_PATH, None)
    if cfg is None:
        print(f"❌ Themen-Konfiguration nicht gefunden: {TOPICS_PATH}")
        sys.exit(1)
    secrets = load_secrets()

    all_queries = build_all_queries(cfg)
    batch = next_batch(all_queries, cfg)
    print(f"🔎 Social-Lead-Scout: {len(batch)} von {len(all_queries)} möglichen Suchanfragen in diesem Lauf.")

    seen = set(load_json(SEEN_PATH, []))
    own_domains = cfg.get("eigene_domain_ausschliessen", [])
    makler_domains = cfg.get("makler_ausschliessen", [])
    results_per_query = cfg.get("results_per_query", 5)
    zeitfenster = cfg.get("zeitfenster")

    claude = None
    if secrets["anthropic_api_key"] and anthropic is not None:
        claude = anthropic.Anthropic(api_key=secrets["anthropic_api_key"])
    else:
        print("ℹ️  Keine Relevanzprüfung durch Claude (ANTHROPIC_API_KEY fehlt) - nur Stichwort-/Domain-Filter aktiv.")

    found = []
    verworfen = 0

    for item in batch:
        try:
            results = serpapi_search(secrets, item["query"], results_per_query, zeitfenster)
        except RuntimeError as e:
            print(f"⚠️  {e}")
            break
        except Exception as e:
            print(f"⚠️  Fehler bei Suche '{item['query']}': {e}")
            continue

        for r in results:
            url = r.get("link", "").strip()
            if not url or url in seen or is_own_domain(url, own_domains) or is_makler_domain(url, makler_domains):
                continue
            seen.add(url)
            found.append({
                "platform": guess_platform_label(url, item["platform"]),
                "topic": item["topic"],
                "query": item["query"],
                "title": r.get("title", ""),
                "snippet": r.get("snippet", ""),
                "url": url,
                "found_at": datetime.now(timezone.utc).isoformat(),
            })

    save_json(SEEN_PATH, sorted(seen))

    if not found:
        print("ℹ️  Keine neuen Treffer in diesem Lauf.")
        return

    print(f"✅ {len(found)} neue(r) Treffer gefunden. Übertrage ins Google Sheet ...")
    payload = {
        "action": "social_lead_add",
        "secret": secrets["social_scout_secret"],
        "leads": found,
    }
    result = None
    last_error = None
    for versuch in range(1, 4):
        try:
            resp = requests.post(secrets["apps_script_url"], json=payload, timeout=45)
            resp.raise_for_status()
            result = resp.json()
            break
        except Exception as e:
            last_error = e
            print(f"⚠️  Übertragung fehlgeschlagen (Versuch {versuch}/3): {e}")
            if versuch < 3:
                time.sleep(5 * versuch)

    if result is None:
        # Gefundene Treffer bleiben in "seen" (kein erneutes Anzeigen naechste Woche),
        # sind bei einer fehlgeschlagenen Uebertragung aber nicht im Sheet gelandet -
        # deshalb hier zusaetzlich lokal sichern, statt sie stillschweigend zu verlieren
        # (live am 2026-08-26 passiert: 46 Treffer durch einen einzelnen 404 verloren).
        save_json(TOOLS_DIR / "social_lead_scout_failed.json", found)
        print(f"❌ Übertragung nach 3 Versuchen fehlgeschlagen ({last_error}). "
              f"Treffer lokal gesichert in social_lead_scout_failed.json.")
        sys.exit(1)

    if not result.get("ok"):
        print(f"❌ Apps-Script-Fehler: {result.get('err')}")
        sys.exit(1)

    print(f"📋 Im Sheet gespeichert: {result.get('added')} neu, {result.get('skipped')} bereits vorhanden (Dedupe).")
    print("📧 E-Mail-Digest wurde verschickt (falls neue Treffer hinzugefügt wurden).")


if __name__ == "__main__":
    run()
