---
id: bug-015
app: wegfara
req: req-035
priority: normal
created: 2026-09-04
---

# Observed

Beim Bearbeiten eines POI lässt sich auf die Karte klicken — der Klick
funktioniert, aber die angeklickte Position wird nicht ins Formular
übernommen.

# Expected

Ein Klick auf die Karte setzt die Position des POI, und das Formular
zeigt die neue Position an. Nach dem Speichern liegt der POI an der
angeklickten Stelle.

# Steps

1. Planer öffnen, Bereich POIs
2. Einen bestehenden POI zum Bearbeiten öffnen
3. Auf eine Stelle in der Karte klicken
4. Position im Formular ansehen — sie ist unverändert

# Ursache

Der Kartenklick landete nur dann im Formular, wenn vorher die
Schaltfläche „Auf der Karte setzen" gedrückt worden war: erst sie
schaltete den Wartezustand ein (`picking` in `PoisView`), und nur
solange er galt, meldete die Karte ihre Klicks. Ohne diesen Schritt
verpuffte der Klick — die Karte reagierte (der Klick „funktioniert"),
aber niemand hörte zu.

Das war ein Schritt zu viel und stand quer zum Akzeptanzkriterium von
req-035 („wenn ich auf die Karte klicke, dann übernimmt das Formular
die angeklickte Position") und zum Prinzip „wenige Schritte statt viele
Optionen" aus [vision.md](../../vision.md).

# Behebung

Ein offenes POI-Formular wartet von sich aus auf den Kartenklick — das
Aufklappen einer Zeile und „POI anlegen" schalten den Wartezustand
selbst ein. Die Schaltfläche bleibt: sind mehrere Formulare offen,
gehört der Klick zunächst dem zuletzt geöffneten, und über sie wird er
einem anderen zugewiesen. Auf der Karte steht jetzt der Name des POI,
dessen Position der nächste Klick setzt.

Damit sich bei offenem Formular weiter ein Suchgebiet zeichnen lässt,
geht das Zeichnen vor: es wird ausdrücklich begonnen und beendet,
während ein Formular schon durch sein Dasein wartet. Die
Zeichnen-Schaltfläche ist deshalb nicht mehr gesperrt.

Zusätzlich hält ein Klick auf einen POI-Marker oder einen Griff des
Suchgebiets jetzt an: die Kartenbibliothek hört an derselben Fläche
mit, sonst hätte derselbe Klick zugleich als Kartenklick gegolten und
dem offenen Formular die Position unter dem Marker gesetzt.

Geändert: `app/plan/components/poi-list.tsx`,
`app/plan/components/pois-view.tsx` und
`app/plan/components/poi-map.tsx`.

# Akzeptanzkriterien der Behebung

- [x] Gegeben ein bestehender POI mit aufgeklapptem Formular, wenn ich
      auf die Karte klicke, dann zeigt das Formular die angeklickte
      Position — ohne vorher einen Modus einzuschalten.
- [x] Gegeben dasselbe Formular, wenn ich speichere, dann liegt der POI
      an der angeklickten Stelle.
- [x] Gegeben zwei offene Formulare, wenn ich auf die Karte klicke,
      dann bekommt das zuletzt geöffnete die Position und das andere
      bleibt unverändert.
- [x] Gegeben zwei offene Formulare, wenn ich beim anderen „Auf der
      Karte setzen" anklicke, dann gehört der nächste Klick ihm.
- [x] Gegeben ein offenes Formular, wenn ich es wieder zuklappe, dann
      wartet die Karte nicht mehr auf einen Klick.
- [x] Gegeben ein offenes Formular, wenn ich „Suchgebiet zeichnen"
      anklicke, dann setzt der Kartenklick einen Eckpunkt und nicht die
      Position.
- [x] Gegeben ein offenes Formular, wenn ich einen POI-Marker anklicke,
      dann gilt das nicht zugleich als Klick auf die Karte.
