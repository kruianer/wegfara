---
id: bug-041
app: wegfara
req: req-011
priority: normal
created: 2026-09-11
---

# Observed

Im Zeitstrahl heben sich die senkrechten Scrollbalken vom Rest ab.

# Expected

Sie tragen die Hintergrundfarbe der Spalte, in der sie liegen, und fügen
sich damit ein — statt als helle oder dunkle Leiste aufzufallen.

Das gilt in beiden Farbwelten (hell und dunkel, req-007): Der Balken
nimmt die Farbe seiner Umgebung an, nicht einen festen Wert.

# Steps

1. Planer öffnen, Bereich Planung
2. Einen Reisetag wählen, dessen Zeitstrahl über die Höhe hinausreicht
3. Der senkrechte Scrollbalken hebt sich ab
