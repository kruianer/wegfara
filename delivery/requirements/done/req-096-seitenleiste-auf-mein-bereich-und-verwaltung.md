---
id: req-096
title: Seitenleiste auf "Mein Bereich" und in der Verwaltung
app: wegfara
area: Planung
priority: normal
created: 2026-10-28
changes: bug-033, req-077, req-094
---

# Goal (Why)

„Mein Bereich" (req-043) und die „Verwaltung" (req-025) tragen ein Menü
am Kopf, während der Planer eine Seitenleiste hat. Das ist ein Bruch
mitten im Weg: Die Seitenleiste führt in ihrem Fuß zu beiden Seiten hin —
und dort angekommen steht plötzlich ein Menü oben.

Der Bruch hatte einen Grund, und der steht in bug-033:

> „Der Planer selbst trägt seit req-077 stattdessen eine Seitenleiste;
> diese Seite behält die Kopfleiste — sie ruft auf, wer nur das
> Smartphone dabei hat, und eine Leiste am Rand kostete dort zu viel
> Breite."

**Das Argument ist mit req-094 entfallen.** Die Leiste war damals 320 px
breit, wenn sie aufgeklappt war. Heute ist sie **60 px** und klappt nicht
mehr auf — auch auf 375 px kostet sie nicht zu viel.

# Function (What)

Beide Seiten tragen künftig die Seitenleiste des Planers: links die
Leiste, rechts der Inhalt mit eigenem Bildlauf. Die Kopfleiste entfällt
dort — mit einer Ausnahme, siehe unten.

## Welche Reise die Leiste zeigt

Die Leiste führt durch die Bereiche **einer** Reise. Diese Seiten haben
keine, deshalb gilt die **vorausgewählte**: die laufende, sonst die
nächste geplante, sonst die zuletzt beendete
(`lib/trips/select-default.ts`). Das ist dieselbe Wahl, die der Planer
beim Öffnen trifft — wer einen Bereich antippt, landet dort, wo er ihn
erwartet.

Gibt es **keine Reise**, erscheint die Leiste nicht: Ihre Bereiche
gehören einer Reise, und die Reisewahl wäre eine leere Liste. Das ist
dasselbe Verhalten wie im Planer.

## Jeder Griff führt in den Planer

Im Planer schaltet die Leiste zwischen Bereichen um. Hier gibt es nichts
umzuschalten: Ein Griff **wechselt die Seite**. Der Bereich steht dabei
in der Adresse (`?bereich=`, schon für bug-033 gebaut), der Planer geht
also gleich in ihm auf.

Kein Eintrag ist hervorgehoben, denn keiner dieser Bereiche ist offen.

## Das Abmelden steht nur einmal

„Mein Bereich" zeigt das Abmelden schon in der Karte „Meine Geräte".
Stünde es zusätzlich im Fuß der Leiste, gäbe es zwei Knöpfe mit
demselben Namen auf einer Seite. Im Fuß entfällt es deshalb **auf dieser
Seite** — im Planer und in der Verwaltung bleibt es.

## Die eine Ausnahme: ohne Planer-Recht

Wer den Planer nicht darf (req-055), bekommt die Seitenleiste **nicht** —
sie führte ihn in Bereiche, die ihm verwehrt sind. Ohne sie bräuchte er
aber einen Weg zurück in den Begleiter, und den trägt die Kopfleiste.

**Für diesen Fall bleibt sie.** Sonst sitzt ein Teilnehmer, der nur seine
Passkeys verwalten wollte, auf dieser Seite fest — das wäre eine
Verschlechterung gegenüber bug-033.

Die Verwaltung braucht diese Ausnahme nicht: Sie sieht ausschließlich der
Gesamt-Admin, und der darf den Planer immer.

# GUI

- Die Leiste ist dieselbe wie im Planer
  (`app/plan/components/seitenleiste.tsx`), unverändert in Maßen und
  Farben. Es entsteht keine zweite Leiste.
- Links die Leiste, rechts der Inhalt. Der Bildlauf gehört dem Inhalt —
  die Leiste bleibt stehen, wie im Planer.
- Bei 375, 768 und 1280 px gelten die vier Regeln aus `stack.md`.

# Acceptance Criteria

- [x] Gegeben ich öffne „Mein Bereich", wenn ich die Seite ansehe, dann
      steht links die Seitenleiste und KEIN Menü am Kopf.
- [x] Gegeben ich öffne die Verwaltung, wenn ich die Seite ansehe, dann
      steht links die Seitenleiste.
- [x] Gegeben „Mein Bereich", wenn ich in der Leiste „POIs" antippe,
      dann öffnet sich der Planer in diesem Bereich.
- [x] Gegeben „Mein Bereich", wenn ich die Leiste ansehe, dann ist kein
      Bereich hervorgehoben.
- [x] Gegeben „Mein Bereich", wenn ich nach „Abmelden" suche, dann gibt
      es den Knopf genau einmal.
- [x] Gegeben „Mein Bereich", wenn ich die Leiste ansehe, dann stehen
      unter den Symbolen die kurzen Namen (req-094).
- [x] Gegeben ich darf den Planer nicht (req-055), wenn ich „Mein
      Bereich" öffne, dann sehe ich die Kopfleiste mit dem Weg in den
      Begleiter — und nicht die Seitenleiste.
- [x] Gegeben der Account hat keine Reise, wenn ich „Mein Bereich"
      öffne, dann erscheint die Seitenleiste nicht.
- [x] Gegeben die Verwaltung, wenn ich die Leiste ansehe, dann führt sie
      zum Begleiter und zu „Mein Bereich".
- [x] Gegeben beide Seiten bei 375 px, wenn ich sie ansehe, dann ragt
      nichts über den Rand.

# Constraints

- Es entsteht **keine zweite Leiste**. Beide Seiten benutzen dieselbe
  Komponente; was ihnen fehlt (Planer-Zustand), stellt ein Rahmen davor
  bereit (`seitenleiste-ausserhalb.tsx`).
- Der Sprung in den Planer läuft über ein übergebenes `navigate`, nicht
  über `next/navigation`: Die Ansichten dieser Seiten werden ohne
  App-Router geprüft, und sie haben dieses Muster schon.
- `activeArea` darf null sein — diese Seiten sind kein Bereich des
  Planers. Vorher war es Pflicht.
- Die Kopfleiste (`components/bereichsleiste.tsx`) bleibt unverändert.
  Sie weiß nicht, in welchem Rahmen sie steht; was sich an ihrer
  Anordnung ändert, steht in der CSS der Seite.
- Die Tests zu bug-033 werden **umgeschrieben, nicht gelöscht**: Was sie
  prüfen — Weg in jeden Bereich, in den Begleiter, Abmelden genau
  einmal — gilt weiter, nur über die Leiste statt über das Kopfmenü.

# Out of Scope

- Die Leiste selbst ändern (Maße, Symbole, Beschriftungen) — das war
  req-094.
- Den Begleiter.
- Die Leiste auf den Seiten der Anmeldung, Einladung oder
  Ersteinrichtung. Dort ist niemand angemeldet oder es gibt noch keine
  Reise.
- Die gewählte Reise auf diesen Seiten wechseln können. Der Griff führt
  in den Planer, der sie dann öffnet.
- Den gedruckten Reiseplan (req-080).
