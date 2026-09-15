# Google Nano Banana Pro (Gemini 3 Pro Image)

Modell-ID: `nano-banana-pro`
Doku: https://docs.kie.ai/market/google/pro-image-to-image

Hohe Auflösung (bis 4K), funktioniert sowohl rein aus Text als auch mit
Referenzbild(ern) – je nachdem, ob `image_input` mitgegeben wird.

## Request

```
POST https://api.kie.ai/api/v1/jobs/createTask
Authorization: Bearer $KIE_AI_API_KEY
Content-Type: application/json
```

```json
{
  "model": "nano-banana-pro",
  "input": {
    "prompt": "detaillierter Prompt, max. 10000 Zeichen",
    "image_input": ["https://.../referenz1.jpg"],
    "aspect_ratio": "1:1",
    "resolution": "1K",
    "output_format": "png"
  }
}
```

- `image_input`: optional, Array von bis zu 8 Bild-URLs. Weglassen für
  reine Text-zu-Bild-Erzeugung.
- `aspect_ratio`: `1:1|2:3|3:2|3:4|4:3|4:5|5:4|9:16|16:9|21:9|auto`
  (Default `1:1`)
- `resolution`: `1K|2K|4K` (Default `1K`) – höhere Auflösung kostet mehr.
- `output_format`: `png|jpg` (Default `png`)

Lokale Referenzbilder vorher hochladen, siehe `_upload.md`.

## Preis

Nicht in der Live-Doku beziffert – vor größerem Auftrag auf
https://kie.ai/nano-banana-pro aktuellen Preis prüfen bzw. anhand der ersten
Testgenerierung `data.creditsConsumed` aus `recordInfo` ablesen und mit dem
Nutzer das Budget abgleichen, bevor weitere Varianten erzeugt werden.

## Ergebnis abholen

`GET https://api.kie.ai/api/v1/jobs/recordInfo?taskId=<id>` pollen bis
`data.state == "success"`, `data.resultJson` parsen, `resultUrls[0]`
herunterladen.
