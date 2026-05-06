#!/usr/bin/env python3
"""
Rendert social/latest-ig.html mit Playwright zu social/latest-ig.png (1080×1080).
"""
import os, json
from playwright.sync_api import sync_playwright

html_path = os.path.abspath("social/latest-ig.html")
output_path = "social/latest-ig.png"

if not os.path.exists(html_path):
    print(f"❌ Datei nicht gefunden: {html_path}")
    exit(1)

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page(viewport={"width": 1080, "height": 1080})
    page.goto(f"file://{html_path}", wait_until="networkidle", timeout=30000)
    # Warten bis Google Fonts geladen sind
    page.wait_for_timeout(2000)
    page.screenshot(
        path=output_path,
        clip={"x": 0, "y": 0, "width": 1080, "height": 1080}
    )
    browser.close()

print(f"✅ Social Image erstellt: {output_path}")
