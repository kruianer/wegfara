---
id: bug-048
app: wegfara
req: req-013
priority: normal
created: 2026-09-19
---

# Observed

Im Planer, Bereich POIs: Setze ich bei einem POI den Status, ändert sich
der Kartenausschnitt — die Karte zoomt und verschiebt sich. Gleich
welcher Status gesetzt wird.

# Expected

Der Kartenausschnitt bleibt beim Setzen eines Status unverändert: gleicher
Zoom, gleiche Mitte. Wer gerade eine Ecke des Gebiets betrachtet, will
dort bleiben, während er POIs durchgeht.

# Steps

1. Planer öffnen, Bereich POIs
2. In die Karte hineinzoomen
3. Bei einem POI einen Status setzen
4. Der Kartenausschnitt springt

# Ursache

Die Karte rückt in [poi-map.tsx](../../../app/plan/components/poi-map.tsx)
(Zeile 370) über `fitTo` auf alle POIs. Dagegen steht ein Merker
`framedRef`, der ein erneutes Rücken verhindern soll — er hält aber einen
Schlüssel aus den **Positionen der gerade angezeigten POIs**:

```
const orte = pois.map(({ position }) => `${position.lat},${position.lng}`).join("|");
if (framedRef.current === `pois:${orte}`) return;
```

Ändert sich der Status eines POI, ändert sich die gefilterte Liste, damit
der Schlüssel — und die Karte rückt neu. Der Merker unterscheidet nicht
zwischen „andere Reise, anderes Gebiet" (rücken ist richtig) und „derselbe
Bestand, nur anders gefiltert oder anders gefärbt" (rücken ist falsch).

Das Rücken gehört an den Wechsel der Reise bzw. des Gebiets gebunden, nicht
an die jeweils sichtbare Liste.

# Notes

Ein bereits von Hand gewählter Ausschnitt darf auch dann nicht verworfen
werden, wenn ein POI hinzukommt oder entfernt wird.
