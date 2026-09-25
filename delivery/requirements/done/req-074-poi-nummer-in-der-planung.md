---
id: req-074
title: POI-Nummer in der Planung anzeigen
app: wegfara
area: Planung
priority: normal
created: 2026-09-25
---

# Goal (Why)

Als Reiseleiter arbeite ich mit den POI-Nummern: Sie stehen auf den
Kartenmarkern und in der POI-Liste, und ich spreche in Notizen von
„Nummer 14". In der Planung fehlen sie — dort steht nur der Titel.

Beim Verplanen sehe ich also auf der Karte „14", in der Auswahlliste den
Namen und im Zeitstrahl den Namen, und muss selbst zuordnen, was
zusammengehört.

# Function (What)

Die **Nummer des POI** erscheint in der Planung an beiden Stellen:

- in der **Auswahlliste** der noch nicht verplanten POIs
- im **Zeitstrahl** an jedem Programmpunkt, der aus einem POI entstanden
  ist

Es ist dieselbe Nummer wie auf dem Kartenmarker und in der POI-Liste
(req-013) — fortlaufend innerhalb der Reise, dauerhaft vergeben.

Ein Programmpunkt **ohne** POI — von Hand angelegt, ohne Bezug zu einem
Ort — trägt keine Nummer und keinen Platzhalter an ihrer Stelle.

Die Nummer verdrängt den Titel nicht: Sie steht zusätzlich, und der Titel
bleibt lesbar.

# Acceptance Criteria

- [x] Gegeben ein POI mit der Nummer 14 liegt in der Auswahlliste, wenn
      ich sie ansehe, dann steht dort die 14.
- [x] Gegeben ich habe POI 14 in den Zeitstrahl gezogen, wenn ich den
      Programmpunkt ansehe, dann steht dort ebenfalls die 14.
- [x] Gegeben ein POI trägt die Nummer 14, wenn ich Kartenmarker,
      POI-Liste, Auswahlliste und Zeitstrahl vergleiche, dann steht
      überall dieselbe Zahl.
- [x] Gegeben ein von Hand angelegter Programmpunkt ohne POI, wenn ich
      ihn im Zeitstrahl ansehe, dann steht dort keine Nummer und kein
      Platzhalter.
- [x] Gegeben ein Programmpunkt mit langem Titel, wenn ich ihn ansehe,
      dann ist die Nummer zu sehen und der Titel weiterhin lesbar.
- [x] Gegeben ein sehr flacher Block im Zeitstrahl, wenn ich ihn ansehe,
      dann ist die Nummer nicht abgeschnitten.
- [x] Gegeben die Planung ist auf 375 px, 768 px und 1280 px zu sehen,
      wenn ich Auswahlliste und Zeitstrahl ansehe, dann ist die Nummer
      auf allen dreien lesbar (siehe [stack.md](../../stack.md)).

# Constraints

- Es ist die vorhandene Nummer aus `poi.number` (req-013) — es wird keine
  zweite Zählung eingeführt.
- Der Programmpunkt kennt seinen POI bereits über `poiId`
  ([types.ts](../../../lib/activities/types.ts)); daraus ist die Nummer zu
  beziehen.
- Die Schrift muss lesbar sein: nicht die leisesten Textstufen bei sehr
  kleiner Größe (vgl. bug-051).

# Out of Scope

- Die Nummern neu vergeben oder umsortieren.
- Die Nummer im Begleiter (`/go`) zeigen.
- Nach der Nummer suchen oder filtern.
- Die Nummer in Kosten, Dokumenten oder Bewertungen zeigen.
