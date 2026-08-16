---
id: bug-007
title: Zeichnen des Suchgebiets — Klick-Handler wird nicht registriert
app: wegfara
area: Planung
severity: high
created: 2026-08-06
relates: req-012, bug-005, bug-006
---

# Beobachtung

Im Bereich „POIs" lässt sich weiterhin kein Suchgebiet zeichnen. Der
Zeichenmodus wird aktiv, aber weder Mausklick noch Tippen setzt einen
Eckpunkt. Mehrere Anläufe (bug-005, bug-006) haben das nicht behoben.

# Analyse im Browser

Gemessen auf https://dev.wegfara.com/plan mit einem echten Browser
(Chromium, 1440 × 900). Alle Werte sind Messergebnisse, keine
Vermutungen.

**Was funktioniert:**

| Prüfung | Ergebnis |
|---|---|
| Konsolenfehler | keine |
| Kartenfläche vorhanden | ja, 712 × 833 px |
| Zeichenmodus wird aktiv | ja, Klasse `mapDrawing` gesetzt |
| Hinweistext erscheint | ja, „Zeichenmodus aktiv — Punkte auf der Karte setzen …" |
| DOM-Ereignisse am Canvas | `pointerdown`, `mousedown`, `mouseup`, `click` — keines unterdrückt |
| Klick erreicht die Kartenfläche | ja, oberstes Element ist `canvas.maplibregl-canvas` |
| **MapLibre meldet den Klick** | **ja** |

**Was nicht funktioniert:**

| Prüfung | Ergebnis |
|---|---|
| Eckpunkt-Griffe nach 1 Klick | 0 |
| Eckpunkt-Griffe nach 2 Klicks | 0 |
| Marker vor / nach Klick | 4 / 4 (unverändert) |

Der entscheidende Nachweis: Über die Karteninstanz wurde zur Laufzeit
ein zusätzlicher Klick-Handler registriert. Dieser empfängt das
Ereignis (`["map-click"]`). Der Handler der Anwendung reagiert im
selben Moment nicht.

**Damit ist ausgeschlossen:** fehlendes Kartenmodul (bug-006),
Berührungsgesten (bug-005), Container ohne Höhe (bug-001),
überlagernde Elemente, unterdrückte Ereignisse, Marker die den Klick
abfangen.

**Damit ist bewiesen:** Das Ereignis erreicht die Karte, aber
`map.on("click", handleMapClick)` der Anwendung ist zum
Klickzeitpunkt nicht registriert.

# Ursache

In `app/plan/components/poi-map.tsx` registriert ein Effekt die
Klick-Behandlung:

```
useEffect(() => {
  const map = mapRef.current;
  if (!map || drawMode !== "drawing") return;
  …
  map.on("click", handleMapClick);
  …
}, [drawMode]);
```

Der Effekt liest `mapRef.current` — eine Referenz, deren Änderung
kein erneutes Rendern auslöst. Seine einzige Abhängigkeit ist
`drawMode`.

Die Karte wird in einem separaten Effekt mit der Abhängigkeitsliste
`[]` erzeugt. Beide Effekte gehören zu unterschiedlichen
Lebenszyklen, und der Klick-Effekt hat keine Möglichkeit zu bemerken,
wenn die Karteninstanz nach seinem Durchlauf ausgetauscht wird — etwa
beim erneuten Einhängen der Komponente oder wenn ein anderer Effekt
die Karte neu erzeugt.

Die Registrierung greift dadurch auf eine Karteninstanz, die nicht
mehr diejenige ist, die der Nutzer bedient.

# Reproduktion

1. https://dev.wegfara.com/plan öffnen, Bereich „POIs"
2. „Suchgebiet zeichnen" anklicken — der Hinweistext erscheint
3. Auf die Kartenfläche klicken

Ergebnis: kein Eckpunkt, keine Änderung der Markerzahl.

# Akzeptanzkriterien der Behebung

- [ ] Gegeben der Zeichenmodus ist aktiv, wenn ich mit der Maus auf
      die Karte klicke, dann erscheint ein Eckpunkt-Griff.
- [ ] Gegeben der Zeichenmodus ist aktiv, wenn ich viermal auf die
      Karte klicke, dann sind vier Eckpunkt-Griffe vorhanden.
- [ ] Gegeben vier gesetzte Eckpunkte, wenn ich den ersten Griff
      anklicke, dann ist eine geschlossene Fläche sichtbar.
- [ ] Gegeben der Zeichenmodus ist aktiv, wenn ich auf einem
      Touchscreen auf die Karte tippe, dann erscheint ein
      Eckpunkt-Griff.
- [ ] Gegeben eine geschlossene Fläche, wenn ich die Seite neu lade,
      dann ist die Fläche weiterhin sichtbar.
- [ ] Gegeben der Zeichenmodus ist NICHT aktiv, wenn ich auf die Karte
      klicke, dann entsteht KEIN Eckpunkt.

# Constraints

- Die Behebung darf die Korrekturen aus bug-001 bis bug-006 nicht
  rückgängig machen: Container-Höhe, Laden der Ebenen erst nach dem
  Kartenstil, Größenkorrektur nach einem Frame, Berührungsgesten und
  das Einbeziehen des Kartenmoduls ins Standalone-Bündel.

# Hinweis zur Prüfung

Die bisherigen Anläufe scheiterten daran, dass die Tests die
Kartenbibliothek durch einen Nachbau ersetzen
(`tests/mocks/maplibre-gl.ts`). Dort ist die Karte sofort vorhanden,
und der Lebenszyklus-Fehler kann nicht auftreten — die Tests waren bei
jedem Anlauf grün, während die Anwendung nicht funktionierte.

Eine Prüfung, die diesen Fehler abdeckt, muss den Fall abbilden, dass
die Karteninstanz zum Zeitpunkt der Effekt-Ausführung noch nicht oder
nicht mehr dieselbe ist. Andernfalls bleibt die Lücke bestehen.
