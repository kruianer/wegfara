---
id: bug-021
app: wegfara
priority: high
created: 2026-09-05
---

# Observed

Ein POI wurde nicht gespeichert, ohne dass eine Fehlermeldung erschien.
Der Fehlschlag blieb unbemerkt — er fiel erst auf, als der POI später
nicht mehr da war.

# Expected

Schlägt ein Speichern fehl, sagt die App es unmittelbar: eine sichtbare
Meldung, dass nicht gespeichert werden konnte. Ein stiller Fehlschlag,
nach dem die Oberfläche so aussieht wie nach einem erfolgreichen
Speichern, darf es nicht geben.

Das gilt nicht nur für POIs, sondern für jeden schreibenden Vorgang:
Reise, Programmpunkt, Ausgabe, Person, Einladung.

# Steps

1. Planer öffnen, Bereich POIs
2. Einen POI anlegen und speichern
3. Es erscheint keine Fehlermeldung — der POI ist trotzdem nicht
   gespeichert (siehe bug-020)
