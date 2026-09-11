---
id: bug-036
app: wegfara
req: req-013
priority: high
created: 2026-09-10
---

# Observed

Die POIs werden auf der Karte nicht immer an der richtigen Position
angezeigt — besonders wenn die Karte verschoben oder gezoomt wird.

# Expected

Ein POI-Marker bleibt an seinem Ort: beim Verschieben, beim Zoomen und
nach dem Loslassen. Die Spitze des Markers zeigt genau auf die Position
des POI.

# Verdacht

Typisch für dieses Bild ist ein Marker, dessen Ankerpunkt nicht gesetzt
ist: Er wird mit seiner Mitte statt mit seiner Spitze auf die Koordinate
gelegt, und der Versatz fällt beim Zoomen unterschiedlich stark auf. Zu
prüfen ist der Anker der Marker in `app/plan/components/poi-map.tsx`
(bei MapLibre der `anchor` des Markers) — und ob die Marker beim
Verschieben tatsächlich mit der Karte wandern oder nachgezogen werden.

# Steps

1. Planer öffnen, Bereich POIs
2. Auf der Karte hineinzoomen und die Karte verschieben
3. Die Marker sitzen nicht mehr genau auf ihren Orten
