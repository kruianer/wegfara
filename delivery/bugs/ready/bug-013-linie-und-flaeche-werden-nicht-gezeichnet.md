---
id: bug-013
title: Linie und Fläche des Suchgebiets werden nicht gezeichnet
app: wegfara
area: Planung
severity: normal
created: 2026-08-21
relates: req-012, bug-011
---

# Beobachtung

Beim Zeichnen des Suchgebiets erscheinen die gesetzten Punkte, aber
zwischen ihnen wird keine Linie gezeichnet und ab drei Punkten keine
getönte Fläche. Ebenso lassen sich die Punkte während des Zeichnens
nicht verschieben.

Der Versatz aus bug-011 ist behoben — die Punkte sitzen exakt unter
dem Klick.

# Analyse im Browser

Gemessen an https://dev.wegfara.com/plan mit angemeldeter Sitzung
(Chromium mit Software-Rendering, 1440 × 900). Alle Werte sind
Messergebnisse.

**Was nachweislich stimmt:**

| Prüfung | Ergebnis |
|---|---|
| Konsolenfehler | keine |
| Kartenkacheln | 15 Anfragen, alle HTTP 200, Karte zeichnet |
| Ebenen vorhanden | `search-area-draft-line`, `search-area-draft-fill` |
| Ebene → Quelle verknüpft | korrekt |
| Reihenfolge | beide über der Kachel-Ebene `osm` |
| Sichtbarkeit / Farbe | `visibility` default, `line-color #d9c589`, `line-width 3` |
| CSS-Variable `--acc` am Container | `#d9c589` |
| Daten in der Quelle nach 2 Punkten | LineString mit zwei korrekten Koordinaten in Wien |
| Daten in der Füllquelle nach 3 Punkten | ein Polygon-Feature |

**Der entscheidende Widerspruch:**

```
map.getSource('search-area-draft')._data
  → { geojson: { type: "FeatureCollection", features: [ … LineString … ] } }

map.querySourceFeatures('search-area-draft')     → 0
map.queryRenderedFeatures({layers:['search-area-draft-line']}) → 0
```

Die Daten liegen in der Quelle, aber die Kartenbibliothek hat sie nie
verarbeitet. Ein erzwungenes `triggerRepaint()` ändert daran nichts.

**Damit ist ausgeschlossen:** fehlende Ebene, falsche Reihenfolge,
falsche Farbe, fehlende Daten, fehlerhafte Geometrie, nicht geladene
Kacheln, fehlendes Neuzeichnen.

# Vermutete Ursache

`setSourceData` ruft `setData()` auf einer Quelle auf, die zu diesem
Zeitpunkt nicht (mehr) die aktive Instanz der Karte ist — dieselbe
Klasse von Fehler wie in bug-007, dort für den Klick-Handler.

Auffällig: `_data` trägt die Struktur `{ geojson: … }` statt direkt der
FeatureCollection. Das deutet darauf hin, dass `setData` die Daten
entgegennimmt, die Quelle sie aber nicht in Kacheln umsetzt.

Zu prüfen wäre, ob `ensureSearchAreaLayers` und `setSourceData` in
derselben Kartenausführung laufen, und ob die Quelle nach einem
Stilwechsel neu angelegt werden muss.

# Ebenfalls offen: Punkte verschieben

Die Entwurfspunkte wurden mit `draggable: index > 0` und einem
`dragend`-Zuhörer versehen (Commit fbd88a4), lassen sich aber nicht
ziehen. Möglicherweise dieselbe Ursache — der Marker gehört zu einer
anderen Karteninstanz als der, die der Nutzer bedient.

# Akzeptanzkriterien der Behebung

- [ ] Gegeben der Zeichenmodus ist aktiv, wenn ich zwei Punkte setze,
      dann ist zwischen ihnen eine Linie sichtbar.
- [ ] Gegeben drei gesetzte Punkte, wenn ich die Karte betrachte, dann
      ist die entstehende Fläche eingefärbt.
- [ ] Gegeben zwei gesetzte Punkte, wenn ich
      `querySourceFeatures('search-area-draft')` abfrage, dann liefert
      es mindestens ein Feature.
- [ ] Gegeben drei gesetzte Punkte, wenn ich einen davon (nicht den
      ersten) mit der Maus ziehe, dann folgt der Punkt.
- [ ] Gegeben ein verschobener Punkt, wenn ich die Karte betrachte,
      dann folgt die Linie der neuen Lage.
- [ ] Gegeben eine geschlossene Fläche, wenn ich die Seite neu lade,
      dann ist sie weiterhin sichtbar.

# Constraints

- Die Behebung darf die Korrekturen aus bug-001 bis bug-012 nicht
  rückgängig machen — insbesondere nicht `position: relative` am
  Marker wieder einführen (bug-011).

# Hinweis zur Prüfung

Der Test-Nachbau (`tests/mocks/maplibre-gl.ts`) speichert die Daten
schlicht in einem Feld und liefert sie zurück — er bildet nicht ab, ob
die Kartenbibliothek sie tatsächlich verarbeitet. Deshalb waren die
Tests bei diesem Fehler grün. Eine Prüfung muss den Unterschied
zwischen „Daten gesetzt" und „Daten verarbeitet" abbilden können.
