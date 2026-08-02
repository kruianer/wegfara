---
id: req-013
title: POI-Nummern, Marker und Kartenfilter
app: wegfara
area: Planung
priority: normal
created: 2026-08-02
changes: req-010
---

# Ziel (Warum)

Als Reiseleiter will ich einen POI zwischen Liste und Karte eindeutig
wiederfinden und in der Gruppe darüber reden können, ohne lange Namen zu
buchstabieren. Und ich will die Karte auf das beschränken, was gerade
zählt — bei dreißig gesammelten Orten sehe ich sonst nichts mehr.

# Funktion (Was)

**Nummer je POI.** Jeder POI erhält beim Anlegen eine fortlaufende
Nummer innerhalb seiner Reise, beginnend bei 1. Sie bleibt dem POI
dauerhaft erhalten. Wird ein POI entfernt, wird seine Nummer nicht neu
vergeben; es entsteht eine Lücke. Die Nummer erscheint in der POI-Zeile
der Liste und im Marker auf der Karte.

**Marker.** Die POIs erscheinen auf der Karte nicht mehr als Kreis,
sondern als Markierung in Tropfenform, deren Spitze auf den Ort zeigt.
Die Fläche trägt die Farbe des Status, darin steht die Nummer des POI.

**Sichtbarkeit auf der Karte.** Beim Öffnen zeigt die Karte nur POIs mit
Status „Gesetzt" oder „Wahrscheinlich". Über eine Auswahl auf der Karte
lassen sich die übrigen Status einzeln zuschalten und wieder ausblenden.
Die getroffene Auswahl bleibt während der Sitzung erhalten.

Der Filter der Karte wirkt zusätzlich zum Typfilter der Liste aus
req-010: Ein POI erscheint auf der Karte nur, wenn er beiden entspricht.

**Einzugsgebiet entfällt.** Der Regler „Einzugsgebiet" und die
gestrichelten Gruppierungskreise werden entfernt. Ihre Aufgabe
übernimmt das Suchgebiet aus req-012.

# Änderung gegenüber heute (req-010)

Heute zeigt die Karte alle POIs als Kreismarker in Statusfarbe, dazu
gestrichelte Gruppierungskreise, deren Größe ein Regler „Einzugsgebiet"
steuert.

Das ändert sich so:
- Die Kreismarker werden durch Markierungen in Tropfenform mit Nummer
  **ersetzt**, nicht ergänzt.
- Regler und Gruppierungskreise **entfallen** ersatzlos, samt der
  zugehörigen Berechnung. Es bleibt kein abgeschalteter Rest zurück.
- Der Statusfilter der Karte kommt **neu** hinzu.
- Die Legende der Statusfarben unten links bleibt unverändert.

# GUI

- Die Markierung folgt der verbreiteten Tropfenform mit Spitze nach
  unten: runde Fläche in der Statusfarbe, darunter zulaufend, mit
  weißem Rand und weicher Schattierung. Die Nummer steht mittig in der
  Fläche, in einer Farbe, die auf allen fünf Statusfarben lesbar ist.
- Die Markierung ist so groß, dass zweistellige Nummern lesbar bleiben.
- Der Statusfilter liegt an der Stelle, an der bisher der Regler
  „Einzugsgebiet" lag, im selben Stil: je Status ein Eintrag mit
  Farbpunkt, Bezeichnung und Schalter.
- Statusfarben unverändert nach req-010.

# Akzeptanzkriterien

- [ ] Gegeben eine Reise mit zwölf POIs, wenn ich die POI-Liste
      betrachte, dann trägt jeder POI eine Nummer.
- [ ] Gegeben ein POI mit der Nummer 7, wenn ich seinen Marker auf der
      Karte betrachte, dann steht dort die Ziffer 7.
- [ ] Gegeben ein POI mit Status „Gesetzt", wenn ich seinen Marker
      betrachte, dann hat dessen Fläche die Farbe #8FD6A4.
- [ ] Gegeben eine Reise mit POIs in allen fünf Status, wenn ich den
      Bereich „POIs" öffne, dann erscheinen auf der Karte nur POIs mit
      Status „Gesetzt" oder „Wahrscheinlich".
- [ ] Gegeben derselbe Zustand, wenn ich den Status „Auf keinen Fall"
      zuschalte, dann erscheinen dessen POIs zusätzlich auf der Karte.
- [ ] Gegeben ich habe „Weiß noch nicht" zugeschaltet, wenn ich in
      einen anderen Bereich des Planers wechsle und zurückkehre, dann
      ist „Weiß noch nicht" weiterhin zugeschaltet.
- [ ] Gegeben in der Liste ist der Typfilter „Restaurant" gewählt, wenn
      ich die Karte betrachte, dann erscheinen dort nur Restaurants mit
      Status „Gesetzt" oder „Wahrscheinlich".
- [ ] Gegeben der Bereich „POIs" ist geöffnet, wenn ich die Karte
      betrachte, dann gibt es dort KEINEN Regler „Einzugsgebiet".
- [ ] Gegeben der Bereich „POIs" ist geöffnet, wenn ich die Karte
      betrachte, dann erscheinen dort KEINE gestrichelten
      Gruppierungskreise.
- [ ] Gegeben ein POI auf der Karte, wenn ich seinen Marker betrachte,
      dann ist er KEIN einfacher Kreis.

# Constraints

- Die Nummer eines POI ist innerhalb seiner Reise eindeutig und ändert
  sich nach der Vergabe nicht mehr.
- Die Form der Markierung wird nachgebaut; Grafiken fremder
  Kartendienste werden nicht verwendet.

# Nicht Teil dieses Requirements

- Suche nach POIs innerhalb des Suchgebiets
- Nummern im Begleiter oder in der Planungsansicht
- Sortierung der POI-Liste nach Nummer
- Vergabe eines eigenen Kürzels statt der Nummer
- Dauerhaftes Speichern der Filterauswahl über die Sitzung hinaus
- Anlegen oder Löschen von POIs
