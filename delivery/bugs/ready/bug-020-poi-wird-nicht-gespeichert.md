---
id: bug-020
app: wegfara
req: req-035
priority: high
created: 2026-09-05
---

# Observed

Speichern speichert offenbar nichts: Nach dem Anlegen eines POI und
einem Wechsel des Tabs ist der POI beim Zurückkommen weg.

# Expected

Ein gespeicherter POI bleibt gespeichert — nach einem Tab-Wechsel, einem
Neuladen der Seite und einem Neustart des Browsers steht er weiterhin in
der POI-Liste.

# Steps

1. Planer öffnen, Bereich POIs
2. Einen POI von Hand anlegen und speichern
3. In einen anderen Tab wechseln und zurückkommen
4. Der POI ist nicht mehr da
