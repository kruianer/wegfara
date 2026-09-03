---
id: req-021
title: Teilnehmer einer Reise zuordnen
app: wegfara
area: Planung
priority: high
created: 2026-09-03
---

# Ziel (Warum)

Als Reiseleiter will ich festlegen, wer bei einer bestimmten Reise
mitfährt. Heute stehen alle Personen unterschiedslos am Account — es
ist nirgends festgehalten, wer zur Süditalien-Rundreise gehört und wer
zur Radtour. Ohne diese Zuordnung lassen sich weder Kosten aufteilen
noch Stimmen zählen.

# Funktion (Was)

Der Bereich „Einstellungen" des Planers zeigt neben der
Personenverwaltung eine Karte „Wer fährt mit". Sie listet die Personen
des Accounts; je Person lässt sich festlegen, ob sie an der geöffneten
Reise teilnimmt.

Jede zugeordnete Person trägt für diese Reise eine Rolle: Reiseleiter
oder Teilnehmer. Dieselbe Person kann bei einer Reise Reiseleiter sein
und bei einer anderen Teilnehmer.

Wer eine Reise anlegt, ist ihr automatisch als Reiseleiter zugeordnet.

Eine Reise hat immer mindestens einen Reiseleiter. Der letzte lässt
sich weder entfernen noch zum Teilnehmer herabstufen.

Vor dem Entfernen einer Person aus einer Reise erscheint eine
Rückfrage mit ihrem Namen. Erst nach Bestätigung wird sie entfernt.

Die Rolle wird erfasst und angezeigt, schränkt aber in diesem
Requirement noch nichts ein — alle angemeldeten Personen können
weiterhin dasselbe tun.

Die Zuordnung gilt je Reise. Ein Wechsel der geöffneten Reise zeigt
deren eigene Zuordnung.

# GUI

- Vorlage: `delivery/design/planer/README (1).md`, Abschnitt
  „7. Einstellungen", Karte „Reiseteilnehmer · N Personen" — dort ist
  das Rollen-Auswahlfeld je Zeile beschrieben.
- Verbindlichkeit: eng folgen.
- Die Karte nennt im Titel die Anzahl der zugeordneten Personen.
- Personen, die der Reise nicht zugeordnet sind, erscheinen abgesetzt
  von den zugeordneten.

# Akzeptanzkriterien

- [ ] Gegeben die geöffnete Reise „Süditalien Rundreise", wenn ich im
      Bereich „Einstellungen" die Karte „Wer fährt mit" betrachte, dann
      sehe ich alle Personen des Accounts.
- [ ] Gegeben die Person „Clara Berger" ist der Reise nicht
      zugeordnet, wenn ich sie zuordne, dann erscheint sie unter den
      zugeordneten Personen.
- [ ] Gegeben „Clara Berger" ist der Reise zugeordnet, wenn ich ihre
      Rolle auf „Reiseleiter" setze, dann steht dort „Reiseleiter".
- [ ] Gegeben ich lege eine neue Reise an, wenn ich die Karte „Wer
      fährt mit" öffne, dann bin ich selbst als Reiseleiter zugeordnet.
- [ ] Gegeben eine Reise mit mir als einzigem Reiseleiter, wenn ich
      meine Rolle auf „Teilnehmer" zu ändern versuche, dann bleibt sie
      „Reiseleiter".
- [ ] Gegeben eine Reise mit mir als einzigem Reiseleiter, wenn ich
      mich aus der Reise zu entfernen versuche, dann bleibe ich
      zugeordnet.
- [ ] Gegeben „Clara Berger" ist zugeordnet, wenn ich sie zu entfernen
      versuche, dann nennt die Rückfrage ihren Namen.
- [ ] Gegeben die Rückfrage, wenn ich sie abbreche, dann bleibt „Clara
      Berger" zugeordnet.
- [ ] Gegeben „Clara Berger" ist der Reise „Süditalien Rundreise"
      zugeordnet, wenn ich zur Reise „Wien Städtereise" wechsle, dann
      ist sie dort NICHT zugeordnet.
- [ ] Gegeben eine Reise mit zwei zugeordneten Personen, wenn ich die
      Karte betrachte, dann nennt ihr Titel die Zahl 2.
- [ ] Gegeben „Clara Berger" ist als Teilnehmer zugeordnet, wenn sie
      sich anmeldet, dann kann sie dieselben Bereiche öffnen wie ein
      Reiseleiter.

# Constraints

- Die Rolle gehört zur Zuordnung zwischen Person und Reise, nicht zur
  Person selbst. Eine Person kann in verschiedenen Reisen
  unterschiedliche Rollen haben.
- Eine Person kann derselben Reise nur einmal zugeordnet sein.
- Es gibt genau zwei Rollen: Reiseleiter und Teilnehmer. Sie sind fest
  vorgegeben und werden nicht als eigene Stammdaten gefuehrt: An einer
  Rolle haengen spaeter Rechtepruefungen, die ohnehin im Code stehen —
  eine frei angelegte dritte Rolle waere wirkungslos, solange niemand
  programmiert hat, was sie darf.

# Nicht Teil dieses Requirements

- Unterschiedliche Rechte je Rolle
- Kennzeichnungen wie Autofahrer oder Kassenführer
- Einladung per QR-Code oder Anmeldelink
- Freigabe einer Reise für die zugeordneten Personen
- Aufteilung von Kosten auf die zugeordneten Personen
- Anzeige der Teilnehmer im Kopfbereich des Planers
- Anzeige der Teilnehmer im Begleiter
