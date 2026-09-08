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

# Behoben (2026-09-08)

Der stille Fehlschlag lag in `lib/pois/save-status.ts`: Der Fehler wurde
ausdruecklich verschluckt, weil die Oberflaeche den Status schon
optimistisch uebernommen hatte. Genau dadurch sah alles aus wie nach
einem erfolgreichen Speichern.

`savePoiStatus` meldet jetzt, ob gespeichert wurde. Schlaegt es fehl,
nimmt die POI-Ansicht den Status zurueck und zeigt eine Meldung. Drei
Tests in `app/plan/components/pois-view.test.tsx` halten das fest; ohne
den Fix sind sie rot.

Die uebrigen Schreibwege wurden geprueft: sie geben einen Fehlschlag
bereits nach aussen (`null` bzw. ein Ergebnis mit `ok: false`).
