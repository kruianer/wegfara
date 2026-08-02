---
id: req-011
title: Planungsansicht im Planer
app: wegfara
area: Planung
priority: high
created: 2026-08-02
---

# Ziel (Warum)

Als Reiseleiter will ich den Ablauf eines Reisetages als Zeitstrahl vor
mir haben und daneben sehen, was noch keinen Platz gefunden hat. Erst
in dieser Gegenüberstellung erkenne ich, ob ein Tag zu voll ist und was
noch fehlt.

# Funktion (Was)

Der Bereich „Planung" des Planers zeigt drei Spalten nebeneinander.

**Links „Noch unverplant":** die POIs der Reise mit Status „Gesetzt"
oder „Wahrscheinlich", die noch mit keinem Programmpunkt verknüpft
sind. Je POI erscheinen Statuspunkt, Name, Ort und eine geschätzte
Dauer, die sich aus dem Typ ergibt.

**Mitte „Zeitstrahl":** oben Reiter für die Reisetage, darunter eine
Titelzeile mit den Schaltflächen „KI planen lassen" und „Transfers".
Darunter ein senkrechtes Stundenraster, in dem die Programmpunkte des
gewählten Tages als Blöcke liegen — Höhe und Lage entsprechen ihrer
Zeit. Zwischen ihnen erscheinen die hinterlegten Transfers als
gestrichelte Blöcke mit Bezeichnung, Distanz und Dauer.

Das Raster reicht von der vollen Stunde vor dem frühesten Beginn bis
zur vollen Stunde nach dem spätesten Ende des Tages, mindestens jedoch
von 08:00 bis 22:00. Ein Reisetag ohne Programmpunkte zeigt das Raster
von 08:00 bis 22:00 ohne Blöcke. Reicht das Raster über die verfügbare
Höhe hinaus, scrollt die Spalte; Tagesreiter und Titelzeile bleiben
dabei stehen.

**Rechts „Karte":** die Programmpunkte des gewählten Tages als
nummerierte Wegpunkte in ihrer zeitlichen Reihenfolge, verbunden durch
eine gepunktete Linie. Ein Feld auf der Karte nennt den Tagestitel
sowie die Gesamtdistanz und Gesamtfahrzeit der Transfers dieses Tages.

Diese Ansicht zeigt Daten an; verändert wird in diesem Requirement
nichts.

# GUI

- Vorlage: `delivery/design/planer/README (1).md`, Abschnitt
  „2. Planung", sowie `delivery/design/planer/Reiseplaner v4.dc.html`.
- Verbindlichkeit: eng folgen. Spaltenbreiten 294 px für „Noch
  unverplant" und 412 px für den Zeitstrahl; das Stundenraster mit
  48 px je Stunde.
- Sichtbar, aber ohne Funktion: die Schaltflächen „KI planen lassen"
  und „Transfers".
- Abweichung zur Vorlage: Transfer-Blöcke tragen keine
  „KI"-Kennzeichnung, da die vorhandenen Transfers nicht von einer KI
  erzeugt wurden.
- Geschätzte Dauer je Typ nach Vorlage: Sehenswürdigkeit 2,5 h, Stadt &
  Dorf 3 h, Restaurant 2 h, Strand 3 h, Aktivität 2 h; für die beiden
  weiteren Typen Hotel 1 h und Weltkulturerbe 2,5 h.

# Akzeptanzkriterien

- [ ] Gegeben die geöffnete Reise „Süditalien Rundreise", wenn ich den
      Bereich „Planung" öffne, dann sehe ich drei Spalten nebeneinander.
- [ ] Gegeben ein Reisetag mit vier Programmpunkten, wenn ich den
      Zeitstrahl betrachte, dann sehe ich vier Blöcke.
- [ ] Gegeben ein Programmpunkt von 10:00 bis 12:30, wenn ich seinen
      Block betrachte, dann erstreckt er sich über zweieinhalb Stunden
      des Rasters.
- [ ] Gegeben ein Reisetag, dessen spätester Programmpunkt um 00:30
      endet, wenn ich den Zeitstrahl betrachte, dann reicht das Raster
      bis 01:00.
- [ ] Gegeben ein Reisetag ohne Programmpunkte, wenn ich ihn wähle,
      dann reicht das Raster von 08:00 bis 22:00.
- [ ] Gegeben zwei Programmpunkte mit einem Transfer dazwischen, wenn
      ich den Zeitstrahl betrachte, dann liegt zwischen ihnen ein
      gestrichelter Block.
- [ ] Gegeben die Reise hat einen POI mit Status „Gesetzt", der mit
      keinem Programmpunkt verknüpft ist, wenn ich die linke Spalte
      betrachte, dann erscheint er dort.
- [ ] Gegeben ein POI ist mit einem Programmpunkt verknüpft, wenn ich
      die linke Spalte betrachte, dann erscheint er dort NICHT.
- [ ] Gegeben ein Reisetag mit vier Programmpunkten, wenn ich die
      rechte Karte betrachte, dann sehe ich vier nummerierte
      Wegpunkte.
- [ ] Gegeben der Bereich „Planung" ist geöffnet, wenn ich einen
      anderen Tagesreiter wähle, dann zeigt der Zeitstrahl die
      Programmpunkte dieses Tages.
- [ ] Gegeben der Bereich „Planung" ist geöffnet, wenn ich auf „KI
      planen lassen" klicke, dann passiert NICHTS.
- [ ] Gegeben ein Block im Zeitstrahl, wenn ich ihn mit der Maus zu
      ziehen versuche, dann verändert er seine Lage NICHT.

# Constraints

- Der Zeitstrahl zeigt dieselben Programmpunkte wie der Begleiter. Es
  gibt keine zweite, getrennte Ablage für Tagespläne.
- Ein POI gilt als verplant, sobald ein Programmpunkt auf ihn verweist.
  Diese Verknüpfung wird mit diesem Requirement angelegt und im
  Bestand gefüllt.

# Nicht Teil dieses Requirements

- Verschieben von Blöcken im Zeitstrahl und Ziehen aus der linken
  Spalte
- Anlegen, Ändern oder Entfernen von Programmpunkten und Transfers
- Automatische Tagesplanung durch die KI und Berechnung von Transfers
- Hinweisfelder der KI, etwa zu langen Etappen
- Der schwebende KI-Assistent
- Änderung des Status eines POI aus dieser Ansicht heraus
