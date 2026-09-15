# Google Nano Banana Edit

Modell-ID: `google/nano-banana-edit`
Doku: https://docs.kie.ai/market/google/nano-banana-edit

Für gezielte Bearbeitung/Kombination bestehender Bilder (z.B. Produkt aus
Foto A vor Hintergrund aus Foto B, Logo einfügen, Stil angleichen) – bis zu
10 Referenzbilder gleichzeitig.

## Request

```
POST https://api.kie.ai/api/v1/jobs/createTask
Authorization: Bearer $KIE_AI_API_KEY
Content-Type: application/json
```

```json
{
  "model": "google/nano-banana-edit",
  "input": {
    "prompt": "was am/mit den Referenzbildern geändert werden soll, max. 5000 Zeichen",
    "image_urls": ["https://.../bild1.jpg", "https://.../bild2.jpg"],
    "output_format": "png",
    "aspect_ratio": "1:1"
  }
}
```

**Achtung Feldname:** Dieses Modell nutzt `image_urls` (nicht
`image_input` wie die anderen Modelle hier) – vor dem Request noch mal
gegenlesen, das ist eine häufige Fehlerquelle.

- `image_urls`: Pflichtfeld, 1–10 Bild-URLs.
- `output_format`: `png|jpeg` (Default `png`)
- `aspect_ratio`: `1:1|9:16|16:9|3:4|4:3|3:2|2:3|5:4|4:5|21:9|auto`
  (Default `1:1`)

Lokale Referenzbilder vorher hochladen, siehe `_upload.md`.

## Preis

Nicht in der Live-Doku beziffert – vor größerem Auftrag auf
https://kie.ai (Modellseite "Nano Banana Edit") aktuellen Preis prüfen bzw.
`data.creditsConsumed` aus der ersten Testgenerierung ablesen.

## Ergebnis abholen

`GET https://api.kie.ai/api/v1/jobs/recordInfo?taskId=<id>` pollen bis
`data.state == "success"`, `data.resultJson` parsen, `resultUrls[0]`
herunterladen.
