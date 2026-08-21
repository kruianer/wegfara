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

# Tatsächliche Ursache

Zwei voneinander unabhängige Ursachen. Die Vermutung oben trifft nicht
zu — `{ geojson: … }` ist die normale interne Form der Quelle, und
Quelle und Ebenen gehören sehr wohl zur bedienten Karteninstanz.

## 1. Der Worker der Kartenbibliothek startet nie (Linie und Fläche)

Die Kartenbibliothek schneidet GeoJSON-Daten **nicht im Hauptthread**,
sondern in einem Web Worker in Kacheln. `setData()` legt die Daten nur
ab und schickt sie an den Worker; erst dessen Antwort macht daraus etwas
Sichtbares. Kachel-Ebenen brauchen ihn nicht — deshalb zeichnete die
Karte normal, während jede GeoJSON-Ebene leer blieb.

Die Adresse des Workers ermittelt die Bibliothek zur Laufzeit aus
`import.meta.url` ihres eigenen Moduls. Der Bundler von Next legt das
Modul unter einem Namen mit Inhalts-Hash ab und faltet den daraus
abgeleiteten Ausdruck falsch zusammen. Im gebauten Stand vor der
Behebung stand dort:

```
r = (i = importMetaUrl, /^https?:/.test(i)
      ? (i.endsWith("-dev.mjs"), new URL(asset(16839)).href)
      : "")
```

Die Bedingung wird ausgewertet und weggeworfen; `asset(16839)` ist
`/_next/static/media/maplibre-gl-dev.<hash>.mjs` — die Bibliothek
selbst, nicht ihr Worker. Der Worker bekam also entweder die falsche
Datei oder gar keine Adresse. Er antwortete nie, und weil niemand auf
eine Antwort wartet, die ausbleibt, gab es auch keinen Fehler: „Daten
gesetzt" ohne „Daten verarbeitet", lautlos.

Dass `config.WORKER_URL` im alten Bundle vollständig wegoptimiert war
(kein `WORKER_URL ||` vor dem Ausdruck), bestätigt es: es gab keinen Weg,
den Worker zu erreichen.

Betroffen war nicht nur das Suchgebiet, sondern jede GeoJSON-Ebene —
auch die Verbindungslinien zwischen Programmpunkten im Begleiter.

## 2. Ein Zustandswechsel während des Ziehens bricht die Geste ab (Punkte)

Beim Ziehen eines Eckpunktes wurde der React-Zustand aktualisiert.
Dadurch lief der Effekt erneut, baute **alle** Marker ab und neu auf —
und die Kartenbibliothek meldet beim Entfernen eines Markers alle
Zuhörer der Karte ab. Die laufende Geste hatte danach niemanden mehr,
der zuhört: der Punkt blieb nach dem ersten Pixel stehen.

Beim Entwurfspunkt kam hinzu, dass gar kein `drag`-Zuhörer registriert
war — die Linie hätte der Bewegung selbst dann nicht folgen können.

# Behebung

1. **Feste Worker-Adresse.** `scripts/copy-map-worker.mjs` legt
   `maplibre-gl-worker.mjs` und die von ihm nachgeladene
   `maplibre-gl-shared.mjs` unter `public/maplibre/` ab (npm-Skripte
   `prebuild`/`predev`, damit auch im Container). `lib/map/worker-url.ts`
   meldet die Adresse vor der ersten Karte an die Bibliothek; beide
   Kartenansichten rufen es auf. `scripts/verify-standalone-bundle.mjs`
   scheitert nach dem Build, wenn die Dateien fehlen.
2. **Ziehen ohne Zustandswechsel.** Während des Ziehens wird nur noch
   die Karte neu gezeichnet (`paintDraft` / `paintArea`), nicht der
   Zustand geändert; übernommen wird erst beim Loslassen. Die Marker
   bleiben damit über die ganze Geste bestehen. Entwurfspunkte haben
   jetzt zusätzlich einen `drag`-Zuhörer, sodass die Linie mitläuft.
3. **Nebenbefund behoben:** die getönte Entwurfsfläche wurde beim
   Schließen des Suchgebiets nie gelöscht und blieb liegen.
4. Der Worker-Pfad ist von der middleware ausgenommen — sonst trüge die
   Auslieferung `no-store` und der Browser lüde bei jedem Kartenaufruf
   ein halbes Megabyte neu.

Der Nachbau in `tests/mocks/maplibre-gl.ts` unterscheidet jetzt zwischen
„gesetzt" (`getSource(id).data`) und „verarbeitet"
(`querySourceFeatures(id)`) und bildet ab, dass ein entfernter Marker
nicht mehr gezogen werden kann. Ohne die Behebung schlagen die neuen
Tests fehl — ebenso der bestehende Test zum Ziehen einer Ecke, der den
Fehler bis dahin nicht sehen konnte.

# Akzeptanzkriterien der Behebung

- [x] Gegeben der Zeichenmodus ist aktiv, wenn ich zwei Punkte setze,
      dann ist zwischen ihnen eine Linie sichtbar.
- [x] Gegeben drei gesetzte Punkte, wenn ich die Karte betrachte, dann
      ist die entstehende Fläche eingefärbt.
- [x] Gegeben zwei gesetzte Punkte, wenn ich
      `querySourceFeatures('search-area-draft')` abfrage, dann liefert
      es mindestens ein Feature.
- [x] Gegeben drei gesetzte Punkte, wenn ich einen davon (nicht den
      ersten) mit der Maus ziehe, dann folgt der Punkt.
- [x] Gegeben ein verschobener Punkt, wenn ich die Karte betrachte,
      dann folgt die Linie der neuen Lage.
- [x] Gegeben eine geschlossene Fläche, wenn ich die Seite neu lade,
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
