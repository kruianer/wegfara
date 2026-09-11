---
id: bug-043
app: wegfara
req: req-013
priority: normal
created: 2026-09-11
---

# Observed

Auf der Karte steht eine Legende mit den Statusfarben — dieselben Farben
stehen schon beim POI-Filter nach Status direkt daneben.

# Expected

Die Legende entfällt. Der Statusfilter zeigt die Farben ohnehin zu jedem
Status; eine zweite Auflistung derselben Zuordnung kostet nur Platz.

# Steps

1. Planer öffnen, Bereich POIs
2. Auf der Karte die Legende und den Statusfilter vergleichen — beide
   zeigen dieselben Farben
