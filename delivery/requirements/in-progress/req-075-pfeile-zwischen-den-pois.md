---
id: req-075
title: Pfeile zwischen den POIs auf der Karte
app: wegfara
area: Planung
priority: normal
created: 2026-09-25
---

# Goal (Why)

Als Reiseleiter sehe ich auf der Karte des Planers, wo meine POIs liegen —
aber nicht, in welcher Reihenfolge ich sie eingeplant habe. Ob der Tag
sinnvoll läuft oder ich zweimal quer durchs Tal fahre, erkenne ich erst,
wenn ich den Zeitstrahl daneben lese und die Nummern selbst zuordne.

Ein Blick auf die Karte soll reichen: Wo geht es hin, in welcher Folge.

# Function (What)

Auf der Karte im Planer lassen sich **Pfeile zwischen den POIs**
einschalten. Sie folgen der Reihenfolge, in der die POIs eingeplant sind:
vom früheren zum späteren Programmpunkt.

Der Pfeil zeigt die **Richtung** — er ist gerichtet, nicht nur eine Linie.

**Ein- und ausschaltbar:** Es gibt einen Schalter auf der Karte. Beim
Öffnen sind die Pfeile aus; wer sie einschaltet, behält sie, bis er sie
wieder ausschaltet.

Gezeigt werden nur POIs, die **verplant** sind. Ein POI ohne
Programmpunkt bekommt keinen Pfeil.

Sind POIs an mehreren Tagen verplant, richtet sich die Darstellung nach
dem Tag, der gerade gewählt ist.

# Acceptance Criteria

- [x] Gegeben mehrere POIs sind an einem Tag nacheinander eingeplant,
      wenn ich die Pfeile einschalte, dann verbinden sie die POIs in
      dieser Reihenfolge.
- [x] Gegeben die Pfeile sind eingeschaltet, wenn ich einen ansehe, dann
      ist erkennbar, in welche Richtung er zeigt.
- [x] Gegeben ich öffne die Planung, wenn ich die Karte ansehe, dann sind
      die Pfeile aus.
- [x] Gegeben ich habe die Pfeile eingeschaltet, wenn ich sie wieder
      ausschalte, dann sind sie verschwunden.
- [ ] Gegeben ein POI ist nicht verplant, wenn die Pfeile eingeschaltet
      sind, dann führt zu ihm kein Pfeil.
- [ ] Gegeben ich wechsle den Reisetag, wenn die Pfeile eingeschaltet
      sind, dann zeigen sie die Reihenfolge des nun gewählten Tages.
- [ ] Gegeben ich verschiebe einen Programmpunkt im Zeitstrahl, sodass
      sich die Reihenfolge ändert, wenn ich danach die Karte ansehe, dann
      folgen die Pfeile der neuen Reihenfolge.
- [ ] Gegeben die Pfeile sind eingeschaltet, wenn ich die Karte ansehe,
      dann sind die POI-Marker und ihre Nummern weiterhin lesbar.
- [ ] Gegeben ich schalte die Pfeile ein oder aus, wenn ich die Karte
      ansehe, dann sind Zoom und Mitte unverändert (bug-048).
- [ ] Gegeben die Karte ist auf 375 px, 768 px und 1280 px zu sehen, wenn
      ich den Schalter bediene, dann ist er auf allen dreien erreichbar
      (siehe [stack.md](../../stack.md)).

# Constraints

- Die Karte zeichnet heute bereits Verbindungslinien in zeitlicher
  Reihenfolge und folgt bei Transfers dem Straßenverlauf
  ([day-route-map.tsx](../../../app/plan/components/day-route-map.tsx),
  req-059). Darauf ist aufzubauen, statt eine zweite Zeichnung daneben zu
  stellen.
- Der Schalter zählt zu den Bedienelementen der Karte: Er darf die
  Statusauswahl (req-013) und das Zeichnen des Suchgebiets nicht
  verdecken.
- Die Farbe der Marker bleibt der Statusanzeige vorbehalten (req-013);
  die Pfeile führen keine zweite Farbbedeutung ein.

# Out of Scope

- Die Reihenfolge durch Ziehen auf der Karte ändern.
- Pfeile im Begleiter (`/go`) oder in der Tagesroute des Reiseleiters.
- Fahrzeiten oder Entfernungen an den Pfeilen beschriften.
- Eine Route über mehrere Tage in einem Bild.
- Die Reihenfolge automatisch optimieren.
