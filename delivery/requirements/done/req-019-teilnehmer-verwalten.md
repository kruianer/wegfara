---
id: req-019
title: Teilnehmer verwalten
app: wegfara
area: Planung
priority: normal
created: 2026-09-03
---

# Ziel (Warum)

Als Reiseleiter will ich die Personen erfassen, mit denen ich reise —
mit Telefonnummer für unterwegs und Bankverbindung für die spätere
Abrechnung. Heute existiert nur mein eigener Eintrag, und der entstand
nebenbei bei der Anmeldung.

# Funktion (Was)

Der Bereich „Einstellungen" des Planers zeigt eine Karte
„Reiseteilnehmer" mit allen Personen des Accounts. Je Person erscheinen
Name, E-Mail-Adresse, Telefonnummer und Bankverbindung.

Personen lassen sich anlegen, ändern und entfernen. Der Name ist
erforderlich und höchstens 80 Zeichen lang; E-Mail-Adresse,
Telefonnummer und Bankverbindung dürfen leer bleiben.

Ist eine E-Mail-Adresse angegeben, muss sie unter allen Personen des
Accounts eindeutig sein. Ist eine Bankverbindung angegeben, wird sie
auf ein gültiges Format samt Prüfziffer geprüft; eine unzulässige
Angabe wird nicht gespeichert.

Die eigene Person erscheint in der Liste, ist als solche gekennzeichnet
und lässt sich nicht entfernen. Ihre Angaben sind änderbar.

Vor dem Entfernen einer Person erscheint eine Rückfrage mit ihrem
Namen. Erst nach Bestätigung wird sie entfernt.

Fehlt eine erforderliche Angabe oder ist eine Angabe unzulässig, wird
nicht gespeichert und die betroffene Stelle benannt.

Die erfassten Personen sind noch keiner einzelnen Reise zugeordnet und
erhalten keinen Zugang zur Anwendung.

# GUI

- Vorlage: `delivery/design/planer/README (1).md`, Abschnitt
  „7. Einstellungen", Karte „Reiseteilnehmer · N Personen".
- Verbindlichkeit: eng folgen, soweit die Vorlage trägt.
- Abweichung zur Vorlage: Statt des Rollen-Auswahlfelds erscheinen die
  Felder für Telefonnummer und Bankverbindung. Rollen gibt es noch
  nicht.
- Die Karte „Eckdaten der Reise" aus der Vorlage ist nicht Teil dieses
  Requirements; der Bereich zeigt vorerst nur die Teilnehmer.

# Akzeptanzkriterien

- [ ] Gegeben ich bin angemeldet, wenn ich im Planer den Bereich
      „Einstellungen" öffne, dann sehe ich die Karte
      „Reiseteilnehmer".
- [ ] Gegeben der Bereich ist geöffnet, wenn ich ihn betrachte, dann
      erscheint dort mein eigener Eintrag.
- [ ] Gegeben mein eigener Eintrag, wenn ich ihn betrachte, dann ist er
      als eigene Person gekennzeichnet.
- [ ] Gegeben der Bereich ist geöffnet, wenn ich eine Person mit dem
      Namen „Clara Berger", der Telefonnummer „+43 664 1234567" und der
      Bankverbindung „AT611904300234573201" anlege, dann erscheint
      „Clara Berger" in der Liste.
- [ ] Gegeben die angelegte Person „Clara Berger", wenn ich ihre
      Telefonnummer auf „+43 664 7654321" ändere und speichere, dann
      steht dort „+43 664 7654321".
- [ ] Gegeben der Bereich ist geöffnet, wenn ich eine Person ohne Namen
      anzulegen versuche, dann wird sie NICHT angelegt.
- [ ] Gegeben der Bereich ist geöffnet, wenn ich eine Person mit der
      Bankverbindung „AT611904300234573200" anzulegen versuche, dann
      wird sie NICHT angelegt.
- [ ] Gegeben der Bereich ist geöffnet, wenn ich eine Person nur mit
      dem Namen „Max Gast" anlege, dann erscheint „Max Gast" in der
      Liste.
- [ ] Gegeben meine eigene Adresse ist uwe@kremmel.org, wenn ich eine
      weitere Person mit derselben Adresse anzulegen versuche, dann
      wird sie NICHT angelegt.
- [ ] Gegeben die Person „Clara Berger", wenn ich sie zu entfernen
      versuche, dann nennt die Rückfrage ihren Namen.
- [ ] Gegeben die Rückfrage, wenn ich bestätige, dann erscheint „Clara
      Berger" NICHT mehr in der Liste.
- [ ] Gegeben mein eigener Eintrag, wenn ich ihn betrachte, dann gibt
      es dort KEINE Möglichkeit zum Entfernen.
- [ ] Gegeben eine angelegte Person mit E-Mail-Adresse, wenn diese
      Person einen Anmeldelink anfordert, dann erhält sie KEINEN
      Zugang.

# Constraints

- Die Bankverbindung wird nach dem international üblichen Format samt
  Prüfziffer geprüft. Sie dient allein der späteren Abrechnung
  innerhalb der Gruppe; es wird kein Geld bewegt (siehe
  [vision.md](../../vision.md)).
- Telefonnummer und Bankverbindung sind personenbezogene Daten. Sie
  sind nur für angemeldete Personen desselben Accounts sichtbar (siehe
  [security.md](../../security.md)).
- Personen gehören zum Account, nicht zu einer einzelnen Reise. Eine
  Zuordnung zu Reisen existiert im Datenmodell noch nicht.

# Nicht Teil dieses Requirements

- Zuordnung von Personen zu einzelnen Reisen
- Rollen wie Reiseleiter oder Teilnehmer
- Einladung per QR-Code oder Anmeldelink für die angelegten Personen
- Kennzeichnungen wie Autofahrer oder Kassenführer
- Eckdaten der Reise (Reiseart, Budget, Währung)
- Ausgaben, Saldenausgleich und Kostenabrechnung
- Bild oder Farbe je Person
