#!/usr/bin/env python3
"""Gemeinsame Bildsuche: Unsplash durchsuchen und Claude Vision das passendste Bild wählen lassen.
Wird von generate_post.py (Workflow 1) und request-changes.yml (Workflow 3) genutzt.
"""
import re
import base64
import requests


def find_best_image(topic_title, topic_label, topic_query, client, fallback_url, unsplash_key):
    """Sucht auf Unsplash und lässt Claude Vision das thematisch passendste Bild wählen."""
    if not unsplash_key:
        print("   ℹ️  Kein UNSPLASH_ACCESS_KEY – nutze Fallback-Bild")
        return fallback_url

    # Schritt 1: KI generiert optimierten Suchbegriff
    try:
        q_resp = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=30,
            messages=[{"role": "user", "content": (
                f'Deutsche Versicherungs-Website. Blog-Thema: "{topic_title}".\n'
                "Gib einen englischen Foto-Suchbegriff (max 4 Wörter) für ein echtes, "
                "helles, alltagsnahes Foto passend zum Thema. "
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
            params={"query": search_query, "per_page": 8, "orientation": "landscape", "content_filter": "high"},
            headers={"Authorization": f"Client-ID {unsplash_key}"},
            timeout=15
        )
        if r.status_code != 200:
            print(f"   ⚠️  Unsplash API {r.status_code} – nutze Fallback")
            return fallback_url

        photos = r.json().get("results", [])
        # Zu kleine Originale ausschliessen – sonst skaliert Unsplash beim Zuschnitt
        # auf 1080x1920 hoch, was das Bild unscharf/verwaschen macht.
        photos = [p for p in photos if p.get("width", 0) >= 1080 and p.get("height", 0) >= 1080][:6]
        if not photos:
            print("   ⚠️  Keine ausreichend hochaufgelösten Unsplash-Ergebnisse – nutze Fallback")
            return fallback_url

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
            return fallback_url

        # Schritt 4: Claude Vision wählt das beste Bild
        msg_content = []
        for i, c in enumerate(candidates):
            msg_content.append({"type": "image", "source": {"type": "base64", "media_type": c["mime"], "data": c["b64"]}})
            msg_content.append({"type": "text", "text": f"Bild {i + 1}"})

        msg_content.append({"type": "text", "text": (
            f'Thema: "{topic_title}" (Kategorie: {topic_label})\n\n'
            "Welches Bild passt am BESTEN zu diesem deutschen Versicherungsthema?\n"
            "Wähle das Bild das:\n"
            "✓ Das Thema direkt und konkret zeigt (z.B. echtes Auto für KFZ, Arzt für Kranken)\n"
            "✓ Hell und freundlich wirkt – kein düsteres Stimmungsbild\n"
            "✓ Keinen englischen Text enthält\n"
            "✓ Echten Alltag zeigt – keine Hologramme, keine abstrakten Grafiken\n"
            "✓ Europäischen/deutschen Kontext hat\n\n"
            f"Antworte NUR mit einer Zahl (1–{len(candidates)}). Kein weiterer Text."
        )})

        pick_resp = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=5,
            messages=[{"role": "user", "content": msg_content}]
        )

        pick_match = re.search(r'\d+', pick_resp.content[0].text)
        if not pick_match:
            print(f"   ⚠️  Unerwartete KI-Antwort – nutze Fallback")
            return fallback_url

        pick = int(pick_match.group()) - 1
        pick = max(0, min(pick, len(candidates) - 1))
        chosen = candidates[pick]
        result_url = f"{chosen['raw']}?w=1200&h=630&fit=crop&auto=format"
        print(f"   ✅ KI wählte Bild {pick + 1}/{len(candidates)} (Unsplash-ID: {chosen['id']})")
        return result_url

    except Exception as e:
        print(f"   ⚠️  Dynamische Bildauswahl fehlgeschlagen: {e} – nutze Fallback")
        return fallback_url
