#!/usr/bin/env python3
"""
Rendert social/latest-ig.html mit Playwright zu social/latest-ig.png (1080×1080).
Das Hintergrundbild wird zuerst heruntergeladen und als Base64 eingebettet,
damit Playwright keine externen Requests machen muss.
"""
import os, re, base64, requests
from playwright.sync_api import sync_playwright

html_path = os.path.abspath("social/latest-ig.html")
tmp_path  = os.path.abspath("social/latest-ig-render.html")
output_path = "social/latest-ig.png"

if not os.path.exists(html_path):
    print(f"❌ Datei nicht gefunden: {html_path}")
    exit(1)

with open(html_path, encoding="utf-8") as f:
    html = f.read()

# Hintergrundbild herunterladen und als Base64 einbetten
img_match = re.search(r'<img class="bg-img" src="([^"]+)"', html)
if img_match:
    img_url = img_match.group(1)
    try:
        r = requests.get(img_url, timeout=25, headers={"User-Agent": "Mozilla/5.0"})
        r.raise_for_status()
        mime = r.headers.get("content-type", "image/jpeg").split(";")[0]
        b64 = base64.b64encode(r.content).decode()
        html = html.replace(f'src="{img_url}"', f'src="data:{mime};base64,{b64}"')
        print(f"   ✅ Bild eingebettet ({len(r.content)//1024} KB)")
    except Exception as e:
        print(f"   ⚠️  Bild-Download fehlgeschlagen: {e} – Screenshot trotzdem versuchen")

with open(tmp_path, "w", encoding="utf-8") as f:
    f.write(html)

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page(viewport={"width": 1080, "height": 1080})
    page.goto(f"file://{tmp_path}", wait_until="networkidle", timeout=30000)
    page.wait_for_timeout(1500)
    page.screenshot(
        path=output_path,
        clip={"x": 0, "y": 0, "width": 1080, "height": 1080}
    )
    browser.close()

os.remove(tmp_path)
print(f"✅ Social Image erstellt: {output_path}")
