#!/usr/bin/env python3
"""
Social-Lead-Scout – Neukundengewinn über soziale Medien.

Durchsucht (per Google Custom Search API) öffentlich indexierte Beiträge auf
X/Twitter, Facebook, Instagram, Reddit & Foren nach Sätzen wie
"Suche Alternative zu ..." oder "Weiß jemand ..." rund um Versicherungsthemen.
Neue Treffer werden dedupliziert per URL, ins Google Sheet "Social-Leads"
(via Apps Script, siehe Code.gs) eingetragen und per E-Mail zusammengefasst.

Setup & Details: tools/social_lead_scout.md
Wöchentlicher Lauf: tools/register_social_lead_scout_task.ps1
"""
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

import requests

TOOLS_DIR   = Path(__file__).resolve().parent
CONFIG_PATH = TOOLS_DIR / "social_lead_scout_config.json"
SEEN_PATH   = TOOLS_DIR / "social_lead_scout_seen.json"
ROTATION_PATH = TOOLS_DIR / "social_lead_scout_rotation.json"

GOOGLE_SEARCH_URL = "https://www.googleapis.com/customsearch/v1"


def load_json(path, default):
    if not path.exists():
        return default
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return default


def save_json(path, data):
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def build_all_queries(cfg):
    """Alle Kombinationen aus Thema x Phrase x Plattform (fest sortiert, damit die Rotation stabil bleibt)."""
    queries = []
    for thema in cfg["themen"]:
        for phrase in cfg["phrase_templates"]:
            phrase_txt = phrase.format(thema=f'"{thema}"')
            for plat in cfg["platforms"]:
                q = f'{phrase_txt} {plat["site_filter"]}'
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


def google_search(cfg, query):
    params = {
        "key": cfg["google_api_key"],
        "cx": cfg["google_cx"],
        "q": query,
        "num": cfg.get("results_per_query", 5),
    }
    r = requests.get(GOOGLE_SEARCH_URL, params=params, timeout=20)
    if r.status_code == 429:
        raise RuntimeError("Google Custom Search: Tageslimit erreicht (429) – Lauf wird abgebrochen.")
    r.raise_for_status()
    return r.json().get("items", [])


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


def run(config_path=CONFIG_PATH):
    cfg = load_json(config_path, None)
    if cfg is None:
        print(f"❌ Konfiguration nicht gefunden: {config_path}")
        sys.exit(1)

    missing = [k for k in ("google_api_key", "google_cx", "apps_script_url", "social_scout_secret")
               if cfg.get(k, "").startswith("DEIN") or cfg.get(k, "").startswith("BITTE") or not cfg.get(k)]
    if missing:
        print(f"❌ Bitte in {config_path.name} noch ausfüllen: {', '.join(missing)}")
        print("   Siehe tools/social_lead_scout.md für die Einrichtung.")
        sys.exit(1)

    all_queries = build_all_queries(cfg)
    batch = next_batch(all_queries, cfg)
    print(f"🔎 Social-Lead-Scout: {len(batch)} von {len(all_queries)} möglichen Suchanfragen in diesem Lauf.")

    seen = set(load_json(SEEN_PATH, []))
    own_domains = cfg.get("eigene_domain_ausschliessen", [])
    found = []

    for item in batch:
        try:
            results = google_search(cfg, item["query"])
        except RuntimeError as e:
            print(f"⚠️  {e}")
            break
        except Exception as e:
            print(f"⚠️  Fehler bei Suche '{item['query']}': {e}")
            continue

        for r in results:
            url = r.get("link", "").strip()
            if not url or url in seen or is_own_domain(url, own_domains):
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
    resp = requests.post(cfg["apps_script_url"], json={
        "action": "social_lead_add",
        "secret": cfg["social_scout_secret"],
        "leads": found,
    }, timeout=30)
    resp.raise_for_status()
    result = resp.json()
    if not result.get("ok"):
        print(f"❌ Apps-Script-Fehler: {result.get('err')}")
        sys.exit(1)

    print(f"📋 Im Sheet gespeichert: {result.get('added')} neu, {result.get('skipped')} bereits vorhanden (Dedupe).")
    print("📧 E-Mail-Digest wurde verschickt (falls neue Treffer hinzugefügt wurden).")


if __name__ == "__main__":
    run()
