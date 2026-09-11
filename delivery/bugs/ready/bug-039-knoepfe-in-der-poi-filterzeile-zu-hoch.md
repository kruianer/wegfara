---
id: bug-039
app: wegfara
req: req-060
priority: normal
created: 2026-09-11
---

# Observed

In der POI-Ansicht sind die Knöpfe in der Filterzeile zu hoch — ebenso
die beim Anlegen eines POI.

# Expected

Sie sind genauso hoch wie der Knopf „Bewertungsrunde starten", der die
richtige Höhe hat. Alle Bedienelemente dieser beiden Zeilen wirken damit
als eine Reihe.

Die Regel „Tippziele mindestens 44×44 px" aus [stack.md](../../stack.md)
gilt weiterhin — über die Trefferfläche, nicht über die sichtbare Höhe
(vgl. bug-025, bug-028, bug-029).

# Steps

1. Planer öffnen, Bereich POIs
2. Die Filterzeile und die Zeile zum Anlegen mit dem Knopf
   „Bewertungsrunde starten" vergleichen
