---
id: req-004
title: Zeitgleiche Programmpunkte als Optionen
app: wegfara
area: Reise
priority: normal
created: 2026-07-28
---

# Ziel (Warum)

Als Reisender will ich für einen Zeitraum mehrere Möglichkeiten
nebeneinander sehen und eine davon wählen. Nicht jeder Programmpunkt
steht fest — oft gibt es für den Nachmittag drei Ideen, und wir
entscheiden erst unterwegs, welche es wird.

# Funktion (Was)

Haben mehrere Programmpunkte desselben Reisetages exakt denselben
Beginn und dasselbe Ende, gelten sie als Alternativen zueinander und
erscheinen nicht untereinander, sondern als eine Gruppe an einer
Stelle des Zeitstrahls.

Über der Gruppe steht, wie viele Möglichkeiten es gibt und für welchen
Zeitraum sie gelten, dazu der Hinweis, dass durch Wischen gewählt wird.

Die Alternativen liegen waagrecht nebeneinander und lassen sich
durchwischen; die jeweils eingerastete gilt als gewählt und ist als
solche gekennzeichnet. Unter der Gruppe zeigt ein Punkte-Indikator, wie
viele Möglichkeiten es gibt und die wievielte gerade sichtbar ist.

Die getroffene Wahl wird gespeichert und gilt für alle Teilnehmer der
Reise. Wurde noch nie gewählt, gilt die erste Alternative als gewählt.

Die Gruppe erhält am Zeitstrahl eine gemeinsame Nummer; sie zählt als
ein Programmpunkt des Tages.

Zur Erprobung enthält die Reise „Süditalien Rundreise" an einem
Reisetag eine Gruppe aus drei Alternativen.

# GUI

- Vorlage: `delivery/design/design 1.0/Reise Companion.dc.html`,
  Abschnitt „Zeitgleiche POIs = Optionen" — Kopfzeile, waagrechtes
  Karussell mit einrastenden Karten (86 % Breite), grüner Rahmen und
  Kennzeichnung „✓ Gewählt" an der eingerasteten Karte,
  Punkte-Indikator darunter.
- Verbindlichkeit: eng folgen.
- Der nummerierte Kreis der Gruppe erscheint in der Akzentfarbe
  `--acc`, nicht in `--navBg` wie bei einzelnen Programmpunkten.
- Die Karten selbst sehen aus wie in req-003 festgelegt (farbige Fläche
  statt Foto, Typ-Chip, Zeit-Pille, Titel, Kurztext).

# Akzeptanzkriterien

- [ ] Gegeben ein Reisetag mit drei Programmpunkten von jeweils 13:30
      bis 15:00, wenn ich den Zeitstrahl betrachte, dann erscheinen sie
      als eine Gruppe an einer Stelle.
- [ ] Gegeben dieselbe Gruppe, wenn ich ihre Kopfzeile betrachte, dann
      steht dort „3 OPTIONEN · 13:30 – 15:00".
- [ ] Gegeben dieselbe Gruppe und es wurde noch nie gewählt, wenn ich
      sie betrachte, dann ist die erste Alternative als gewählt
      gekennzeichnet.
- [ ] Gegeben dieselbe Gruppe, wenn ich auf die zweite Alternative
      wische, dann ist die zweite als gewählt gekennzeichnet.
- [ ] Gegeben ich habe die zweite Alternative gewählt, wenn ich den
      Reisetag verlasse und erneut öffne, dann ist die zweite weiterhin
      als gewählt gekennzeichnet.
- [ ] Gegeben eine Gruppe aus drei Alternativen, wenn ich den
      Punkte-Indikator betrachte, dann sehe ich drei Punkte.
- [ ] Gegeben ein Reisetag mit einem Programmpunkt von 18:00 bis 18:30
      und einem weiteren von 18:00 bis 20:00, wenn ich den Zeitstrahl
      betrachte, dann erscheinen sie NICHT als Gruppe.
- [ ] Gegeben eine Gruppe aus drei Alternativen, wenn ich den
      Zeitstrahl betrachte, dann trägt die Gruppe genau eine Nummer.
- [ ] Gegeben ein Programmpunkt am 20.07.2026 von 13:30 bis 15:00 und
      ein weiterer am 21.07.2026 von 13:30 bis 15:00, wenn ich den
      20.07.2026 betrachte, dann erscheint dort KEINE Gruppe.

# Constraints

- Alternativen entstehen allein daraus, dass Programmpunkte am selben
  Reisetag liegen und in Beginn- und Endzeit übereinstimmen. Alle drei
  Bedingungen müssen zutreffen. Ein Programmpunkt wird nicht gesondert
  als Alternative gekennzeichnet.

# Nicht Teil dieses Requirements

- Hinzufügen oder Entfernen von Alternativen durch den Nutzer
- Abstimmung in der Gruppe über die zu wählende Alternative
- Auswirkung der Wahl auf die Kartenansicht
- Vorschläge der KI, welche Alternative die passende ist
- Transfers zu und von einer Alternative
