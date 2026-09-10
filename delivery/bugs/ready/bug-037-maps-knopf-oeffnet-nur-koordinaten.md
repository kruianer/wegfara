---
id: bug-037
app: wegfara
req: req-026
priority: normal
created: 2026-09-10
---

# Observed

Der Knopf „Maps" führt immer auf die GPS-Position. Stammt der POI aus
Google Places, sollte er den Ort selbst öffnen — dann kann ich dort die
Bewertungen lesen und weitere Fotos ansehen.

# Expected

- POI **mit** Google-Kennung: Der Knopf öffnet diesen Ort bei Google Maps
  — mit Namen, Bewertungen und allen Fotos.
- POI **ohne** Google-Kennung: Der Knopf öffnet wie bisher die
  Koordinaten.

# Befund

`app/plan/components/poi-list.tsx` baut den Link fest aus der Position:

    maps: `https://www.google.com/maps/search/?api=1&query=${poi.position.lat},${poi.position.lng}`

Die Kennung des Ortes bei Google liegt am POI bereits vor
(`googlePlaceId`, seit req-026) und wird hier nicht genutzt. Google Maps
nimmt sie im Suchlink entgegen, sodass der Ort selbst geöffnet wird statt
einer Suche nach Koordinaten.

Übergeben wird dabei weiterhin nur ein Link — es gehen keine Nutzerdaten
an Google (siehe [vision.md](../../vision.md)).

# Steps

1. Planer öffnen, Bereich POIs
2. Einen POI ansehen, der aus einem Google-Maps-Link angelegt wurde
3. „Maps" wählen — es öffnet eine Koordinatensuche statt des Ortes
