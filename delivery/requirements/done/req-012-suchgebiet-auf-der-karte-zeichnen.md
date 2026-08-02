---
id: req-012
title: Suchgebiet auf der Karte zeichnen
app: wegfara
area: Planung
priority: normal
created: 2026-08-02
---

# Ziel (Warum)

Als Reiseleiter will ich auf der Karte eine Fläche abstecken, die den
Bereich meiner Reise umreißt — entlang einer Küste, um eine Region,
nicht als Kreis. Diese Fläche soll später eingrenzen, wo die App nach
Orten sucht; zunächst hält sie fest, worüber wir überhaupt reden.

# Funktion (Was)

Auf der Karte im Bereich „POIs" gibt es eine Schaltfläche zum Zeichnen
eines Suchgebiets.

Im Zeichenmodus setzt jeder Klick auf die Karte einen Eckpunkt. Die
entstehende Linie folgt sichtbar den gesetzten Punkten. Ein Klick auf
den ersten Punkt schließt die Fläche; das ist ab drei gesetzten Punkten
möglich. Die Anzahl der Eckpunkte ist nicht begrenzt.

Die Taste Escape bricht das Zeichnen ab, ohne dass eine Fläche
entsteht.

Eine geschlossene Fläche wird gespeichert und bleibt der Reise
erhalten; nach erneutem Aufruf der Seite ist sie wieder sichtbar.

Eine fertige Fläche lässt sich nachträglich ändern:
- Eckpunkte lassen sich mit der Maus verschieben; die Fläche folgt.
- Zwischen zwei benachbarten Eckpunkten lässt sich ein weiterer
  einfügen, der danach wie jeder andere verschiebbar ist.
- Ein einzelner Eckpunkt lässt sich entfernen, solange mindestens drei
  übrig bleiben.

Eine Schaltfläche entfernt das Suchgebiet wieder.

Je Reise gibt es höchstens ein Suchgebiet. Wird ein neues gezeichnet,
ersetzt es das vorhandene.

Das Suchgebiet ist unabhängig vom Regler „Einzugsgebiet" aus req-010;
beide können gleichzeitig sichtbar sein.

# GUI

- Die Fläche wird in der Akzentfarbe des Planer-Themas dargestellt:
  Umrandung durchgezogen, Füllung schwach durchscheinend, damit Karte
  und Marker darunter lesbar bleiben.
- Eckpunkte erscheinen als kleine Griffe auf der Umrandung. Zwischen je
  zwei benachbarten Eckpunkten zeigt ein kleinerer, schwächerer Griff
  auf der Mitte der Kante, wo sich ein weiterer Punkt einfügen lässt.
- Die Schaltflächen zum Zeichnen und Entfernen liegen auf der Karte im
  selben Stil wie das vorhandene Bedienfeld „Einzugsgebiet" aus
  req-010.
- Im Zeichenmodus ist erkennbar, dass er aktiv ist.

# Akzeptanzkriterien

- [x] Gegeben der Bereich „POIs" ist geöffnet, wenn ich die
      Schaltfläche zum Zeichnen anklicke, dann ist erkennbar, dass der
      Zeichenmodus aktiv ist.
- [x] Gegeben der Zeichenmodus ist aktiv, wenn ich vier Punkte auf der
      Karte setze und den ersten erneut anklicke, dann erscheint eine
      geschlossene Fläche über diesen vier Punkten.
- [x] Gegeben der Zeichenmodus ist aktiv und ich habe zwei Punkte
      gesetzt, wenn ich den ersten Punkt anklicke, dann entsteht KEINE
      Fläche.
- [x] Gegeben der Zeichenmodus ist aktiv und ich habe drei Punkte
      gesetzt, wenn ich Escape drücke, dann ist keine Fläche vorhanden.
- [x] Gegeben eine gezeichnete Fläche, wenn ich die Seite neu lade,
      dann ist die Fläche weiterhin sichtbar.
- [x] Gegeben eine gezeichnete Fläche, wenn ich einen ihrer Eckpunkte
      an eine andere Stelle ziehe, dann folgt die Fläche dieser
      Änderung.
- [x] Gegeben eine verschobene Ecke, wenn ich die Seite neu lade, dann
      zeigt die Fläche die verschobene Ecke.
- [x] Gegeben eine Fläche mit vier Ecken, wenn ich zwischen zwei
      benachbarten Ecken einen weiteren Punkt einfüge, dann hat die
      Fläche fünf Ecken.
- [x] Gegeben eine Fläche mit fünf Ecken, wenn ich eine Ecke entferne,
      dann hat die Fläche vier Ecken.
- [x] Gegeben eine Fläche mit genau drei Ecken, wenn ich eine Ecke zu
      entfernen versuche, dann hat die Fläche weiterhin drei Ecken.
- [x] Gegeben eine gezeichnete Fläche, wenn ich die Schaltfläche zum
      Entfernen anklicke, dann ist keine Fläche mehr sichtbar.
- [x] Gegeben eine gezeichnete Fläche mit vier Ecken, wenn ich eine
      neue Fläche mit fünf Ecken zeichne, dann ist nur die neue Fläche
      sichtbar.
- [x] Gegeben eine gezeichnete Fläche, wenn ich die POI-Liste
      betrachte, dann ist sie durch die Fläche NICHT eingeschränkt.
- [x] Gegeben eine gezeichnete Fläche, wenn ich den Regler
      „Einzugsgebiet" verändere, dann bleibt die Fläche unverändert.

# Constraints

- Ein Suchgebiet gehört zu genau einer Reise.

# Nicht Teil dieses Requirements

- Suche nach Orten innerhalb der Fläche
- Übernahme gefundener Orte als POI
- Einschränkung der POI-Liste oder der Karte auf die Fläche
- Mehrere Suchgebiete je Reise
- Benennung eines Suchgebiets
- Suchgebiete im Begleiter
