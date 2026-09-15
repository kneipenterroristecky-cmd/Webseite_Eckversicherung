# GPT Image 2 – Text zu Bild

Modell-ID: `gpt-image-2-text-to-image`
Doku: https://docs.kie.ai/market/gpt/gpt-image-2-text-to-image

Kein Referenzbild nötig – reiner Textprompt. Für Bilder mit Referenz siehe
`gpt-image-2-image-to-image.md`.

## Request

```
POST https://api.kie.ai/api/v1/jobs/createTask
Authorization: Bearer $KIE_AI_API_KEY
Content-Type: application/json
```

```json
{
  "model": "gpt-image-2-text-to-image",
  "input": {
    "prompt": "detaillierter Prompt, max. 10000 Zeichen",
    "aspect_ratio": "auto"
  }
}
```

`aspect_ratio`: z.B. `1:1`, `2:3`, `3:2`, `3:4`, `4:3`, `4:5`, `5:4`,
`9:16`, `16:9`, `21:9`, `auto` (Default `auto`, orientiert sich am Prompt).

## Preis (Richtwert, vor jeder größeren Bestellung auf https://kie.ai/gpt-image-2
prüfen, da sich Preise ändern können)

- ca. $0.03 pro Bild bei Standardauflösung
- ca. $0.05 bei 2K, ca. $0.08 bei 4K (falls Auflösungsparameter verfügbar ist
  – in der Doku-Version dieses Skills nicht bestätigt, im Zweifel den
  tatsächlichen `creditsConsumed`-Wert aus der ersten Testgenerierung nehmen)

## Ergebnis abholen

`GET https://api.kie.ai/api/v1/jobs/recordInfo?taskId=<id>` pollen bis
`data.state == "success"`, dann `data.resultJson` als JSON parsen und die
URL(s) aus `resultUrls[0]` herunterladen.
