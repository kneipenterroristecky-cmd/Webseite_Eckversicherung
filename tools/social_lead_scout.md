# Social-Lead-Scout – Neukundengewinn über soziale Medien

Durchsucht wöchentlich (Zeitpunkt/Häufigkeit einstellbar) öffentlich von
Google indexierte Beiträge auf X/Twitter, Facebook, Instagram, Reddit und
Foren nach Formulierungen wie *"Suche Alternative zu ..."*, *"Weiß
jemand ..."*, *"Wer kann mir ... empfehlen"* rund um deine
Versicherungsthemen. Neue Treffer landen automatisch im Google Sheet
"Social-Leads" (Status- und Notiz-Spalte direkt dort bearbeitbar, sortier-
und filterbar) und werden dir per E-Mail zusammengefasst.

Läuft – genau wie der automatische Blog-Beitrag (`weekly-blog-post.yml`) –
als GitHub Action in der Cloud. Dein PC muss dafür nicht an sein.

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

## Einmalige Einrichtung (ca. 5 Minuten)

### 1. SerpApi-Konto anlegen

Wir nutzen [SerpApi](https://serpapi.com/) statt der Google Custom Search API
direkt – Google verlangt für die eigene API inzwischen ein vollständiges
Bezahlkonto (nicht nur eine Testphase) und das Einrichten war in der Praxis
zu fehleranfällig. SerpApi liefert dieselben echten Google-Suchergebnisse als
einfaches JSON, ganz ohne Google-Cloud-Konto:

1. https://serpapi.com/users/sign_up → mit E-Mail oder Google-Konto anmelden
   (keine Kreditkarte nötig für den kostenlosen Plan).
2. Im Dashboard unter "Your Private API Key" den Schlüssel kopieren.
3. Kostenlos: 250 Suchanfragen/Monat. Mit der Standard-Einstellung
   `max_queries_per_run: 30` (einmal pro Woche = ca. 120/Monat) bleibst du
   sicher im kostenlosen Rahmen.

### 2. Apps Script (Code.gs) einrichten

1. In `Code.gs` ist bereits alles vorbereitet (Sheet "Social-Leads",
   Aktion `social_lead_add`). Trage nur noch bei
   `SOCIAL_SCOUT_SECRET` ein eigenes, zufälliges Geheimwort ein (ersetzt
   `BITTE_EIGENES_GEHEIMWORT_EINTRAGEN`) und speichere/aktualisiere das
   Skript im Apps-Script-Editor.
2. Falls die Web-App noch nicht (neu) bereitgestellt ist: im Apps-Script-
   Editor → **Bereitstellen → Neue Bereitstellung** → Typ "Web-App" →
   Ausführen als "Ich" → Zugriff "Jeder" → Bereitstellen → URL kopieren.
   (Dieselbe URL brauchst du auch für `analytics.js`, falls dort noch leer.)

### 3. GitHub Secrets eintragen

Im Repo auf GitHub: **Settings → Secrets and variables → Actions → New
repository secret**. Drei Secrets anlegen:

| Name | Wert |
|---|---|
| `SERPAPI_KEY` | API-Schlüssel aus Schritt 1.2 |
| `APPS_SCRIPT_URL` | Web-App-URL aus Schritt 2.2 (endet auf `/exec`) |
| `SOCIAL_SCOUT_SECRET` | dasselbe Geheimwort wie in `Code.gs` |

Themen, Suchmuster und Plattformen (keine Geheimnisse) stehen stattdessen
direkt im Repo in `tools/social_lead_scout_topics.json` – dort kannst du
jederzeit anpassen:

- `themen` → Liste deiner Versicherungsthemen (Standard: die wichtigsten
  Produkte deiner Website)
- `phrase_templates` → Suchmuster (z.B. weitere Formulierungen ergänzen)
- `platforms` → welche Plattformen/Foren durchsucht werden
- `max_queries_per_run` → wie viele Suchanfragen pro Lauf (Kosten-Bremse)

### 4. Einmal manuell testen

GitHub → Reiter **Actions** → Workflow "Social-Lead-Scout (Neukundengewinn
soziale Medien)" → **Run workflow** → grünen Button klicken.

Erwartung: Workflow läuft grün durch, neue Zeilen im Google Sheet
"Social-Leads" (falls Treffer da sind), ggf. eine E-Mail.

## Zeitpunkt/Häufigkeit ändern

In `.github/workflows/social-lead-scout.yml` die `cron`-Zeile anpassen,
z.B.:

- `0 6 * * 1` = jeden Montag 06:00 UTC (Standard)
- `0 6 * * 1,4` = jeden Montag **und** Donnerstag
- `0 6 1,15 * *` = am 1. und 15. jeden Monats

(Uhrzeiten sind UTC – Sommerzeit DE = UTC+2, Winterzeit DE = UTC+1.)

## Tägliche Nutzung

- Neue Treffer kommen per E-Mail an `daniel@eckversicherung.de` und stehen
  im Google Sheet "Social-Leads" (gleiche Tabelle wie die anderen Leads).
- Status direkt im Sheet pflegen: `neu` → `in Bearbeitung` → `erledigt` /
  `kein Interesse` (Dropdown in der Status-Spalte).
- Notiz-Spalte frei nutzbar für Kommentare ("angeschrieben am ...", "kein
  Bedarf, nur Frust über alten Vertrag" etc.).
- Sheet ist über den normalen Google-Sheets-Filter (Spaltenkopf-Icons)
  sortier- und filterbar – z.B. nach Thema oder Status filtern.
- Wiederholte URLs werden automatisch übersprungen (der Workflow committet
  seinen Fortschritt nach jedem Lauf zurück ins Repo, zusätzlich prüft auch
  das Sheet selbst gegen bestehende URLs).
