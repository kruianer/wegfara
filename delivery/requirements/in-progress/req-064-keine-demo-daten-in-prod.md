---
id: req-064
title: Keine Demo-Daten in einer frischen Umgebung
app: wegfara
area: Reise
priority: high
created: 2026-09-16
---

# Goal (Why)

Als Betreiber habe ich prod aufgesetzt und fand darin drei fremde Reisen
vor — Süditalien, Wien, Alpen-Adria, mit 20 POIs und 42 Programmpunkten.
Sie stammen aus Migrationen, die zur Erprobung gedacht waren und seither
in jede frische Umgebung mitlaufen. Eine neue Umgebung soll leer sein;
was ich zum Entwickeln brauche, hole ich mir ausdrücklich.

# Function (What)

Die Migrationen legen **keine Reisedaten** mehr an: keine Reisen, POIs,
Programmpunkte, Transfers, Optionsgruppen und keine An- und Abreise.
Betroffen sind die sechs Seed-Migrationen (0002, 0004, 0006, 0009, 0011,
0017); ihre Schema-Änderungen bleiben unverändert, nur die Datenzeilen
entfallen.

**Account und Betreiber bleiben.** Der Account „Uwe Kremmel" und sein
Teilnehmer-Eintrag mit `uwe@kremmel.org` entstehen weiterhin aus den
Migrationen — sie sind kein Demo-Datum, sondern der Zugang zur App.

**Die Testdaten bleiben erhalten**, aber an anderer Stelle: Die
Testumgebung spielt sie beim Aufbau ein, sodass die vorhandenen Tests
unverändert grün bleiben. Dieselben drei Reisen, dieselben POIs,
dieselben Zahlen.

**Ein Kommando füllt eine frische dev-Umgebung** mit denselben Daten —
ausdrücklich aufgerufen, nie von selbst.

**Bestehende Umgebungen werden nicht angefasst.** Was auf dev heute
liegt, bleibt liegen; die Änderung wirkt nur auf ein frisch aufgebautes
Schema.

Nach der Umsetzung wird [datenbank.md](../../datenbank.md) auf den neuen
Stand gebracht.

# Acceptance Criteria

- [x] Gegeben eine leere Datenbank, wenn alle Migrationen eingespielt
      sind, dann enthält sie 0 Reisen.
- [x] Gegeben eine leere Datenbank, wenn alle Migrationen eingespielt
      sind, dann enthält sie 0 POIs.
- [x] Gegeben eine leere Datenbank, wenn alle Migrationen eingespielt
      sind, dann enthält sie 0 Programmpunkte.
- [x] Gegeben eine leere Datenbank, wenn alle Migrationen eingespielt
      sind, dann enthält sie 0 Transfers.
- [x] Gegeben eine leere Datenbank, wenn alle Migrationen eingespielt
      sind, dann enthält sie genau einen Account.
- [x] Gegeben eine leere Datenbank, wenn alle Migrationen eingespielt
      sind, dann enthält sie genau einen Teilnehmer mit der Adresse
      `uwe@kremmel.org`.
- [x] Gegeben die vorhandene Testsuite, wenn sie läuft, dann findet der
      Test „liefert zwölf POIs für die Süditalien Rundreise" weiterhin
      zwölf POIs.
- [x] Gegeben die vollständige Testsuite, wenn sie läuft, dann ist sie
      grün.
- [ ] Gegeben eine frisch aufgebaute dev-Umgebung, wenn ich das Kommando
      zum Befüllen ausführe, dann stehen danach die drei Reisen darin.
- [ ] Gegeben eine frisch aufgebaute Umgebung, wenn ich das Kommando
      NICHT ausführe, dann bleibt sie leer.
- [ ] Gegeben die heutige dev-Umgebung mit ihren Daten, wenn die
      Änderung eingespielt ist, dann sind ihre Reisen unverändert
      vorhanden.
- [ ] Gegeben die Umsetzung ist fertig, wenn ich
      [datenbank.md](../../datenbank.md) öffne, dann steht dort, dass
      Migrationen keine Reisedaten mehr anlegen.

# Constraints

- Migrationen müssen die Daten bestehender Umgebungen erhalten (siehe
  [devops.md](../../devops.md)) — es wird nichts gelöscht, nur künftig
  nichts mehr angelegt.
- Eine Migration ist eine Schema-Änderung; die Nummern und ihre
  Reihenfolge bleiben, damit bereits eingespielte Umgebungen sie nicht
  erneut anwenden.

# Out of Scope

- Demo-Daten aus bestehenden Umgebungen entfernen — auf prod bereits
  von Hand erledigt, dev behält sie.
- Die rund zwanzig Testdateien umschreiben, damit jeder Test seine Daten
  selbst anlegt.
- Den Account und den Betreiber aus den Migrationen nehmen.
- Ein Kommando, das eine Umgebung wieder leert.
