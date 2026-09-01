# GPT Image 2 – Bild zu Bild (mit Referenz)

Modell-ID: `gpt-image-2-image-to-image`
Doku: https://docs.kie.ai/market/gpt/gpt-image-2-image-to-image

Nutzen, wenn ein echtes Referenzbild (Produktfoto, Logo, Gebäude, Screenshot)
als Vorlage/Stilbasis dienen soll, statt es nur in Worten zu beschreiben.

Lokale Dateien vorher hochladen, siehe `_upload.md`.

## Request

```
POST https://api.kie.ai/api/v1/jobs/createTask
Authorization: Bearer $KIE_AI_API_KEY
Content-Type: application/json
```

```json
{
  "model": "gpt-image-2-image-to-image",
  "input": {
    "prompt": "was am/mit dem Referenzbild geändert/erzeugt werden soll",
    "image_input": ["https://.../referenz1.jpg"],
    "aspect_ratio": "auto"
  }
}
```

`image_input`: Array von Bild-URLs (öffentlich erreichbar, z.B. nach Upload
über `_upload.md`). Genaue Obergrenze in der Live-Doku prüfen, in der Praxis
funktionieren 1–4 Referenzbilder zuverlässig.

## Preis

Gleiche Größenordnung wie `gpt-image-2-text-to-image.md` (Richtwert
$0.03–0.08 je nach Auflösung) – vor größerem Auftrag auf https://kie.ai/gpt-image-2
aktuellen Preis prüfen bzw. `creditsConsumed` der ersten Testgenerierung
nehmen.

## Ergebnis abholen

Wie bei `gpt-image-2-text-to-image.md`: `recordInfo` pollen, `resultJson`
→ `resultUrls[0]` herunterladen.
