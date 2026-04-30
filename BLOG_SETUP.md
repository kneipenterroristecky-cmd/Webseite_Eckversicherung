# Blog-Automatisierung: Einrichtung

Jeden Montag erstellt die KI automatisch einen Versicherungs-Ratgeber in Ihrem Stil,
Sie bekommen eine E-Mail zur Freigabe, und nach einem Klick wird er auf
Webseite + Facebook + Instagram veröffentlicht.

---

## Schritt 1: GitHub Environment einrichten (Freigabe-Funktion)

1. Gehen Sie zu: `github.com/kneipenterroristecky-cmd/Webseite_Eckversicherung`
2. Klicken Sie oben auf **Settings**
3. Links im Menü: **Environments**
4. Klicken Sie **New environment**
5. Name eingeben: `freigabe` (genau so, Kleinbuchstaben)
6. Klicken Sie **Configure environment**
7. Bei **Required reviewers** → Ihren GitHub-Benutzernamen eingeben
8. **Save protection rules** klicken

✅ GitHub schickt Ihnen ab jetzt automatisch eine E-Mail wenn ein Beitrag wartet.

---

## Schritt 2: API-Keys als GitHub Secrets hinterlegen

Gehen Sie zu: `github.com/kneipenterroristecky-cmd/Webseite_Eckversicherung/settings/secrets/actions`

Klicken Sie **New repository secret** für jeden der folgenden Einträge:

| Secret Name     | Wert                          | Wo bekommen?                    |
|-----------------|-------------------------------|----------------------------------|
| `ANTHROPIC_API_KEY` | sk-ant-...                | https://console.anthropic.com   |
| `SITE_URL`      | https://kneipenterroristecky-cmd.github.io/Webseite_Eckversicherung | Ihre GitHub Pages URL |
| `FB_PAGE_TOKEN` | (Facebook Token, Schritt 3)   | Meta Developer                  |
| `FB_PAGE_ID`    | (Facebook Seiten-ID)          | Ihre Facebook-Seite             |
| `IG_USER_ID`    | (Instagram Business ID)       | Meta Developer                  |
| `IG_ACCESS_TOKEN` | (Instagram Token)           | Meta Developer                  |

---

## Schritt 3: Anthropic API-Key besorgen

1. Gehen Sie zu: https://console.anthropic.com
2. Registrieren / einloggen
3. **API Keys** → **Create Key**
4. Den Key kopieren und als Secret `ANTHROPIC_API_KEY` eintragen
5. Guthaben aufladen (ca. 5€ reichen für Monate)

---

## Schritt 4: Meta (Facebook + Instagram) einrichten

### 4a. Facebook-Seiten-ID herausfinden
1. Gehen Sie zu Ihrer Facebook-Seite
2. Klicken Sie **Über** → scrollen Sie nach unten
3. Die Nummer unter "Seiten-ID" ist Ihre `FB_PAGE_ID`

### 4b. Meta Developer App erstellen
1. Gehen Sie zu: https://developers.facebook.com
2. **Meine Apps** → **App erstellen**
3. Typ: **Andere** → **Weiter**
4. App-Name: "VersicherungsEck Blog" → **App erstellen**

### 4c. Facebook Login hinzufügen
1. In Ihrer App: **Produkte hinzufügen** → **Facebook Login** → **Einrichten**
2. Plattform: **Web** → Ihre Webseiten-URL eingeben

### 4d. Access Token generieren
1. In der App: **Tools** → **Graph API Explorer**
2. Oben rechts: Ihre App auswählen
3. **Generate Access Token** klicken → Mit Ihrer Facebook-Seite einloggen
4. Berechtigungen hinzufügen:
   - `pages_manage_posts`
   - `pages_read_engagement`
   - `instagram_basic`
   - `instagram_content_publish`
5. Token generieren → Token kopieren

### 4e. Langzeit-Token erstellen (wichtig!)
Der Token oben läuft nach 1 Stunde ab. Langzeit-Token erstellen:
```
https://graph.facebook.com/v21.0/oauth/access_token?
  grant_type=fb_exchange_token&
  client_id=IHRE_APP_ID&
  client_secret=IHR_APP_SECRET&
  fb_exchange_token=IHR_KURZZEIT_TOKEN
```
Dieser Token hält ~60 Tage. Als `FB_PAGE_TOKEN` eintragen.

### 4f. Instagram Business-ID finden
```
https://graph.facebook.com/v21.0/me/accounts?access_token=IHR_TOKEN
```
Im Ergebnis die `id` Ihrer Seite notieren, dann:
```
https://graph.facebook.com/v21.0/SEITEN_ID?fields=instagram_business_account&access_token=IHR_TOKEN
```
Die `id` im Ergebnis ist Ihre `IG_USER_ID`.

---

## Schritt 5: Ersten Test starten

1. Gehen Sie zu: `github.com/kneipenterroristecky-cmd/Webseite_Eckversicherung/actions`
2. Links: **Wöchentlicher Blog-Beitrag**
3. Rechts: **Run workflow** → **Run workflow**
4. Nach ~2 Minuten bekommen Sie eine E-Mail von GitHub
5. Klicken Sie in der E-Mail auf den Link
6. Sie sehen den Entwurf → Klicken Sie **Approve and deploy**
7. Der Beitrag erscheint auf Webseite, Facebook und Instagram ✅

---

## Ablauf danach (automatisch)

```
Jeden Montag 08:00 Uhr
       ↓
KI schreibt Beitrag (Claude)
       ↓
Sie bekommen E-Mail von GitHub
       ↓
Sie klicken "Genehmigen" (1 Klick)
       ↓
Automatisch veröffentlicht auf:
  ✅ Webseite (blog/posts/)
  ✅ Facebook-Seite
  ✅ Instagram Business
```

---

## Themen anpassen

Die Themen stehen in `tools/topics.json`. Sie können dort jederzeit eigene
Themen hinzufügen oder ändern. Die KI rotiert automatisch durch alle Themen.

---

## Fragen?

Rufen Sie Daniel Eck an: 0174 / 322 58 85
