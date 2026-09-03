---
id: req-020
title: Nickname je Person
app: wegfara
area: Planung
priority: normal
created: 2026-09-03
changes: req-019
---

# Ziel (Warum)

Als Reiseleiter will ich die Mitreisenden so benennen, wie ich sie
anspreche. „Clara Berger" gehört auf die Überweisung, aber in der
Ausgabenliste und neben einer Stimme reicht „Clari" — und passt besser
in die engen Stellen der Oberfläche.

# Funktion (Was)

Jede Person kann zusätzlich zum Namen einen Nicknamen tragen. Er ist
freiwillig und höchstens 20 Zeichen lang.

Ist ein Nickname gesetzt, erscheint überall dort, wo eine Person
benannt wird, dieser statt des Namens.

Eine Ausnahme gilt, wo die Bankverbindung steht: Dort erscheint immer
der volle Name, damit er zum Kontoinhaber passt. Das betrifft die
Teilnehmerverwaltung und jede spätere Darstellung von Zahlungen.

Ist kein Nickname gesetzt, erscheint überall der Name.

# Änderung gegenüber heute (req-019)

req-019 legt eine Person mit Name, E-Mail-Adresse, Telefonnummer und
Bankverbindung an. Der Nickname kommt als weiteres Feld **hinzu**; der
Name bleibt unverändert erforderlich und wird nicht ersetzt.

Ist req-019 zum Zeitpunkt der Umsetzung noch nicht abgearbeitet, wird
das Feld dort gleich mit angelegt — es entsteht kein zweites
Namensfeld daneben.

# GUI

- Das Feld erscheint in der Teilnehmerverwaltung direkt nach dem Namen,
  im selben Stil wie die übrigen Felder.
- In der Liste steht der Nickname neben dem Namen, erkennbar als
  Kurzform.

# Akzeptanzkriterien

- [ ] Gegeben die Teilnehmerverwaltung, wenn ich eine Person mit dem
      Namen „Clara Berger" und dem Nicknamen „Clari" anlege, dann
      erscheint „Clari" in der Liste.
- [ ] Gegeben dieselbe Person, wenn ich die Zeile mit ihrer
      Bankverbindung betrachte, dann steht dort „Clara Berger".
- [ ] Gegeben eine Person mit dem Namen „Max Gast" und ohne Nicknamen,
      wenn ich die Liste betrachte, dann steht dort „Max Gast".
- [ ] Gegeben die Teilnehmerverwaltung, wenn ich einen Nicknamen mit 21
      Zeichen einzugeben versuche, dann wird er NICHT gespeichert.
- [ ] Gegeben die Person „Clara Berger" mit dem Nicknamen „Clari", wenn
      ich den Nicknamen entferne und speichere, dann steht in der Liste
      „Clara Berger".
- [ ] Gegeben die Teilnehmerverwaltung, wenn ich eine Person nur mit
      einem Nicknamen und ohne Namen anzulegen versuche, dann wird sie
      NICHT angelegt.

# Constraints

- Der Nickname ersetzt den Namen nur in der Anzeige. Gespeichert
  bleiben beide.
- Wo eine Bankverbindung dargestellt wird, gilt immer der volle Name —
  eine Zahlung muss dem Kontoinhaber zuzuordnen sein.

# Nicht Teil dieses Requirements

- Eindeutigkeit des Nicknamens innerhalb des Accounts
- Automatisch vorgeschlagener Nickname aus dem Namen
- Farbe oder Bild je Person
- Anrede oder Namen in versandten E-Mails
