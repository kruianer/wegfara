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

- [ ] Gegeben der Begleiter ist geöffnet, wenn ich „Karte" antippe,
      dann sind Kartenkacheln sichtbar.
- [ ] Gegeben der Bereich „Karte" ist geöffnet und der gewählte
      Reisetag hat vier Programmpunkte, wenn ich die Karte betrachte,
      dann sehe ich vier nummerierte Marker.
- [ ] Gegeben ich war im Bereich „Plan", wenn ich auf „Karte" wechsle,
      dann füllt die Karte die Fläche zwischen Tagesauswahl und
      Navigationsleiste vollständig aus.
- [ ] Gegeben der Bereich „Karte" ist geöffnet, wenn ich das Fenster in
      der Größe verändere, dann passt sich die Karte der neuen Größe an.
- [ ] Ein Test deckt ab, dass der Kartenbereich eine von Null
      verschiedene Höhe hat.
