---
id: bug-032
app: wegfara
req: req-014
priority: high
created: 2026-09-10
---

# Observed

Die POI-Suche per KI liefert immer einen Fehler.

# Expected

Die Suche läuft und legt POIs an. Schlägt sie fehl, nennt die Meldung den
Grund — nicht nur „Fehler".

# Befund

Auf dev nachgemessen (2026-09-10). **Der Modellname kommt leer bei OpenAI
an.**

`deploy/docker-compose.yml` setzt `OPENAI_MODEL: ${OPENAI_MODEL}`. Steht
die Variable nicht in `~/wegfara-env/dev.env`, setzt Compose sie auf den
**leeren String** — nicht auf „nicht gesetzt". Im Container gemessen:

    OPENAI_MODEL=[]
    node: "" -> (leer, kein Fallback)

`lib/ai/openai-client.ts` liest sie mit
`process.env.OPENAI_MODEL ?? DEFAULT_MODEL`. Der `??`-Operator greift nur
bei `undefined` und `null` — ein leerer String kommt durch. Die Anwendung
schickt damit `model: ""`, und OpenAI antwortet:

    400 — "you must provide a model parameter"

Der Zugangsschlüssel selbst ist in Ordnung (hinterlegt, entschlüsselt
sauber, endet auf `TAcA`).

**Zu tun:**

1. Einen leeren Wert wie einen fehlenden behandeln — nicht nur hier,
   sondern überall, wo eine Umgebungsvariable mit `??` gelesen wird und
   über Compose durchgereicht wird. `AUTH_SECRET`, `IMAGE_DIR`,
   `OSRM_BASE_URL` und `BOOTSTRAP_EMAIL` sind auf dasselbe Muster zu
   prüfen.
2. Den Fehlschlag benennen: Eine Antwort von OpenAI mit `400` sagt genau,
   was fehlt — das gehört ins Log und, sinngemäß, in die Meldung an den
   Nutzer. Ein bloßes „Fehler" schickt ihn auf die Suche nach seinem
   Zugangsschlüssel, obwohl der in Ordnung ist (vgl. bug-021, bug-026).

# Steps

1. Planer öffnen, Bereich POIs
2. Ein Suchgebiet zeichnen
3. Die KI-Suche auslösen — es erscheint ein Fehler
