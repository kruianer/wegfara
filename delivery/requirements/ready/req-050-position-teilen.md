---
id: req-050
title: Position mit der Reisegruppe teilen
app: wegfara
area: Reise
priority: normal
created: 2026-09-06
---

# Goal (Why)

Als Teilnehmer einer Reise will ich die anderen auf der Karte sehen,
wenn wir uns unterwegs verlieren — in einer fremden Stadt, im Gedränge,
nach einem verpassten Bus. Wer nicht gesehen werden will, teilt seine
Position nicht; das ist jederzeit seine Entscheidung.

# Function (What)

Jeder Teilnehmer entscheidet **je Reise**, ob er seine Position teilt.
Ein Schalter „Meine Position teilen" schaltet es ein und wieder aus; die
Freigabe gilt bis zum Widerruf.

Geteilt wird nur, wenn **beides** zutrifft: das heutige Datum liegt im
Zeitraum der Reise, und sie steht im Zustand „Freigegeben". Sonst
passiert nichts — auch nicht bei eingeschaltetem Schalter.

Auf der Karte im Begleiter erscheint je Teilnehmer, der geteilt hat, ein
farbiger Punkt mit seinem Anzeigenamen und dem Alter der Position („vor
2 Min"). Die eigene Position wird alle 15 Sekunden aktualisiert —
**nur** solange die Karte offen und die Anzeige eingeblendet ist. Ist
die Karte zu oder die Anzeige ausgeblendet, wird die Position weder
ermittelt noch gesendet.

Die Anzeige lässt sich auf der Karte ein- und ausblenden.

Positionen, die älter als 15 Minuten sind, verschwinden von der Karte —
eine alte Position ist beim Suchen schlechter als keine.

Gespeichert wird je Teilnehmer **nur die letzte** Position; jede neue
überschreibt die vorherige. Es entsteht keine Historie und kein
Bewegungsprofil.

Wird der Schalter ausgeschaltet, verschwindet die Position sofort von
den Karten der anderen und wird gelöscht.

# Acceptance Criteria

- [ ] Gegeben eine Reise im Zustand „Freigegeben", deren Zeitraum heute
      einschließt, wenn ich „Meine Position teilen" einschalte und die
      Karte öffne, dann sehen die anderen Teilnehmer meinen Punkt.
- [ ] Gegeben ich habe geteilt, wenn ein anderer Teilnehmer meinen Punkt
      ansieht, dann steht mein Anzeigename daneben.
- [ ] Gegeben meine Position ist 2 Minuten alt, wenn ein anderer sie
      ansieht, dann steht dort „vor 2 Min".
- [ ] Gegeben meine Position ist 16 Minuten alt, wenn ein anderer die
      Karte ansieht, dann ist mein Punkt NICHT mehr zu sehen.
- [ ] Gegeben ich habe nicht geteilt, wenn ein anderer die Karte
      ansieht, dann ist mein Punkt NICHT zu sehen.
- [ ] Gegeben ich habe geteilt, wenn ich den Schalter ausschalte, dann
      ist mein Punkt sofort von der Karte der anderen verschwunden.
- [ ] Gegeben eine Reise im Zustand „In Planung", deren Zeitraum heute
      einschließt, wenn ich „Meine Position teilen" eingeschaltet habe,
      dann wird meine Position NICHT geteilt.
- [ ] Gegeben eine Reise im Zustand „Freigegeben", deren Zeitraum
      gestern endete, wenn ich die Karte öffne, dann wird meine Position
      NICHT geteilt.
- [ ] Gegeben die Anzeige der Positionen ist ausgeblendet, wenn ich die
      Karte offen habe, dann wird meine Position NICHT gesendet.
- [ ] Gegeben ich schließe den Begleiter, wenn 15 Sekunden vergehen,
      dann wird KEINE neue Position gesendet.
- [ ] Gegeben ich habe die Standortfreigabe im Browser abgelehnt, wenn
      ich den Schalter einschalte, dann sehe ich einen Hinweis darauf —
      und die App versucht es nicht weiter.
- [ ] Gegeben ich teile meine Position seit einer Stunde, wenn ich
      nachsehe, was gespeichert ist, dann gibt es genau einen Eintrag
      und KEINEN zurückliegenden Verlauf.
- [ ] Gegeben ich bin Teilnehmer einer anderen Reise, wenn ich deren
      Karte öffne, dann sehe ich KEINE Positionen aus dieser Reise.

# Constraints

- Positionen der Gruppe nur bei aktiver Reise, nur mit Zustimmung des
  Teilnehmers, ohne Historie — Leitprinzip aus
  [vision.md](../../vision.md).
- Kein Hintergrund-Standort: die Position wird nur bei geöffneter App
  aktualisiert (siehe [stack.md](../../stack.md)).
- Der Browser gibt den Standort nur im „secure context" heraus; beide
  Umgebungen laufen über HTTPS (siehe [security.md](../../security.md)).

# Out of Scope

- Der Live-Status-Balken mit Verzug — das ist req-051.
- Benachrichtigung, wenn sich jemand entfernt oder die Gruppe verlässt.
- Wegstrecken, Verlauf oder Auswertung der Positionen.
- Positionen im Planer (`/plan`) anzeigen.
- Position teilen mit Personen außerhalb der Reise.
