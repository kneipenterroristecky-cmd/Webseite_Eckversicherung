#!/usr/bin/env python3
"""
Veröffentlicht den freigegebenen Blog-Beitrag auf:
1. Webseite (GitHub Commit)
2. Facebook-Seite
3. Instagram Business
"""
import os, json, base64, time, requests

# ── Metadaten laden ────────────────────────────────────────────────────────────
with open("tools/draft_meta.json", encoding="utf-8") as f:
    meta = json.load(f)

GITHUB_TOKEN    = os.environ["GITHUB_TOKEN"]
REPO            = os.environ.get("GITHUB_REPOSITORY", "kneipenterroristecky-cmd/Webseite_Eckversicherung")
FB_PAGE_TOKEN   = os.environ.get("FB_PAGE_TOKEN", "")
FB_PAGE_ID      = os.environ.get("FB_PAGE_ID", "")
IG_USER_ID      = os.environ.get("IG_USER_ID", "")
IG_ACCESS_TOKEN = os.environ.get("IG_ACCESS_TOKEN", "")
SITE_URL        = os.environ.get("SITE_URL", "")

gh_headers = {
    "Authorization": f"Bearer {GITHUB_TOKEN}",
    "Accept": "application/vnd.github.v3+json",
    "X-GitHub-Api-Version": "2022-11-28"
}

errors = []


def _update_blog_index(meta, repo, headers):
    """Fügt den neuen Beitrag oben in blog/index.html ein."""
    index_url = f"https://api.github.com/repos/{repo}/contents/blog/index.html"
    r = requests.get(index_url, headers=headers)
    if r.status_code != 200:
        return
    current = r.json()
    html = base64.b64decode(current["content"]).decode("utf-8")

    # Platzhalter entfernen falls noch vorhanden
    html = html.replace(
        '\n      <div class="blog-empty">\n        <i class="fas fa-pen-to-square" style="font-size:32px; display:block; margin-bottom:12px;"></i>\n        Die ersten Beiträge erscheinen in Kürze.\n      </div>', ""
    )

    new_card = f"""      <a href="posts/{meta['filename']}" class="blog-card reveal">
        <div class="blog-card-label">{meta['label']}</div>
        <h2 class="blog-card-title">{meta['title']}</h2>
        <p class="blog-card-date">{meta['date_de']}</p>
        <span class="blog-card-more">Weiterlesen <i class="fas fa-arrow-right"></i></span>
      </a>"""

    html = html.replace("<!-- POSTS_START -->", f"<!-- POSTS_START -->\n{new_card}", 1)

    updated_b64 = base64.b64encode(html.encode("utf-8")).decode()
    requests.put(index_url, headers=headers, json={
        "message": f"Blog-Index: {meta['title']} hinzugefügt",
        "content": updated_b64,
        "sha": current["sha"],
        "branch": "master"
    })


# ════════════════════════════════════════════════════════════════════════════════
# 1. WEBSEITE – Blog-Post committen
# ════════════════════════════════════════════════════════════════════════════════
print("📡 Webseite: Blog-Post hochladen …")
try:
    post_path = f"blog/posts/{meta['filename']}"
    with open(post_path, "rb") as f:
        content_b64 = base64.b64encode(f.read()).decode()

    api_url = f"https://api.github.com/repos/{REPO}/contents/{post_path}"
    check = requests.get(api_url, headers=gh_headers)
    payload = {
        "message": f"📝 Blog: {meta['title']}",
        "content": content_b64,
        "branch": "master"
    }
    if check.status_code == 200:
        payload["sha"] = check.json()["sha"]

    r = requests.put(api_url, headers=gh_headers, json=payload)
    r.raise_for_status()
    print(f"   ✅ Webseite: {meta['post_url']}")

    _update_blog_index(meta, REPO, gh_headers)

except Exception as e:
    errors.append(f"Webseite: {e}")
    print(f"   ❌ Webseite fehlgeschlagen: {e}")


# ════════════════════════════════════════════════════════════════════════════════
# 2. FACEBOOK – Seitenbeitrag posten
# ════════════════════════════════════════════════════════════════════════════════
if FB_PAGE_TOKEN and FB_PAGE_ID:
    print("📡 Facebook: Beitrag posten …")
    try:
        full_url = SITE_URL.rstrip("/") + "/" + meta['post_url'].lstrip("/")
        fb_text = (
            f"📰 {meta['title']}\n\n"
            f"{meta['social_summary']}\n\n"
            f"Den vollständigen Beitrag jetzt lesen 👇\n"
            f"{full_url}\n\n"
            f"#DanielEck #Versicherungsmakler #Schmalkalden"
        )
        r = requests.post(
            f"https://graph.facebook.com/v21.0/{FB_PAGE_ID}/feed",
            data={"message": fb_text, "link": full_url, "access_token": FB_PAGE_TOKEN}
        )
        r.raise_for_status()
        print(f"   ✅ Facebook: gepostet (Post-ID: {r.json().get('id')})")
    except Exception as e:
        errors.append(f"Facebook: {e}")
        print(f"   ❌ Facebook fehlgeschlagen: {e}")
else:
    print("   ⚠️  Facebook übersprungen (Token nicht konfiguriert)")


# ════════════════════════════════════════════════════════════════════════════════
# 3. INSTAGRAM – Bild + Caption posten
# ════════════════════════════════════════════════════════════════════════════════
if IG_USER_ID and IG_ACCESS_TOKEN:
    print("📡 Instagram: Beitrag posten …")
    try:
        # Bild von Unsplash (nach Thema)
        query = meta.get("unsplash_query", "insurance").replace(" ", ",")
        img_url = f"https://source.unsplash.com/1080x1080/?{query}"

        caption = meta['instagram_caption'] + "\n\n🔗 Link in Bio"

        # Schritt 1: Media-Container erstellen
        r1 = requests.post(
            f"https://graph.facebook.com/v21.0/{IG_USER_ID}/media",
            data={"image_url": img_url, "caption": caption, "access_token": IG_ACCESS_TOKEN}
        )
        r1.raise_for_status()
        container_id = r1.json()["id"]

        # Kurz warten bis das Bild verarbeitet ist
        time.sleep(8)

        # Schritt 2: Veröffentlichen
        r2 = requests.post(
            f"https://graph.facebook.com/v21.0/{IG_USER_ID}/media_publish",
            data={"creation_id": container_id, "access_token": IG_ACCESS_TOKEN}
        )
        r2.raise_for_status()
        print(f"   ✅ Instagram: gepostet (Media-ID: {r2.json().get('id')})")
    except Exception as e:
        errors.append(f"Instagram: {e}")
        print(f"   ❌ Instagram fehlgeschlagen: {e}")
else:
    print("   ⚠️  Instagram übersprungen (Token nicht konfiguriert)")


# ════════════════════════════════════════════════════════════════════════════════
# Ergebnis
# ════════════════════════════════════════════════════════════════════════════════
print("\n" + "═" * 60)
if errors:
    print(f"⚠️  Fertig mit {len(errors)} Fehler(n):")
    for e in errors:
        print(f"   • {e}")
    exit(1)
else:
    print(f"🎉 Alles veröffentlicht: \"{meta['title']}\"")
    print(f"   🌐 {meta['post_url']}")
