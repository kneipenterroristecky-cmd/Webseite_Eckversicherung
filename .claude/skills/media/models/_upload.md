# Lokale Datei zu KIE hochladen (für image_input-URLs)

Wird gebraucht, wenn ein Referenzbild lokal auf der Platte liegt (nicht
schon eine öffentliche URL ist) und ein Modell eine URL in `image_input`
bzw. `image_urls` erwartet.

- Endpoint: `POST https://kieai.redpandaai.co/api/file-stream-upload`
- Andere Host als die eigentliche API (`api.kie.ai`)! Gleicher Bearer-Key.
- multipart/form-data

```bash
curl --location 'https://kieai.redpandaai.co/api/file-stream-upload' \
  --header "Authorization: Bearer $KIE_AI_API_KEY" \
  --form 'file=@"/pfad/zum/bild.jpg"' \
  --form 'uploadPath="media-ai-refs"' \
  --form 'fileName="beschreibender-name.jpg"'
```

Antwort enthält die öffentliche URL der Datei (Feld i.d.R. `data.fileUrl` /
`data.downloadUrl` – Antwort-JSON genau prüfen, Feldname kann variieren).

**Wichtig:** Hochgeladene Dateien werden bei KIE automatisch nach 3 Tagen
gelöscht. Das Original zusätzlich lokal unter `media-ai/references/`
ablegen, damit man bei Bedarf erneut hochladen kann.

Alternativen (falls Stream-Upload nicht passt):
- `POST https://kieai.redpandaai.co/api/file-url-upload` – lädt eine bereits
  öffentliche URL herunter und legt sie bei KIE ab (selten nötig).
- `POST https://kieai.redpandaai.co/api/file-base64-upload` – für kleine
  Bilder als Base64-String, wenn kein direkter Dateizugriff möglich ist.
