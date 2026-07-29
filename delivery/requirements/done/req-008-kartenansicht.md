---
id: req-008
title: Kartenansicht des Reisetages
app: wegfara
area: Reise
priority: normal
created: 2026-07-29
---

# Ziel (Warum)

Als Reisender will ich sehen, wo die Programmpunkte eines Tages liegen
und in welcher Reihenfolge wir sie ansteuern. Eine Liste sagt mir
wann — erst die Karte sagt mir, ob der Nachmittag räumlich überhaupt
zusammenpasst.

# Funktion (Was)

Der zweite Bereich der unteren Navigationsleiste zeigt eine Karte über
die volle Fläche. Darüber schwebt dieselbe Tagesauswahl wie im
Plan-Bereich.

Die Programmpunkte des gewählten Reisetages erscheinen als nummerierte
Kreise an ihrer jeweiligen Position; die Nummern entsprechen der
Reihenfolge im Zeitstrahl. Ein Antippen öffnet eine kleine Sprechblase
mit Nummer, Titel und Zeitspanne des Programmpunkts.

Wo zwischen zwei Programmpunkten ein Transfer hinterlegt ist, verbindet
sie eine Linie. Ihre Darstellung richtet sich nach dem Verkehrsmittel:
für das Auto durchgezogen, für zu Fuß, Bus und Boot gestrichelt. Wo
kein Transfer hinterlegt ist, wird auch keine Linie gezeichnet.

Beim Öffnen der Karte und bei jedem Tageswechsel wird der Ausschnitt so
gewählt, dass alle Programmpunkte des Tages sichtbar sind.

Bilden mehrere Programmpunkte eine Optionsgruppe, erscheint nur die
gewählte Alternative auf der Karte.

Hat der gewählte Reisetag keine Programmpunkte, zeigt die Karte die
Umgebung des Hauptorts der Reise ohne Marker.

# GUI

- Vorlage: `delivery/design/design 1.0/Reise Companion.dc.html`,
  Abschnitt „2. Karte".
- Verbindlichkeit: eng folgen.
- Marker: Kreis 28 px in der Farbe `--nav-bg`, 2 px weißer Ring,
  Schatten, weiße Ziffer. Marker einer Optionsgruppe in der
  Akzentfarbe `--acc`.
- Linien: 3 px, Farbe `--nav-bg`, 75 % Deckkraft; gestrichelte Linien
  im Muster 5 zu 7.
- Abweichung zur Vorlage: Als Kartenkacheln dienen die von
  OpenStreetMap, nicht Carto. Es gibt daher nur eine helle
  Kachelvariante; bei dunklen Farbwelten bleibt die Karte hell.

# Akzeptanzkriterien

- [x] Gegeben die geöffnete Reise „Süditalien Rundreise" und ein
      Reisetag mit vier Programmpunkten, wenn ich den Bereich „Karte"
      öffne, dann sehe ich vier nummerierte Marker.
- [x] Gegeben derselbe Tag, wenn ich den Marker des zeitlich ersten
      Programmpunkts betrachte, dann trägt er die Ziffer 1.
- [x] Gegeben derselbe Tag, wenn ich einen Marker antippe, dann
      erscheint eine Sprechblase mit dem Titel des Programmpunkts.
- [x] Gegeben zwei Programmpunkte mit einem Transfer per Auto
      dazwischen, wenn ich die Karte betrachte, dann verbindet sie eine
      durchgezogene Linie.
- [x] Gegeben zwei Programmpunkte mit einem Transfer zu Fuß dazwischen,
      wenn ich die Karte betrachte, dann verbindet sie eine
      gestrichelte Linie.
- [x] Gegeben ein Reisetag mit Programmpunkten, wenn ich den Bereich
      „Karte" öffne, dann sind alle Marker dieses Tages im sichtbaren
      Ausschnitt.
- [x] Gegeben der Bereich „Karte" ist geöffnet, wenn ich in der
      Tagesauswahl einen anderen Reisetag wähle, dann zeigt die Karte
      die Marker dieses Tages.
- [x] Gegeben ein Reisetag mit einer Optionsgruppe aus drei
      Alternativen, wenn ich die Karte betrachte, dann erscheint für
      diese Gruppe genau ein Marker.
- [x] Gegeben ein Reisetag ohne Programmpunkte, wenn ich den Bereich
      „Karte" öffne, dann erscheint dort KEIN Marker.
- [x] Gegeben zwei aufeinanderfolgende Programmpunkte ohne hinterlegten
      Transfer, wenn ich die Karte betrachte, dann verbindet sie KEINE
      Linie.

# Constraints

- Kartenkacheln stammen von OpenStreetMap. Deren Nutzungsbedingungen
  verlangen eine sichtbare Herkunftsangabe auf der Karte; sie ist
  anzuzeigen.
- Die Karte lädt Kacheln von einem fremden Server. Dabei werden keine
  Nutzerdaten übergeben, die über die angeforderte Kachel hinausgehen.

# Nicht Teil dieses Requirements

- Anzeige der eigenen Position per GPS
- Soll-Ist-Abgleich zwischen geplantem und tatsächlichem Standort
- Die Leiste am unteren Rand mit Live-Status und Wetter
- Umschaltung der Kartenkacheln zwischen hell und dunkel
- Navigation zu einem Programmpunkt von der Karte aus
- Verschieben oder Anlegen von Programmpunkten auf der Karte
- Darstellung mehrerer Reisetage gleichzeitig
