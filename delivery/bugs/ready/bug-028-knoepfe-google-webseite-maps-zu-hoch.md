---
id: bug-028
app: wegfara
req: req-049
priority: normal
created: 2026-09-10
---

# Observed

Die Schaltflächen für Google, Webseite und Maps sind zu hoch — sie passen
nicht zu den übrigen Bedienelementen.

# Expected

Sie sehen wieder normal aus, in gewohnter Höhe.

Die Regel „Tippziele mindestens 44×44 px" aus [stack.md](../../stack.md)
gilt weiterhin. Sie lässt sich erfüllen, ohne das sichtbare Element
aufzublähen: Die Trefferfläche darf größer sein als das, was man sieht —
etwa über einen unsichtbaren Rand um das Element. Dieselbe Lösung wie bei
bug-025.

# Steps

1. Planer öffnen, Bereich POIs
2. Einen POI mit Webadresse und Google-Ort ansehen
3. Die Schaltflächen Google, Webseite und Maps sind zu hoch
