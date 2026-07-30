---
id: bug-003
title: Karte ist unscharf und wird erst beim Antippen scharf
app: wegfara
area: Reise
severity: normal
created: 2026-07-30
relates: req-008, bug-002
---

# Beobachtung

Im Bereich „Karte" erscheinen die Kartenkacheln beim Öffnen verwaschen.
Sobald man die Karte antippt, verschiebt oder zoomt, wird sie scharf.
Zusätzlich wirkt der anfängliche Ausschnitt zu nah herangezoomt.

# Erwartet

Die Karte ist bereits beim Öffnen des Bereichs scharf, und der
Ausschnitt zeigt alle Programmpunkte des Tages so, wie es nach dem
ersten Antippen der Fall ist.

# Ursache (Analyse)

Zwei Punkte wirken zusammen; der erste ist der wesentliche.

**1. Größenkorrektur läuft zu früh.**
In `app/go/components/map-view.tsx` wird `map.resize()` unmittelbar
nach dem Erzeugen der Karte aufgerufen. Zu diesem Zeitpunkt hat der
Container noch nicht seine endgültige Größe — das Layout ist noch nicht
durchgerechnet. Die Kartenbibliothek legt die Zeichenfläche daher mit
falschen Maßen an; der Browser skaliert das Ergebnis auf die
tatsächliche Fläche hoch, was die Unschärfe erzeugt.

Jede Interaktion löst intern ein Neuzeichnen mit den inzwischen
korrekten Maßen aus. Genau deshalb wird die Karte beim Antippen scharf.

Aus derselben Ursache folgt der zu nahe Ausschnitt: `fitBounds` rechnet
mit den falschen Maßen und wählt deshalb einen unpassenden Zoom.

**2. Kachelauflösung passt nicht zu hochauflösenden Displays.**
Die Kartenquelle nutzt `tileSize: 256` ohne höher aufgelöste Kacheln.
Auf Geräten mit doppelter Pixeldichte — jedes aktuelle Smartphone —
stehen damit grundsätzlich zu wenige Bildpunkte zur Verfügung. Das
verstärkt die Unschärfe, ist aber allein nicht die Ursache für den
Unterschied vor und nach dem Antippen.

# Reproduktion

1. https://dev.wegfara.com/go öffnen
2. „Karte" antippen — die Kacheln sind verwaschen, der Ausschnitt zu nah
3. Die Karte einmal verschieben — sie wird scharf

# Akzeptanzkriterien der Behebung

- [ ] Gegeben ich wechsle in den Bereich „Karte", wenn die Karte
      erscheint, dann sind die Kacheln ohne weitere Interaktion scharf.
- [ ] Gegeben ich wechsle in den Bereich „Karte", wenn die Karte
      erscheint, dann zeigt der Ausschnitt alle Programmpunkte des
      gewählten Tages.
- [ ] Gegeben die Karte ist geöffnet, wenn ich sie verschiebe, dann
      ändert sich die Schärfe der Kacheln NICHT.
- [ ] Gegeben ein Gerät mit doppelter Pixeldichte, wenn ich die Karte
      betrachte, dann sind Beschriftungen auf den Kacheln lesbar.

# Constraints

- Die Behebung darf die Korrekturen aus bug-001 (Container-Höhe) und
  bug-002 (Ebenen erst nach Laden des Kartenstils) nicht rückgängig
  machen.
- Kartenkacheln stammen weiterhin von OpenStreetMap (siehe req-008).
