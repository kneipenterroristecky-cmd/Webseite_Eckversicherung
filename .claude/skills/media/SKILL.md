---
name: media
description: Erzeugt KI-Bilder und -Videos direkt über die KIE-AI-API (statt über ein Higgsfield/OpenArt-Abo) und pflegt eine lokale HTML-Galerie aller Erzeugungen inkl. Prompt, Modell und Kosten. Nutzen, wenn der Nutzer "/media" aufruft oder um KI-generierte Werbe-/Anzeigenbilder, Produktfotos, Hero-Bilder oder kurze Loop-Videos für die Webseite bittet.
---

# Media-Skill: eigene KI-Bild-/Video-Werkstatt statt Higgsfield-Abo

Dieser Skill spricht KI-Modelle (Nano Banana, GPT Image 2, u.a.) direkt über die
**KIE-AI-API** (https://api.kie.ai) an. Es gibt kein Abo, sondern reine
Pay-per-Use-Kosten pro Bild/Video. Alle Erzeugungen landen lokal im Ordner
`media-ai/` (nicht im Git-Repo, siehe `.gitignore`) und werden in einer
lokalen HTML-Galerie (`media-ai/gallery.html`) gesammelt.

## Voraussetzung: API-Key

Ohne Key funktioniert dieser Skill nicht. Prüfe zuerst, ob die Umgebungsvariable
`KIE_AI_API_KEY` gesetzt ist (`echo $KIE_AI_API_KEY` bzw. `$env:KIE_AI_API_KEY`).

Falls nicht gesetzt:
1. Sag dem Nutzer, dass er sich kostenlos unter https://kie.ai registrieren
   und dort einen API-Key erzeugen muss (Dashboard → API Keys). Es gibt
   Startguthaben, danach lädt man nach Bedarf Guthaben nach (kein Abo).
2. Der Key darf **niemals** in eine Datei geschrieben werden, die von Git
   erfasst wird (dieses Repo hat einen Auto-Commit-Hook, der jede
   Write/Edit-Änderung sofort committet und zu GitHub pusht!). Lege den Key
   stattdessen in einer lokalen `.env`-Datei im Projekt-Root ab (steht in
   `.gitignore`) oder als Windows-Umgebungsvariable:
   ```
   setx KIE_AI_API_KEY "sk-..."
   ```
   oder in `.env`:
   ```
   KIE_AI_API_KEY=sk-...
   ```
3. Lies den Key in Bash/PowerShell-Aufrufen immer aus der Umgebungsvariable
   aus, gib ihn nie im Klartext im Chat oder in einer Datei aus.

## Kosten-Bremse (wichtig!)

- Frag **immer** nach einem Budget (in €/$), falls der Nutzer keins nennt.
- Rechne die geplanten Erzeugungen grob gegen die Preise in `models/*.md`
  vor dem ersten API-Call und nenne die geschätzten Gesamtkosten kurz.
- Erzeuge **immer nur eine Generierung nach der anderen** (sequenziell,
  nicht parallel), damit man nicht in Rate-Limits läuft (KIE erlaubt max.
  20 neue Requests / 10 Sekunden) und damit Kosten kontrollierbar bleiben.
- Brich ab und frag nach, wenn die tatsächlichen/erwarteten Kosten das
  genannte Budget überschreiten würden.
- Nach Abschluss: nenne die tatsächlich verbrauchten Kosten (aus
  `creditsConsumed` bzw. dem Preis pro Modell).

## Referenzbilder & echte Assets

- Wenn eine echte Bilddatei existiert (Logo, Produktfoto, Firmengebäude,
  Screenshot), **beschreib sie niemals nur in Worten im Prompt** – nutze sie
  immer als tatsächliches Referenzbild (`image_input`/`image_urls`, siehe
  Modell-Dateien). Das ergibt deutlich bessere und konsistentere Ergebnisse.
- Referenzbilder liegen entweder direkt im Chat (vom Nutzer angehängt) oder
  als lokale Datei. Lokale Dateien müssen zuerst hochgeladen werden, siehe
  `models/_upload.md` (KIE File-Upload-API), bevor man ihre URL als
  `image_input` benutzt. Hochgeladene Dateien werden bei KIE nach 3 Tagen
  automatisch gelöscht – für Reproduzierbarkeit lieber zusätzlich lokal unter
  `media-ai/references/` ablegen.

## Ablauf einer Generierung

1. Prompt, Referenzbilder, gewünschte Modelle/Varianten und Budget mit dem
   Nutzer klären (falls nicht schon alles im Auftrag steht).
2. Passende Modell-Datei(en) unter `models/` lesen für exaktes
   Request-Format und aktuellen Preis.
3. Falls lokale Referenzbilder verwendet werden: erst hochladen
   (`models/_upload.md`), URL merken.
4. Für jede Variante **einzeln nacheinander**:
   a. `POST https://api.kie.ai/api/v1/jobs/createTask` mit dem
      Modell-spezifischen Body absetzen (siehe Modell-Datei).
   b. `taskId` aus der Antwort merken.
   c. `GET https://api.kie.ai/api/v1/jobs/recordInfo?taskId=<id>` pollen
      (z.B. alle 3–5s), bis `data.state` = `success` oder `fail` ist.
   d. Bei `success`: `data.resultJson` parsen (`resultUrls`-Array) und die
      Datei per `curl -o` nach `media-ai/generated/<datum>_<kurzslug>.<ext>`
      herunterladen.
   e. Bei `fail`: `data.failMsg` dem Nutzer zeigen, nicht automatisch neu
      versuchen ohne Rückfrage, wenn es nicht offensichtlich ein transienter
      Fehler ist.
5. Jeden erfolgreichen Eintrag an `media-ai/library.json` anhängen (Feld
   siehe unten).
6. `media-ai/gallery.html` aus `media-ai/library.json` neu bauen (siehe
   "Galerie" unten) und dem Nutzer die Datei mit dem SendUserFile-Tool oder
   per Pfadangabe zum Öffnen anbieten.

## `library.json`-Eintrag

```json
{
  "id": "2026-09-01_trinkflasche-01",
  "type": "image",
  "model": "gpt-image-2-text-to-image",
  "prompt": "der exakte, tatsächlich genutzte Prompt",
  "referenceImages": ["media-ai/references/flasche.jpg"],
  "costUsd": 0.05,
  "createdAt": "2026-09-01T12:34:00+02:00",
  "filePath": "media-ai/generated/2026-09-01_trinkflasche-01.png"
}
```

Für Videos: `"type": "video"`, `filePath` zeigt auf die `.mp4`.

## Galerie (`media-ai/gallery.html`)

- Eine einzelne, selbstständige HTML-Datei ohne externe Requests (kein CDN,
  keine Internetverbindung nötig zum Ansehen).
- Zeigt alle Einträge aus `library.json` als Kachel-Raster mit Vorschau
  (Bild bzw. Video-Thumbnail/Poster), Filter nach Bild/Video, Sortierung
  nach Datum, Klick öffnet Detailansicht mit Prompt (kopierbar), Modell,
  Kosten, Dateipfad.
- Baue die Daten **inline** als JSON in ein `<script>`-Tag im HTML ein
  (kein separates `fetch('library.json')`, das scheitert bei `file://` an
  CORS in manchen Browsern). Beim Neubauen: `library.json` lesen, in die
  HTML-Vorlage einsetzen, Datei überschreiben.
- Bildpfade in der Galerie relativ (`generated/...`), da `gallery.html` im
  selben Ordner `media-ai/` liegt.
- Nach dem Neubau: Datei nicht automatisch im Browser öffnen (keine
  GUI-Interaktion verfügbar) – stattdessen dem Nutzer den Pfad nennen bzw.
  per SendUserFile anbieten.

## Übernahme ins Webprojekt

Bilder aus `media-ai/generated/` sind Entwürfe. Erst wenn der Nutzer ein
Bild für die eigentliche Webseite freigibt, kopiere es gezielt in den
passenden Projektordner (z.B. neben die anderen `.jpg`/`.png` im
Webseite-Root) – das löst dann den normalen Auto-Commit/Push-Hook aus.

## Verfügbare Modelle

Siehe `models/`:
- `gpt-image-2-text-to-image.md` – Bild aus reinem Textprompt
- `gpt-image-2-image-to-image.md` – Bild mit Referenzbild(ern)
- `nano-banana-pro.md` – Google Nano Banana Pro (hohe Auflösung, bis 4K)
- `nano-banana-edit.md` – Google Nano Banana Edit (Bildbearbeitung mit bis
  zu 10 Referenzbildern)
- `_upload.md` – lokale Dateien zu KIE hochladen, um eine `image_input`-URL
  zu bekommen

Neue Modelle ergänzen: Doku-Link des Anbieters (z.B. docs.kie.ai/market/...)
lesen, eine neue `models/<name>.md` nach demselben Schema anlegen (Modell-ID,
Request-Body, Preis, Besonderheiten) und hier in der Liste ergänzen.
