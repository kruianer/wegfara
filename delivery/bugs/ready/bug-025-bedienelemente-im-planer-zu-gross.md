---
id: bug-025
app: wegfara
req: req-049
priority: normal
created: 2026-09-10
---

# Observed

Seit der Umstellung auf die Mindestgröße für Tippziele sind Bedienelemente
im Planer unnatürlich groß geworden:

- In der POI-Ansicht sind die Checkboxen unnatürlich groß und passen gar
  nicht ins Bild.
- In der Legende der Karte ebenso.
- Die Filter-Chips im POI-Bereich sind zu hoch.

# Expected

Die Elemente sehen wieder normal aus — Checkboxen in gewohnter Größe,
Filter-Chips in gewohnter Höhe.

Die Regel „Tippziele mindestens 44×44 px" aus [stack.md](../../stack.md)
gilt weiterhin. Sie lässt sich erfüllen, ohne das sichtbare Element
aufzublähen: Die Trefferfläche darf größer sein als das, was man sieht —
etwa über einen unsichtbaren Rand um das Element oder eine vergrößerte
Fläche des zugehörigen Labels.

# Steps

1. Planer öffnen, Bereich POIs
2. Checkboxen in der Liste und die Filter-Chips darüber ansehen
3. Die Legende der Karte daneben ansehen
