#!/usr/bin/env python3
"""Gemeinsame Bildsuche: Unsplash durchsuchen und Claude Vision das passendste Bild wählen lassen.
Wird von generate_post.py (Workflow 1) und request-changes.yml (Workflow 3) genutzt.
"""
import re
import random
import base64
import requests


def find_best_image(topic_title, topic_label, topic_query, client, fallback_url, unsplash_key, exclude_ids=None):
    """Sucht auf Unsplash und lässt Claude Vision das thematisch passendste Bild wählen.

    exclude_ids: Menge/Liste von Unsplash-Foto-IDs, die NICHT erneut gewählt werden sollen
    (z.B. alle bei diesem Entwurf bereits gezeigten Bilder – sonst liefert dieselbe
    Suche+Vision-Wahl deterministisch wieder eines der schon gezeigten Fotos zurück).
    """
    results = find_best_images(topic_title, topic_label, topic_query, client, fallback_url, unsplash_key, exclude_ids, n=1)
    return results[0]["url"] if results else fallback_url


def find_best_images(topic_title, topic_label, topic_query, client, fallback_url, unsplash_key, exclude_ids=None, n=4):
    """Wie find_best_image, liefert aber die Top-n Kandidaten als von Claude Vision
    gerankte Liste zurück (bestes zuerst) statt nur den einen besten Treffer -
    z.B. damit der Kunde sich in WhatsApp zwischen mehreren Bildern entscheiden kann.

    Rückgabe: Liste von {"url": ..., "id": ...}, bestes zuerst. Bei Fehlern/fehlendem
    Key: Liste mit nur dem Fallback-Bild.
    """
    exclude_ids = set(exclude_ids or [])
    if not unsplash_key:
        print("   ℹ️  Kein UNSPLASH_ACCESS_KEY – nutze Fallback-Bild")
        return [{"url": fallback_url, "id": None}]

    # Bei wiederholten Aufrufen zum selben Thema (z.B. mehrfach "Neues Bild vorschlagen")
    # liefert Claude Haiku fuer denselben Titel fast immer denselben Suchbegriff. Ein
    # zufaelliger Seitenversatz sorgt dafuer, dass Unsplash nicht jedes Mal denselben
    # Ergebnis-Pool zurueckgibt.
    search_page = random.randint(1, 3)

    # Schritt 1: KI generiert optimierten Suchbegriff
    try:
        q_resp = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=30,
            messages=[{"role": "user", "content": (
                f'Deutsche Versicherungs-Website. Blog-Thema: "{topic_title}".\n'
                "Gib einen englischen Foto-Suchbegriff (max 4 Wörter) für ein echtes, "
                "helles, alltagsnahes Foto passend zum Thema – so wie es ein seriöser "
                "Versicherungsmakler für Werbung nutzen würde. "
                "Zeige gepflegte, normale Häuser/Situationen – KEINE verlassenen, "
                "heruntergekommenen oder verwahrlosten Gebäude/Ruinen, auch wenn das Thema "
                "Einbruch/Schaden ist (z.B. lieber eine gepflegte Haustür mit Schloss als ein "
                "kaputtes Fenster an einer Ruine). "
                "Kein Geld/Münzen/Dollar/Sparschwein. Keine abstrakten Grafiken.\n"
                "Nur der Suchbegriff, kein anderer Text."
            )}]
        )
        search_query = q_resp.content[0].text.strip().strip('"').strip("'")
    except Exception:
        search_query = topic_query

    print(f"   🔍 Unsplash-Suche: '{search_query}'")

    # Schritt 2: Unsplash durchsuchen
    try:
        r = requests.get(
            "https://api.unsplash.com/search/photos",
            params={"query": search_query, "per_page": 30, "page": search_page, "orientation": "landscape", "content_filter": "high"},
            headers={"Authorization": f"Client-ID {unsplash_key}"},
            timeout=15
        )
        if r.status_code != 200:
            print(f"   ⚠️  Unsplash API {r.status_code} – nutze Fallback")
            return [{"url": fallback_url, "id": None}]

        photos = r.json().get("results", [])
        if not photos and search_page > 1:
            # Seite ohne Treffer (z.B. Suchbegriff hat insgesamt weniger als 30*page
            # Ergebnisse) – auf Seite 1 zurueckfallen statt komplett leer auszugehen.
            r = requests.get(
                "https://api.unsplash.com/search/photos",
                params={"query": search_query, "per_page": 30, "page": 1, "orientation": "landscape", "content_filter": "high"},
                headers={"Authorization": f"Client-ID {unsplash_key}"},
                timeout=15
            )
            photos = r.json().get("results", []) if r.status_code == 200 else []
        # Zu kleine Originale ausschliessen – sonst skaliert Unsplash beim Zuschnitt
        # auf 1080x1920 hoch, was das Bild unscharf/verwaschen macht.
        photos = [p for p in photos if p.get("width", 0) >= 1080 and p.get("height", 0) >= 1080]
        # exclude_ids/shown_image_ids verwenden ueberall sonst im Code (draft_meta.json,
        # request-changes.yml new_unsplash_id) das "photo-<epoch>-<hash>"-Slug aus der
        # Bild-URL, NICHT Unsplash' kurze API-"id" - deshalb hier konsistent denselben
        # Slug fuer den Abgleich nehmen statt p["id"].
        photos = [p for p in photos if _photo_slug(p) not in exclude_ids]
        if not photos:
            print("   ⚠️  Keine neuen Unsplash-Ergebnisse (alle bereits vorgeschlagen oder zu klein) – nutze Fallback")
            return [{"url": fallback_url, "id": None}]
        # Zufaellige statt immer gleicher Auswahl der ersten Treffer, damit Claude Vision
        # nicht wieder auf denselben Kandidaten-Satz konvergiert. Pool etwas groesser als n,
        # damit Claude Vision beim Ranken echte Auswahl hat.
        pool_size = max(6, n + 2)
        photos = random.sample(photos, min(pool_size, len(photos)))

        # Schritt 3: Vorschaubilder laden
        candidates = []
        for p in photos:
            try:
                img_r = requests.get(p["urls"]["small"], timeout=8, headers={"User-Agent": "Mozilla/5.0"})
                img_r.raise_for_status()
                b64 = base64.b64encode(img_r.content).decode()
                mime = img_r.headers.get("content-type", "image/jpeg").split(";")[0]
                candidates.append({"raw": p["urls"]["raw"], "b64": b64, "mime": mime, "id": p["id"]})
            except Exception:
                pass

        if not candidates:
            return [{"url": fallback_url, "id": None}]

        # Schritt 4: Claude Vision rankt die Bilder (bestes zuerst)
        msg_content = []
        for i, c in enumerate(candidates):
            msg_content.append({"type": "image", "source": {"type": "base64", "media_type": c["mime"], "data": c["b64"]}})
            msg_content.append({"type": "text", "text": f"Bild {i + 1}"})

        n_wanted = max(1, min(n, len(candidates)))
        msg_content.append({"type": "text", "text": (
            f'Thema: "{topic_title}" (Kategorie: {topic_label})\n\n'
            "Ranke diese Bilder für dieses deutsche Versicherungsthema, bestes zuerst.\n"
            "Ein gutes Bild:\n"
            "✓ Zeigt das Thema direkt und konkret (z.B. echtes Auto für KFZ, Arzt für Kranken)\n"
            "✓ Ist scharf und klar fokussiert – KEIN verschwommenes/unscharfes Hauptmotiv, "
            "kein starker Bokeh-/Weichzeichner-Effekt, kein Bewegungsunschärfe\n"
            "✓ Wirkt hell und freundlich – kein düsteres Stimmungsbild\n"
            "✓ Zeigt ein gepflegtes, intaktes Haus/Zuhause – KEINE verlassene, heruntergekommene "
            "oder verwahrloste Ruine, auch wenn das Thema Einbruch/Schaden ist\n"
            "✓ Enthält keinen englischen Text\n"
            "✓ Zeigt echten Alltag – keine Hologramme, keine abstrakten Grafiken\n"
            "✓ Hat europäischen/deutschen Kontext\n\n"
            "Ein professioneller Versicherungsmakler nutzt diese Bilder für seine Social-Media-Werbung – "
            "sie müssen gestochen scharf sein.\n\n"
            f"Antworte NUR mit den {n_wanted} besten Bildnummern als kommagetrennte Liste, bestes zuerst "
            f"(z.B. \"3,1,5,2\"). Kein weiterer Text."
        )})

        pick_resp = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=30,
            messages=[{"role": "user", "content": msg_content}]
        )

        picks = [int(x) - 1 for x in re.findall(r'\d+', pick_resp.content[0].text)]
        picks = [p for p in picks if 0 <= p < len(candidates)]
        # Duplikate entfernen, Reihenfolge (= Ranking) beibehalten
        seen_picks = []
        for p in picks:
            if p not in seen_picks:
                seen_picks.append(p)
        # Falls die KI weniger als gewuenscht liefert (z.B. Parsing-Fehler), mit den
        # restlichen Kandidaten in Originalreihenfolge auffuellen statt Faelle zu verlieren.
        for i in range(len(candidates)):
            if len(seen_picks) >= n_wanted:
                break
            if i not in seen_picks:
                seen_picks.append(i)

        results = []
        for pick in seen_picks[:n_wanted]:
            chosen = candidates[pick]
            # chosen['raw'] enthaelt bei Unsplash bereits einen Query-String (ixid/ixlib) -
            # ein zweites "?" wuerde die URL kaputt machen (w/h landen dann in ixlib statt
            # als eigene Parameter, das Bild kommt unskaliert/zu gross zurueck).
            sep = "&" if "?" in chosen['raw'] else "?"
            results.append({
                "url": f"{chosen['raw']}{sep}w=1200&h=630&fit=crop&auto=format",
                "id": chosen["id"],
            })
        print(f"   ✅ KI rankte {len(results)} Bild(er) (bestes: {results[0]['id']})")
        return results

    except Exception as e:
        print(f"   ⚠️  Dynamische Bildauswahl fehlgeschlagen: {e} – nutze Fallback")
        return [{"url": fallback_url, "id": None}]
