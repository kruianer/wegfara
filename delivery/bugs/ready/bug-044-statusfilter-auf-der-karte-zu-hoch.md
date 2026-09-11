---
id: bug-044
app: wegfara
req: req-013
priority: normal
created: 2026-09-11
---

# Observed

Beim POI-Filter nach Status auf der Karte stehen die Zeilen weiterhin zu
weit auseinander — auch nach bug-029.

# Expected

Der senkrechte Abstand zwischen den Statuszeilen wird weiter verringert;
das Feld wird dadurch spürbar kompakter.

Wie bei bug-029: Die Trefferfläche der Kästchen darf die Zeilenhöhe nicht
bestimmen. Sie erreicht ihre 44×44 px, indem sie die Zeile überlagert
(siehe [stack.md](../../stack.md)) — die sichtbaren Zeilen rücken
zusammen.

# Steps

1. Planer öffnen, Bereich POIs
2. Auf der Karte den Statusfilter öffnen
3. Die Zeilen stehen zu weit auseinander
