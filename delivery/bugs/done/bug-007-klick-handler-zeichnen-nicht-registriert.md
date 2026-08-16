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

- [x] Gegeben der Zeichenmodus ist aktiv, wenn ich mit der Maus auf
      die Karte klicke, dann erscheint ein Eckpunkt-Griff.
- [x] Gegeben der Zeichenmodus ist aktiv, wenn ich viermal auf die
      Karte klicke, dann sind vier Eckpunkt-Griffe vorhanden.
- [x] Gegeben vier gesetzte Eckpunkte, wenn ich den ersten Griff
      anklicke, dann ist eine geschlossene Fläche sichtbar.
- [x] Gegeben der Zeichenmodus ist aktiv, wenn ich auf einem
      Touchscreen auf die Karte tippe, dann erscheint ein
      Eckpunkt-Griff.
- [x] Gegeben eine geschlossene Fläche, wenn ich die Seite neu lade,
      dann ist die Fläche weiterhin sichtbar.
- [x] Gegeben der Zeichenmodus ist NICHT aktiv, wenn ich auf die Karte
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

# Befund zur Ursache

Die Messungen im Browser stimmen, die daraus abgeleitete Erklärung
trifft aber nur die halbe Wahrheit. Der Klick-Handler der Anwendung
wird sehr wohl auf der bedienten Karteninstanz registriert — beide
Effekte laufen beim Einhängen nacheinander, und der Effekt, der die
Karte erzeugt, steht vor dem, der den Klick registriert. Was
tatsächlich ausbleibt, ist die **Darstellung** des Eckpunkts: der Klick
kommt an, der Entwurfspunkt landet im Zustand, aber der Griff wird nie
gezeichnet. Von außen ist beides nicht zu unterscheiden — es entsteht
kein Eckpunkt-Griff, die Markerzahl bleibt gleich, und es gibt keinen
Konsolenfehler.

Der Grund liegt in der Weiche, die seit bug-002 vor jedem Zeichnen
steht:

```
if (map.isStyleLoaded()) { applySearchArea(); return; }
map.once("load", applySearchArea);
```

`isStyleLoaded()` meldet in MapLibre nicht „der Stil ist da", sondern
„Stil **und alle Quellen** sind fertig geladen". Sobald die Karte
Kacheln nachlädt — nach jedem Verschieben, Zoomen und auch nach dem
`fitBounds` auf die POIs — liefert es wieder `false`. Der Effekt geht
dann in den zweiten Zweig und wartet auf `load`. Dieses Ereignis feuert
in MapLibre aber **genau einmal** und ist zu diesem Zeitpunkt längst
vorbei. Das Zeichnen wartet damit auf ein Ereignis, das nie mehr kommt
— dauerhaft und für jeden weiteren Klick erneut.

Genau das konnten die bisherigen Tests nicht sehen: im Nachbau der
Bibliothek meldete `isStyleLoaded()` einmal `true` und danach für immer
`true`.

Die im Bug beschriebene Kopplung über eine Referenz ist trotzdem real
und wurde mit behoben: `mapRef` änderte sich ohne erneutes Rendern, die
abhängigen Effekte konnten eine neue oder ausgetauschte Instanz nicht
bemerken.

# Behebung

- `app/plan/components/poi-map.tsx`:
  - Der Stil-Zustand wird nicht mehr bei jedem Effektlauf über
    `isStyleLoaded()` abgefragt, sondern einmalig beim Erzeugen der
    Karte beobachtet und als Zustand `styleReady` gehalten. Die
    Bedingung aus bug-002 (Quellen und Ebenen erst nach geladenem Stil
    anlegen) bleibt damit erhalten, kippt aber nicht mehr zurück,
    sobald Kacheln nachladen.
  - Die Karteninstanz liegt im Zustand (`map`) statt in einer Referenz
    und steht in der Abhängigkeitsliste aller Effekte, die sie
    benutzen — Klick-/Tipp-Behandlung, POI-Marker und Suchgebiet. Wird
    die Instanz erzeugt oder ausgetauscht, laufen diese Effekte erneut
    und hängen sich an die Instanz, die der Nutzer bedient; die alte
    wird sauber abgemeldet.
  - Beobachtung des Stils und Aufräumen liegen jetzt im selben Effekt
    wie das Erzeugen der Karte, gehören also zu deren Lebenszyklus.
  - Größenkorrektur nach einem Frame (bug-003), Berührungsgesten
    (bug-005) und der Rest der Zeichenlogik sind unverändert.
- `tests/mocks/maplibre-gl.ts` — der Nachbau bildet jetzt die
  Eigenschaften ab, an denen der Fehler hing:
  - `simulateTileLoading()`: `isStyleLoaded()` meldet während des
    Nachladens von Kacheln wieder `false`, **ohne** dass ein weiteres
    `load` folgt.
  - `simulateStyleLoad()` feuert `load` wie das Original nur ein
    einziges Mal.
  - `remove()` räumt Listener und angehängte Elemente ab und markiert
    die Instanz als tot; sie liefert danach keine Ereignisse mehr. Neu
    ist `MapLibreMap.live()` — die Karte, die der Nutzer gerade
    bedient. Tests klicken darauf statt auf „irgendeine" Instanz, damit
    ein Handler auf einer abgeräumten Karte auffällt.
  - `once()`/`off()` arbeiten zusammen wie in maplibre-gl (auch per
    `once` registrierte Listener lassen sich abmelden).
- `app/plan/components/poi-map.test.tsx`: neue Suite „Zeichnen an der
  lebenden Karteninstanz (bug-007)" mit neun Prüfungen, die alle
  Akzeptanzkriterien abdecken — je ein Eckpunkt und vier Eckpunkte bei
  nachladenden Kacheln, das Schließen zur sichtbaren Fläche (über eine
  Elternkomponente mit Zustand, wie `PoisView`), das Tippen auf dem
  Touchscreen, der noch nicht geladene Stil zum Klickzeitpunkt, die
  weiterhin sichtbare Fläche nach erneutem Laden der Seite, kein
  Eckpunkt ohne Zeichenmodus bzw. nach dem Beenden, und der Austausch
  der Karteninstanz beim erneuten Einhängen (`StrictMode`).
- Reproduce-first nachgewiesen: gegen den unveränderten Stand von
  `poi-map.tsx` schlagen die vier Prüfungen mit nachladenden Kacheln
  fehl (kein Eckpunkt-Griff, keine geschlossene Fläche); mit dem Fix
  sind sie grün.
- Volle Suite (420 Tests), Typecheck, Lint und `npm run build`
  inklusive Standalone-Prüfung sind grün (die drei bestehenden
  Lint-Fehler in `delivery/design/planer/*` sind unverändert
  vorbestehend und nicht Teil dieser Änderung).

# Offener Punkt

Dieselbe Weiche steht unverändert in `app/go/components/map-view.tsx`
und `app/plan/components/day-route-map.tsx`. Dort betrifft sie nicht
das Zeichnen, sondern das Nachführen von Markern und Linien beim
Wechsel des Reisetages: lädt die Karte gerade Kacheln nach, bleibt die
Aktualisierung aus. Beides liegt außerhalb der Akzeptanzkriterien
dieses Bugs und wurde deshalb nicht mit geändert — lohnt aber einen
eigenen Bug.
