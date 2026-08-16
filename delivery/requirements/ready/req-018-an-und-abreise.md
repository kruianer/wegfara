---
id: req-018
title: An- und Abreise als Transfer
app: wegfara
area: Reise
priority: normal
created: 2026-08-06
changes: req-006
---

# Ziel (Warum)

Als Reisender will ich sehen, wie ich zur Reise hin- und wieder
zurückkomme. Heute beginnt der Plan mit dem ersten Programmpunkt am
Zielort — der Flug oder die Zugfahrt davor fehlt, obwohl er den ersten
Reisetag bestimmt.

# Funktion (Was)

An- und Abreise werden als Transfer abgebildet, wie die Wege zwischen
den Programmpunkten. Dafür kommen drei Verkehrsmittel hinzu: Flug,
Bahn und Fähre. Bisher gab es zu Fuß, Auto, Bus und Boot.

Der Ausgangspunkt der Anreise ist ein gewöhnlicher Programmpunkt — etwa
der eigene Wohnort oder der Abflughafen. Er wird wie jeder andere
angelegt und trägt den Typ „Stadt & Dorf". Die Anreise ist damit ein
Transfer von diesem Punkt zum ersten Programmpunkt am Zielort; die
Abreise entsprechend der Transfer vom letzten Programmpunkt zum
Rückreiseziel.

Die Anreise gehört zum ersten Reisetag, die Abreise zum letzten. Beide
erscheinen im Zeitstrahl an ihrer Uhrzeit, wie alle anderen Transfers.

Auf der Karte erscheinen sie als Linie zwischen ihren Endpunkten,
gestrichelt wie Bus und Boot. Der Kartenausschnitt richtet sich
weiterhin nach den Programmpunkten des Tages — führt eine Anreiselinie
darüber hinaus, ragt sie aus dem sichtbaren Bereich heraus.

# Änderung gegenüber heute (req-006)

Heute kennt ein Transfer vier Verkehrsmittel: zu Fuß, Auto, Bus, Boot.
Diese Liste wird um Flug, Bahn und Fähre **erweitert**; die
vorhandenen bleiben unverändert. Es entsteht keine zweite Art von
Transfer neben der bestehenden.

Die Regel aus req-006, dass ein Transfer zwei Programmpunkte desselben
Reisetages verbindet, bleibt bestehen — An- und Abreise sind keine
Ausnahme davon.

# GUI

- Die drei neuen Verkehrsmittel erhalten je ein eigenes Symbol im Stil
  der vorhandenen: Flugzeug, Zug, Fähre.
- Darstellung im Zeitstrahl und auf der Karte unverändert nach req-006
  und req-008.

# Akzeptanzkriterien

- [ ] Gegeben ein Programmpunkt „Wien" am ersten Reisetag und ein
      Transfer per Flug von dort zum ersten Programmpunkt in Neapel,
      wenn ich den Zeitstrahl dieses Tages betrachte, dann erscheint
      der Transfer zwischen beiden.
- [ ] Gegeben derselbe Transfer, wenn ich ihn betrachte, dann zeigt
      sein Symbol ein Flugzeug.
- [ ] Gegeben ein Transfer per Bahn, wenn ich ihn betrachte, dann zeigt
      sein Symbol einen Zug.
- [ ] Gegeben ein Transfer per Fähre, wenn ich ihn betrachte, dann
      zeigt sein Symbol eine Fähre.
- [ ] Gegeben ein Transfer per Flug am ersten Reisetag, wenn ich die
      Karte dieses Tages betrachte, dann verbindet eine gestrichelte
      Linie seine Endpunkte.
- [ ] Gegeben derselbe Reisetag mit drei Programmpunkten in Neapel und
      einem Ausgangspunkt in Wien, wenn ich die Karte öffne, dann sind
      die drei Programmpunkte in Neapel im sichtbaren Ausschnitt.
- [ ] Gegeben ein Transfer per Auto, wenn ich ihn betrachte, dann ist
      seine Darstellung gegenüber heute unverändert.
- [ ] Gegeben ein Programmpunkt vom Typ „Stadt & Dorf" als
      Ausgangspunkt, wenn ich ihn im Zeitstrahl betrachte, dann
      unterscheidet er sich NICHT von anderen Programmpunkten
      desselben Typs.

# Constraints

- An- und Abreise sind keine eigene Art von Element. Sie sind
  Transfers mit einem der neuen Verkehrsmittel; das Datenmodell
  bekommt dafür keine zusätzliche Tabelle.

# Nicht Teil dieses Requirements

- Buchungsnummer, Sitzplatz, Gepäckangaben
- Verknüpfung mit Reiseunterlagen oder Tickets
- Automatisches Ermitteln von Flug- oder Zugverbindungen
- Benachrichtigung bei Verspätung der An- oder Abreise
- Ein am Konto hinterlegter Heimatort
- Kilometer- und Zeitangaben aus einer Fahrplanauskunft
