---
id: bug-001
title: Karte lädt nicht — Kartenbereich bleibt leer
app: wegfara
area: Reise
severity: high
created: 2026-07-30
relates: req-008
---

# Beobachtung

Im Begleiter auf https://dev.wegfara.com/go zeigt der Bereich „Karte"
keine Karte. Es erscheinen weder Kacheln noch Marker — die Fläche
bleibt leer.

# Erwartet

Der Bereich „Karte" zeigt die Kartenkacheln und die nummerierten Marker
der Programmpunkte des gewählten Reisetages (siehe req-008).

# Ursache (Analyse)

Der Kartenbereich hat keine Höhe, daher rendert die Kartenbibliothek in
eine Fläche von 0 Pixeln.

- `app/go/go-view.module.css`: `.app` verwendet `min-height: 100dvh`,
  `.content` hat `flex: 1` und `position: relative`, aber keine eigene
  Höhe.
- `app/go/components/map-view.module.css`: `.wrap` und `.map` sind
  `position: absolute; inset: 0` — sie tragen selbst nichts zur Höhe
  bei.

In einem Flex-Container mit `min-height` streckt `flex: 1` nur bis zur
Höhe des Inhalts. Die Plan-Ansicht füllt den Bereich mit
Programmpunkten und funktioniert deshalb; die absolut positionierte
Karte lässt ihn auf 0 zusammenfallen.

Die Design-Vorlage weist ausdrücklich darauf hin: „Karte initialisiert
lazy beim ersten Öffnen (Container muss Layout haben!)" und verlangt
zusätzlich eine Größenkorrektur beim Aktivieren des Bereichs. Im Code
gibt es keinen Aufruf, der die Karte nach dem Sichtbarwerden auf die
neue Containergröße anpasst.

# Reproduktion

1. https://dev.wegfara.com/go öffnen
2. In der unteren Navigationsleiste „Karte" antippen

Ergebnis: leere Fläche, keine Kacheln, keine Marker.

# Akzeptanzkriterien der Behebung

- [x] Gegeben der Begleiter ist geöffnet, wenn ich „Karte" antippe,
      dann sind Kartenkacheln sichtbar.
- [x] Gegeben der Bereich „Karte" ist geöffnet und der gewählte
      Reisetag hat vier Programmpunkte, wenn ich die Karte betrachte,
      dann sehe ich vier nummerierte Marker.
- [x] Gegeben ich war im Bereich „Plan", wenn ich auf „Karte" wechsle,
      dann füllt die Karte die Fläche zwischen Tagesauswahl und
      Navigationsleiste vollständig aus.
- [x] Gegeben der Bereich „Karte" ist geöffnet, wenn ich das Fenster in
      der Größe verändere, dann passt sich die Karte der neuen Größe an.
- [x] Ein Test deckt ab, dass der Kartenbereich eine von Null
      verschiedene Höhe hat.

# Behebung

- `app/go/go-view.module.css`: `.app` bekommt eine definite `height:
  100dvh` statt nur `min-height` — erst dadurch hat der Flex-Container
  eine feste Größe, aus der `flex: 1` echten Platz zuteilen kann.
  `.content` bekommt zusätzlich `min-height: 0` (damit es auf die
  verfügbare Höhe schrumpfen darf, statt von ihrem — bei leerer Karte
  fehlenden — Inhalt bestimmt zu werden) und `overflow-y: auto` (damit
  ein langer Plan weiterhin innerhalb des Bereichs scrollt).
- `app/go/components/map-view.tsx`: ruft `map.resize()` direkt nach dem
  Erzeugen der Karte auf (Größenkorrektur beim Aktivieren, siehe
  Design-Vorlage) und zusätzlich bei jedem `window`-Resize-Event,
  solange die Karte gemountet ist — MapLibre liest die
  Canvas-Größe nur einmalig beim Erzeugen und verfolgt
  Container-Änderungen sonst nicht selbst.
- Tests: `app/go/go-view.layout.test.ts` (neu) prüft direkt am CSS,
  dass `.app`/`.content` eine definite, nicht bloß inhaltsabhängige Höhe
  ergeben — jsdom führt kein echtes Layout aus, ein DOM-Höhentest wäre
  in beiden Fällen 0. `app/go/components/map-view.test.tsx` deckt die
  Größenkorrektur beim Aktivieren und bei Fensteränderung ab.
