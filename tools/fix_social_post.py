#!/usr/bin/env python3
"""
Löscht einen bereits veröffentlichten Facebook-/Instagram-Beitrag und postet ihn mit dem
aktuellen Bild aus tools/draft_meta.json neu (z.B. wenn im Nachhinein ein besseres Bild
gefunden wurde). Wird manuell über den Workflow "Social-Beitrag korrigieren" ausgelöst.
"""
import os, json, time, requests

FB_POST_ID   = os.environ.get("FB_POST_ID", "").strip()
IG_MEDIA_ID  = os.environ.get("IG_MEDIA_ID", "").strip()
FB_PAGE_TOKEN = os.environ.get("FB_PAGE_TOKEN", "")
FB_PAGE_ID    = os.environ.get("FB_PAGE_ID", "")
IG_USER_ID    = os.environ.get("IG_USER_ID", "")
IG_ACCESS_TOKEN = FB_PAGE_TOKEN
SITE_URL      = os.environ.get("SITE_URL", "")

with open("tools/draft_meta.json", encoding="utf-8") as f:
    meta = json.load(f)

errors = []

# ════════════════════════════════════════════════════════════════════════════════
# 1. Alten Facebook-Beitrag löschen
# ════════════════════════════════════════════════════════════════════════════════
if FB_POST_ID and FB_PAGE_TOKEN:
    print(f"🗑️  Facebook: lösche alten Beitrag {FB_POST_ID} …")
    r = requests.delete(
        f"https://graph.facebook.com/v21.0/{FB_POST_ID}",
        params={"access_token": FB_PAGE_TOKEN}
    )
    print(f"   FB Delete Response: {r.status_code} – {r.text[:300]}")
else:
    print("   ℹ️  Kein FB_POST_ID angegeben – Facebook-Löschung übersprungen")

# ════════════════════════════════════════════════════════════════════════════════
# 2. Alten Instagram-Beitrag löschen (falls von der API unterstützt)
# ════════════════════════════════════════════════════════════════════════════════
if IG_MEDIA_ID and IG_ACCESS_TOKEN:
    print(f"🗑️  Instagram: lösche alten Beitrag {IG_MEDIA_ID} …")
    r = requests.delete(
        f"https://graph.facebook.com/v21.0/{IG_MEDIA_ID}",
        params={"access_token": IG_ACCESS_TOKEN}
    )
    print(f"   IG Delete Response: {r.status_code} – {r.text[:300]}")
    if r.status_code >= 300:
        errors.append(f"Instagram-Löschung fehlgeschlagen (Status {r.status_code}) – bitte manuell in der Instagram-App löschen: Media-ID {IG_MEDIA_ID}")
else:
    print("   ℹ️  Kein IG_MEDIA_ID angegeben – Instagram-Löschung übersprungen")

# ════════════════════════════════════════════════════════════════════════════════
# 3. Facebook – neu posten
# ════════════════════════════════════════════════════════════════════════════════
if FB_PAGE_TOKEN and FB_PAGE_ID:
    print("📡 Facebook: Bild-Beitrag neu posten …")
    try:
        post_url = meta['post_url']
        full_url = post_url if post_url.startswith('http') else SITE_URL.rstrip("/") + "/" + post_url.lstrip("/")
        fb_text = (
            f"💡 {meta['social_summary']}\n\n"
            f"Den vollständigen Beitrag jetzt lesen 👇\n{full_url}\n\n"
            f"#Versicherungsmakler #Schmalkalden"
        )
        social_image_url = meta.get("social_image_url", "")
        fb_img_url = social_image_url if social_image_url else meta.get("og_image", "")

        r = requests.post(
            f"https://graph.facebook.com/v21.0/{FB_PAGE_ID}/photos",
            data={"url": fb_img_url, "message": fb_text, "access_token": FB_PAGE_TOKEN}
        )
        print(f"   FB Response: {r.status_code} – {r.text[:300]}")
        r.raise_for_status()
        print(f"   ✅ Facebook: neu gepostet (Post-ID: {r.json().get('id')})")
    except Exception as e:
        errors.append(f"Facebook neu posten: {e}")
        print(f"   ❌ Facebook fehlgeschlagen: {e}")
else:
    print("   ⚠️  Facebook übersprungen (Token nicht konfiguriert)")

# ════════════════════════════════════════════════════════════════════════════════
# 4. Instagram – neu posten
# ════════════════════════════════════════════════════════════════════════════════
if IG_USER_ID and IG_ACCESS_TOKEN:
    print("📡 Instagram: Beitrag neu posten …")
    try:
        social_image_url = meta.get("social_image_url", "")
        og_image = meta.get("og_image", "")
        if social_image_url:
            img_url = social_image_url
        elif og_image:
            img_url = og_image.replace("w=1200&h=630", "w=1080&h=1080")
        else:
            img_url = "https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=1080&h=1080&fit=crop&auto=format"

        import re as _re
        _cap = meta['instagram_caption']
        _cap = _re.sub(r'#DanielEck\b', '', _cap, flags=_re.IGNORECASE)
        _cap = _re.sub(r'\bDaniel Eck\b', '', _cap)
        _cap = _re.sub(r' +', ' ', _cap).strip()
        caption = _cap + "\n\n🔗 Link in Bio"

        r1 = requests.post(
            f"https://graph.facebook.com/v21.0/{IG_USER_ID}/media",
            data={"image_url": img_url, "caption": caption, "access_token": IG_ACCESS_TOKEN}
        )
        r1.raise_for_status()
        container_id = r1.json()["id"]

        time.sleep(8)

        r2 = requests.post(
            f"https://graph.facebook.com/v21.0/{IG_USER_ID}/media_publish",
            data={"creation_id": container_id, "access_token": IG_ACCESS_TOKEN}
        )
        r2.raise_for_status()
        print(f"   ✅ Instagram: neu gepostet (Media-ID: {r2.json().get('id')})")
    except Exception as e:
        errors.append(f"Instagram neu posten: {e}")
        print(f"   ❌ Instagram fehlgeschlagen: {e}")
else:
    print("   ⚠️  Instagram übersprungen (Token nicht konfiguriert)")

print("\n" + "═" * 60)
if errors:
    print(f"⚠️  Fertig mit {len(errors)} Hinweis(en)/Fehler(n):")
    for e in errors:
        print(f"   • {e}")
    exit(1)
else:
    print(f"🎉 Beitrag korrigiert und neu veröffentlicht: \"{meta['title']}\"")
