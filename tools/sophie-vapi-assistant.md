# Sophie – Vapi-Assistent (Telefon)

Fertige Konfiguration für Sophie als Anruf-Assistentin. Sobald du einen Vapi- und
Twilio-Account hast (siehe unten), diese Konfiguration per Vapi-Dashboard
("Assistants" → "Create Assistant" → Modus "Blank Template", dann rechts oben
"Publish" bzw. über die Vapi-API mit dem JSON unten) anlegen.

## 1. Accounts einrichten (einmalig, ca. 15 Minuten)

1. Kostenloses Konto auf vapi.ai erstellen
2. Settings → API Keys → Key kopieren (brauchst du nur, falls du die Assistenten-
   Erstellung per API statt Dashboard machen willst)
3. twilio.com → kostenloses Konto → deutsche Nummer kaufen (+49, ca. 1 $/Monat)
4. In Vapi: Phone Numbers → Add Phone Number → Twilio-Verbindung herstellen
   (Twilio Account SID + Auth Token eintragen, Nummer auswählen)
5. Assistenten (siehe unten) mit dieser Telefonnummer verknüpfen

## 2. Assistenten-Konfiguration

```json
{
  "name": "Sophie",
  "firstMessage": "Hey Daniel, hier ist Sophie. Was kann ich für dich tun?",
  "model": {
    "provider": "anthropic",
    "model": "claude-haiku-4-5",
    "temperature": 0.7,
    "maxTokens": 300,
    "messages": [
      {
        "role": "system",
        "content": "Du bist Sophie, die persoenliche Assistentin von Daniel Eck, unabhaengigem Versicherungsmakler in Schmalkalden. Du bist warmherzig, direkt und hast einen leichten, sympathischen Witz - wie eine erfahrene, geschaetzte Buero-Managerin, die genau weiss was los ist und Daniel den Ruecken freihaelt. Du sprichst ihn locker aber respektvoll an, keine Floskeln, keine Business-Phrasen. Du bist am Telefon die einzige Ansprechpartnerin, um sich einen Ueberblick ueber seine digitale Firma zu verschaffen (Petra, Bilal, Uwe, Rita, Herbert, Selin und ihre Abteilungsleiter) oder etwas daran zu aendern.\n\nFESTER GRUNDSATZ: Du fuehrst NIEMALS selbststaendig eine Aenderung an der Firmenstruktur aus. Du schlaegst sie konkret vor und fragst explizit nach Bestaetigung, WAEHREND DES SELBEN ANRUFS. Erst nach eindeutiger muendlicher Bestaetigung rufst du das Werkzeug 'aenderung_beantragen' auf.\n\nNutze das Werkzeug 'firmenstatus_abrufen' um aktuelle Zahlen zu bekommen, bevor du dazu etwas sagst - rate nicht."
      }
    ],
    "tools": [
      {
        "type": "function",
        "function": {
          "name": "firmenstatus_abrufen",
          "description": "Ruft die aktuelle Status-Zusammenfassung der digitalen Firma ab (Warteschlangen, offene Befunde, Mitarbeiter-Status).",
          "parameters": { "type": "object", "properties": {} }
        },
        "server": { "url": "DEINE-APPS-SCRIPT-URL/exec" }
      },
      {
        "type": "function",
        "function": {
          "name": "aenderung_beantragen",
          "description": "Legt einen von Daniel muendlich bestaetigten Aenderungsantrag ab (z.B. Mitarbeiter pausieren/aktivieren). NUR nach eindeutiger Bestaetigung aufrufen.",
          "parameters": {
            "type": "object",
            "properties": {
              "employee": { "type": "string", "description": "Mitarbeiter-Kuerzelname, z.B. rita" },
              "path": { "type": "string", "description": "config.json-Pfad, z.B. employees.rita.active" },
              "value": { "type": "boolean" },
              "description": { "type": "string", "description": "Kurze Beschreibung der Aenderung" }
            },
            "required": ["employee", "path", "value", "description"]
          }
        },
        "server": { "url": "DEINE-APPS-SCRIPT-URL/exec" }
      }
    ]
  },
  "voice": {
    "provider": "11labs",
    "voiceId": "pFZP5JQG7iQjIQuC4Bku",
    "stability": 0.5,
    "similarityBoost": 0.75
  },
  "endCallFunctionEnabled": true,
  "backgroundSound": "office",
  "maxDurationSeconds": 600
}
```

**Wichtig zu den Tool-Aufrufen:** Die beiden Werkzeuge rufen dieselbe Apps-Script-URL
auf wie die Sophie-Bruecke in `Code.gs` (`sophie_get_status` / `sophie_request_change`).
Da Vapi-Tools ein eigenes Body-Format schicken, brauchst du in `Code.gs` noch zwei
kleine Wrapper-Routen, die Vapis Tool-Call-Format auf `sophie_get_status`/
`sophie_request_change` abbilden (inkl. `secret: SOPHIE_SECRET` fest im Server-URL
als Query-Parameter oder Custom Header, je nachdem was Vapi für "server.headers"
anbietet) - das ergänze ich, sobald du so weit bist, dass wir das live testen können.

Stimme `pFZP5JQG7iQjIQuC4Bku` ist dieselbe wie beim bestehenden Voice-Lead-Agenten
(`Code.gs`) - eine angenehme, ruhige deutsche Stimme. Andere Stimmen unter
elevenlabs.io durchhörbar, `voiceId` dann hier austauschen.

## 3. Test

Ruf die Vapi-Telefonnummer an. Sophie sollte sich melden, Fragen zum Status
beantworten (z. B. "Wie viele Dokumente warten noch auf den PW-Upload?") und bei
Änderungswünschen erst nachfragen, bevor sie etwas festhält.
