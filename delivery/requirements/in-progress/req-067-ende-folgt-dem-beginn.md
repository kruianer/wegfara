---
id: req-067
title: Enddatum folgt dem Beginn
app: wegfara
area: Reise
priority: normal
created: 2026-09-19
---

# Goal (Why)

Als Reiseleiter lege ich eine neue Reise an, trage den Beginn ein — und
tippe beim Ende wieder durch den Kalender, obwohl das Gerät mir den
aktuellen Monat und das heutige Datum anbietet. Das heutige Datum ist für
das Ende einer Reise nie die richtige Antwort: Es liegt vor dem Beginn.

Eine Woche ist die Länge, bei der die meisten Reisen anfangen. Steht sie
schon da, korrigiere ich sie mit zwei Drehungen — statt von heute aus
Monate weit zu scrollen.

# Function (What)

Sobald ein **Beginn** eingetragen ist und das **Ende** noch leer, wird das
Ende auf **Beginn + 7 Tage** vorbelegt.

Der Vorschlag ist nur ein Vorschlag:

- Er erscheint nur, solange das Ende **leer** ist. Ein eingetragenes Ende
  wird nie überschrieben — auch dann nicht, wenn der Beginn nachträglich
  geändert wird.
- Er lässt sich wie jedes Datum ändern.

Damit steht beim Aufklappen des Kalenders für das Ende der richtige Monat
da, nicht der heutige.

# Acceptance Criteria

- [x] Gegeben ich lege eine neue Reise an und das Ende ist leer, wenn ich
      einen Beginn eintrage, dann steht im Ende der Beginn plus sieben
      Tage.
- [x] Gegeben das Ende ist so vorbelegt, wenn ich es antippe, dann zeigt
      der Kalender den Monat dieses Datums und nicht den heutigen.
- [x] Gegeben ich habe das Ende bereits selbst eingetragen, wenn ich
      danach den Beginn ändere, dann bleibt mein Ende unverändert.
- [x] Gegeben ich habe das Ende bereits selbst eingetragen, wenn ich es
      ansehe, dann wurde es NICHT durch Beginn plus sieben Tage ersetzt.
- [x] Gegeben das Ende ist vorbelegt, wenn ich es ändere, dann wird meine
      Eingabe übernommen.
- [ ] Gegeben ich bearbeite eine bestehende Reise mit gefülltem Ende,
      wenn ich den Beginn ändere, dann bleibt das Ende unverändert.

# Constraints

- Das Ende darf weiterhin nicht vor dem Beginn liegen; die bestehende
  Prüfung aus req-033 bleibt.
- Die Vorbelegung ist ein Vorschlag im Formular, keine Regel in der
  Datenbank: Reisen mit anderer Länge bleiben uneingeschränkt möglich.

# Out of Scope

- Die Länge aus früheren Reisen ableiten oder lernen.
- Ein Feld „Dauer" neben Beginn und Ende.
- Feiertage oder Ferien beim Vorschlag berücksichtigen.
