---
id: req-033
title: Reisedetails
app: wegfara
area: Planung
priority: high
created: 2026-09-04
changes: req-017, req-021, req-022
---

# Ziel (Warum)

Alles, was eine Reise ausmacht, soll an einer Stelle stehen — Name,
Ort, Beschreibung, Zeitraum, wer mitfährt und ob sie freigegeben ist.
Heute liegt das verstreut: die Eckdaten in einem kleinen Formular, die
Teilnehmer unter „Einstellungen", der Zustand im Aufklappmenü. Und wenn
ich eine neue Reise anlege, tippe ich zuerst zwei Felder in einen
Dialog und muss danach woanders weitermachen.

# Funktion (Was)

Der Bereich „Einstellungen" heißt künftig **Reisedetails** und zeigt
alles zur geöffneten Reise:

- **Eckdaten**: Titel, Hauptort, Beschreibung, Beginn und Ende
- **Zustand**: In Planung, Freigegeben oder Abgeschlossen (siehe
  req-022)
- **Wer fährt mit**: die Zuordnung der Personen samt Rolle (siehe
  req-021)

Die **Beschreibung** ist neu: ein mehrzeiliger, freiwilliger Text für
die Gruppe — was geplant ist, was mitzubringen, worauf zu achten.
Höchstens 2000 Zeichen.

**Eine neue Reise anlegen** führt direkt in die Reisedetails. Sie
erscheinen mit leeren Feldern; Titel, Hauptort, Beginn und Ende sind
erforderlich. Erst das Speichern legt die Reise an — wer abbricht,
hinterlässt keinen Eintrag. Nach dem Speichern ist die neue Reise
geöffnet und der Anlegende ihr Reiseleiter.

Der Zustand lässt sich nur bei einer bereits gespeicherten Reise
setzen; eine neue beginnt auf „In Planung".

Die Regeln aus req-017 bleiben: Titel höchstens 80 Zeichen, das Ende
nicht vor dem Beginn, der Hauptort über die Ortssuche.

# Änderung gegenüber heute

- Der Bereich „Einstellungen" wird zu **Reisedetails** umbenannt.
- Die Karte „Wer fährt mit" (req-021) **bleibt** dort.
- Die Karten mit den Personen des Accounts und den Zugangsschlüsseln
  **wandern** in den Bereich „Account" (siehe req-032).
- Das Formular zum Anlegen und Ändern einer Reise aus req-017
  **entfällt**; seine Felder erscheinen in den Reisedetails. Der Weg
  über das Aufklappmenü am Reisenamen führt künftig dorthin.
- Das Setzen des Zustands **wandert** aus dem Aufklappmenü in die
  Reisedetails. Im Aufklappmenü bleibt er sichtbar, ist dort aber nicht
  mehr änderbar.
- Löschen einer Reise bleibt wie in req-017, künftig in den
  Reisedetails.

Es entsteht kein zweites Formular neben dem bestehenden.

# GUI

- Vorlage: `delivery/design/planer/README (1).md`, Abschnitt
  „7. Einstellungen", Karte „Eckdaten der Reise".
- Verbindlichkeit: eng folgen, soweit die Vorlage trägt.
- Ergänzungen zur Vorlage: das Feld für die Beschreibung und die
  Auswahl des Zustands.
- Nicht aus der Vorlage: Reiseart, Standard-Einzugsgebiet, Budget und
  Währung — die gibt es im Datenmodell nicht.

# Akzeptanzkriterien

- [ ] Gegeben der Planer ist geöffnet, wenn ich den Kopfbereich
      betrachte, dann heißt der Bereich „Reisedetails".
- [ ] Gegeben die geöffnete Reise „Süditalien Rundreise", wenn ich die
      Reisedetails öffne, dann steht dort ihr Titel.
- [ ] Gegeben derselbe Zustand, wenn ich die Reisedetails betrachte,
      dann sehe ich die Karte „Wer fährt mit".
- [ ] Gegeben derselbe Zustand, wenn ich eine Beschreibung eintrage und
      speichere, dann steht sie nach dem Neuladen weiterhin dort.
- [ ] Gegeben derselbe Zustand, wenn ich den Zustand auf „Freigegeben"
      setze, dann steht dort „Freigegeben".
- [ ] Gegeben ich wähle „Neue Reise", wenn die Ansicht erscheint, dann
      sehe ich die Reisedetails mit leeren Feldern.
- [ ] Gegeben derselbe Zustand, wenn ich ohne Titel speichere, dann
      wird KEINE Reise angelegt.
- [ ] Gegeben derselbe Zustand, wenn ich Titel „Toskana 2027", Hauptort
      Florenz, Beginn 12.05.2027 und Ende 19.05.2027 eintrage und
      speichere, dann steht „Toskana 2027" im Kopfbereich.
- [ ] Gegeben ich habe die Reise angelegt, wenn ich die Karte „Wer
      fährt mit" betrachte, dann bin ich als Reiseleiter zugeordnet.
- [ ] Gegeben ich habe die Reise angelegt, wenn ich ihren Zustand
      betrachte, dann steht dort „In Planung".
- [ ] Gegeben ich wähle „Neue Reise" und breche ab, wenn ich das
      Aufklappmenü öffne, dann ist dort KEINE zusätzliche Reise.
- [ ] Gegeben das Aufklappmenü am Reisenamen, wenn ich es betrachte,
      dann sehe ich den Zustand jeder Reise.
- [ ] Gegeben das Aufklappmenü, wenn ich es betrachte, dann lässt sich
      der Zustand dort NICHT ändern.
- [ ] Gegeben die Reisedetails, wenn ich sie betrachte, dann erscheint
      dort KEINE Karte mit den Personen des Accounts.

# Constraints

- Die Reisedetails zeigen ausschließlich Angaben zur geöffneten Reise.
  Was zum Account gehört, steht im Bereich „Account" (siehe req-032).
- Eine Reise entsteht erst mit dem Speichern. Es gibt keinen Zustand,
  in dem eine unvollständige Reise in der Liste steht.

# Nicht Teil dieses Requirements

- Reiseart, Budget und Währung als Eckdaten
- Anzeige der Beschreibung im Begleiter
- Freigabe als Benachrichtigung an die Teilnehmer
- Kopieren einer bestehenden Reise als Vorlage
- Bild oder Titelfoto je Reise
