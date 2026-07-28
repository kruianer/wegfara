---
id: req-006
title: Transfers im Zeitstrahl
app: wegfara
area: Reise
priority: normal
created: 2026-07-28
---

# Ziel (Warum)

Als Reisender will ich sehen, wie ich von einem Programmpunkt zum
nächsten komme und wie lange das dauert. Ohne die Wege dazwischen ist
ein Tagesplan unvollständig — die halbe Stunde Fahrt entscheidet
darüber, ob sich der nächste Punkt überhaupt ausgeht.

# Funktion (Was)

Zwischen zwei aufeinanderfolgenden Programmpunkten eines Reisetages
kann ein Transfer stehen. Er verbindet die beiden und erscheint im
Zeitstrahl zwischen ihnen — zurückhaltender gestaltet als ein
Programmpunkt, weil er den Weg zeigt und nicht das Ziel.

Ein Transfer zeigt: das Verkehrsmittel als Symbol, einen Titel, die
Dauer und die Distanz. Am Zeitstrahl steht dafür ein kleiner
Hohlkreis; Transfers werden nicht nummeriert und zählen nicht in die
Nummerierung der Programmpunkte hinein.

Es gibt vier Verkehrsmittel: zu Fuß, Auto, Bus, Boot.

Rechts am Transfer steht eine Schaltfläche „Route", die die Navigation
zum Zielort in einer Kartenanwendung außerhalb von wegfara öffnet.
Dabei wird das Verkehrsmittel des Transfers übernommen. Hat der
Zielpunkt keine hinterlegte Position, erscheint keine Schaltfläche
„Route".

Dauer und Distanz sind am Transfer hinterlegt und werden nicht
berechnet.

Zur Erprobung enthalten die Reisen Transfers aller vier
Verkehrsmittel.

# GUI

- Vorlage: `delivery/design/design 1.0/Reise Companion.dc.html`,
  Abschnitt „Transfer-Zeile" — Radius 14 px, Hintergrund `--sur2`,
  gestrichelte 1-px-Umrandung, Symbol nach Verkehrsmittel, Titel
  12,5 px, Zusatzzeile 11 px mit Dauer und Distanz, rechts die
  „Route"-Pille in `--acc`/`--accSoft`.
- Am Zeitstrahl: Hohlkreis 10 px, senkrecht mittig zur Zeile, mit
  Raillinie darüber und darunter.
- Verbindlichkeit: eng folgen.

# Akzeptanzkriterien

- [ ] Gegeben ein Reisetag mit zwei Programmpunkten und einem Transfer
      dazwischen, wenn ich den Zeitstrahl betrachte, dann steht der
      Transfer zwischen den beiden Programmpunkten.
- [ ] Gegeben ein Transfer mit dem Verkehrsmittel Auto, einer Dauer von
      12 Minuten und einer Distanz von 4,2 km, wenn ich ihn betrachte,
      dann steht dort „12 Min · 4,2 km".
- [ ] Gegeben ein Transfer mit dem Verkehrsmittel Boot, wenn ich ihn
      betrachte, dann zeigt sein Symbol ein Boot.
- [ ] Gegeben ein Reisetag mit zwei Programmpunkten und einem Transfer
      dazwischen, wenn ich den zweiten Programmpunkt betrachte, dann
      trägt sein Kreis die Ziffer 2.
- [ ] Gegeben ein Transfer, wenn ich ihn am Zeitstrahl betrachte, dann
      trägt sein Kreis KEINE Ziffer.
- [ ] Gegeben ein Transfer, dessen Zielpunkt eine Position hat, wenn ich
      „Route" anklicke, dann öffnet sich die Navigation dorthin in einem
      neuen Fenster.
- [ ] Gegeben ein Transfer, dessen Zielpunkt keine Position hat, wenn
      ich ihn betrachte, dann erscheint dort KEINE Schaltfläche
      „Route".
- [ ] Gegeben zwei aufeinanderfolgende Programmpunkte ohne Transfer
      dazwischen, wenn ich den Zeitstrahl betrachte, dann steht
      zwischen ihnen KEINE Transfer-Zeile.

# Constraints

- Ein Transfer gehört immer zu zwei Programmpunkten desselben
  Reisetages; er steht nie für sich allein.
- Die Navigation findet außerhalb von wegfara statt. wegfara übergibt
  dabei keine Nutzerdaten an den Kartendienst (siehe
  [vision.md](../../vision.md)).

# Nicht Teil dieses Requirements

- Berechnung von Dauer und Distanz aus Koordinaten
- Berücksichtigung der aktuellen Verkehrslage
- Warnung, wenn die Zeit zwischen zwei Programmpunkten für den Transfer
  nicht reicht
- Darstellung der Transfers auf der Kartenansicht
- Anlegen, Ändern oder Löschen von Transfers durch den Nutzer
- Weitere Verkehrsmittel über die vier genannten hinaus
