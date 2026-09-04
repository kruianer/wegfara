---
id: bug-015
app: wegfara
req: req-035
priority: normal
created: 2026-09-04
---

# Observed

Beim Bearbeiten eines POI lässt sich auf die Karte klicken — der Klick
funktioniert, aber die angeklickte Position wird nicht ins Formular
übernommen.

# Expected

Ein Klick auf die Karte setzt die Position des POI, und das Formular
zeigt die neue Position an. Nach dem Speichern liegt der POI an der
angeklickten Stelle.

# Steps

1. Planer öffnen, Bereich POIs
2. Einen bestehenden POI zum Bearbeiten öffnen
3. Auf eine Stelle in der Karte klicken
4. Position im Formular ansehen — sie ist unverändert
