# Social-Lead-Scout – Neukundengewinn über soziale Medien

Durchsucht wöchentlich (Intervall einstellbar) öffentlich von Google
indexierte Beiträge auf X/Twitter, Facebook, Instagram, Reddit und Foren
nach Formulierungen wie *"Suche Alternative zu ..."*, *"Weiß jemand ..."*,
*"Wer kann mir ... empfehlen"* rund um deine Versicherungsthemen. Neue
Treffer landen automatisch im Google Sheet "Social-Leads" (Status- und
Notiz-Spalte direkt dort bearbeitbar, sortier- und filterbar) und werden dir
per E-Mail zusammengefasst.

## Wichtig: was das Tool kann – und was nicht

Es gibt **keine** offizielle API, mit der man Facebook, Instagram oder
TikTok nach beliebigen Stichwörtern fremder Nutzer durchsuchen kann (Meta
und TikTok erlauben das nur für eigene Seiten/Werbekonten). Ein Scraper, der
das umgeht, würde gegen die Nutzungsbedingungen verstoßen – das baue ich
dir nicht.

Stattdessen nutzt dieses Tool die **Google-Suche** (Custom Search API), um
öffentlich zugängliche, von Google indexierte Beiträge zu finden. Das heißt
konkret:

- **Reddit, Foren (gutefrage.net, wer-weiss-was.de, Quora)**: gute Abdeckung,
  wird zuverlässig gefunden.
- **Facebook**: nur öffentliche Seiten/Gruppen-Beiträge, die Google indexiert
  hat – private Gruppen sieht Google nicht.
- **Instagram**: nur Bildunterschriften, die Google indexiert hat – eher
  lückenhaft.
- **X/Twitter**: seit den API-Änderungen 2023 indexiert Google nur noch
  einen kleinen Teil der Tweets – Abdeckung ist spürbar schwächer als früher.
- **TikTok**: praktisch nicht erfasst (dort steht der Text meist im Video,
  nicht im indexierbaren Seitentext).

Das Tool ist also ein solides Radar für Reddit/Foren/öffentliches Facebook,
aber kein Ersatz für eine Social-Media-Monitoring-Profi-Lösung (z.B.
Mention.com, Brand24 – kostenpflichtig, ~30-100€/Monat, dafür mit direktem
Plattform-Zugriff und besserer X/TikTok-Abdeckung). Wenn dir die Trefferzahl
nach ein paar Wochen zu gering ist, sag Bescheid – dann können wir eines
davon anbinden.

## Einmalige Einrichtung (ca. 15 Minuten)

### 1. Google Custom Search API + Suchmaschine anlegen

1. https://programmablesearchengine.google.com/ → **Neue Suchmaschine
   erstellen**.
2. "Im gesamten Web suchen" aktivieren (nicht nur bestimmte Seiten).
3. Erstellen → auf der Übersichtsseite die **Suchmaschinen-ID** (cx) kopieren.
4. https://console.cloud.google.com/apis/library/customsearch.googleapis.com
   → Projekt wählen/anlegen → **Custom Search API aktivieren**.
5. Dort unter "Anmeldedaten" → **API-Schlüssel erstellen** → kopieren.
6. Kostenlos: 100 Suchanfragen/Tag. Danach 5 $ pro 1000 Anfragen. Mit der
   Standard-Einstellung `max_queries_per_run: 30` (einmal pro Woche) bleibst
   du weit im kostenlosen Rahmen.

### 2. Apps Script (Code.gs) einrichten

1. In `Code.gs` ist bereits alles vorbereitet (Sheet "Social-Leads",
   Aktion `social_lead_add`). Trage nur noch bei
   `SOCIAL_SCOUT_SECRET` ein eigenes, zufälliges Geheimwort ein (ersetzt
   `BITTE_EIGENES_GEHEIMWORT_EINTRAGEN`).
2. Falls die Web-App noch nicht (neu) bereitgestellt ist: im Apps-Script-
   Editor → **Bereitstellen → Neue Bereitstellung** → Typ "Web-App" →
   Ausführen als "Ich" → Zugriff "Jeder" → Bereitstellen → URL kopieren.
   (Dieselbe URL nutzt du auch für `analytics.js`, falls die dort noch
   fehlt.)

### 3. Lokale Konfiguration ausfüllen

Öffne `tools/social_lead_scout_config.json` und trage ein:

- `google_api_key`, `google_cx` → aus Schritt 1
- `apps_script_url` → die `.../exec`-URL aus Schritt 2
- `social_scout_secret` → dasselbe Geheimwort wie in `Code.gs`

Optional anpassen:

- `themen` → Liste deiner Versicherungsthemen (Standard: die wichtigsten
  Produkte deiner Website)
- `phrase_templates` → Suchmuster (z.B. weitere Formulierungen ergänzen)
- `platforms` → welche Plattformen/Foren durchsucht werden
- `max_queries_per_run` → wie viele Suchanfragen pro Lauf (Kosten-Bremse)

Diese Datei enthält Zugangsdaten – nicht committen/pushen.

### 4. Einmal manuell testen

```
python tools/social_lead_scout.py
```

Erwartung: Konsolen-Ausgabe mit Trefferzahl, neue Zeilen im Sheet
"Social-Leads", ggf. eine Test-E-Mail.

### 5. Wöchentlichen Lauf einrichten

```powershell
powershell -File tools/register_social_lead_scout_task.ps1
```

Standard: jeden Montag 07:00 Uhr. Andere Zeit/Intervall:

```powershell
powershell -File tools/register_social_lead_scout_task.ps1 -DayOfWeek Friday -Time "08:30" -IntervalWeeks 2
```

Der Task läuft dann selbstständig im Hintergrund (Windows Task Scheduler),
auch ohne offenes Terminal – der PC muss dafür zur eingestellten Zeit an sein.

## Tägliche Nutzung

- Neue Treffer kommen per E-Mail an `daniel@eckversicherung.de` und stehen
  im Google Sheet "Social-Leads" (gleiche Tabelle wie die anderen Leads).
- Status direkt im Sheet pflegen: `neu` → `in Bearbeitung` → `erledigt` /
  `kein Interesse` (Dropdown in der Status-Spalte).
- Notiz-Spalte frei nutzbar für Kommentare ("angeschrieben am ...", "kein
  Bedarf, nur Frust über alten Vertrag" etc.).
- Sheet ist über den normalen Google-Sheets-Filter (Spaltenkopf-Icons)
  sortier- und filterbar – z.B. nach Thema oder Status filtern.
- Wiederholte URLs werden automatisch übersprungen (lokale Datei
  `tools/social_lead_scout_seen.json` + Abgleich im Sheet selbst).
