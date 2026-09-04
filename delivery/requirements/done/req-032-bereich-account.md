---
id: req-032
title: Bereich Account
app: wegfara
area: Planung
priority: normal
created: 2026-09-04
changes: req-019, req-027, req-028
---

# Ziel (Warum)

Personen und Zugangsschlüssel gehören zum Account, nicht zu einer
einzelnen Reise. Heute stehen sie im Bereich „Einstellungen" neben
Dingen, die nur die geöffnete Reise betreffen — beim Reisewechsel
sieht es aus, als änderten sie sich mit.

# Funktion (Was)

Der Kopfbereich des Planers erhält einen Bereich **Account**. Er
enthält, was für den ganzen Account gilt:

- die Personen des Accounts, wie bisher unter „Einstellungen" (Anlegen,
  Ändern, Entfernen — nur durch einen Account-Admin, siehe req-027)
- die Zugangsschlüssel (siehe req-028)

Der Bereich ist für jede angemeldete Person sichtbar. Was sie darin
verändern darf, richtet sich unverändert nach req-027 und req-028: Die
Personenliste sieht jeder, ändern darf sie nur ein Account-Admin; die
Zugangsschlüssel sieht nur ein Account-Admin.

Der Inhalt ist unabhängig von der geöffneten Reise. Ein Reisewechsel
ändert daran nichts.

# Änderung gegenüber heute

Die Karten „Reiseteilnehmer" (Personen des Accounts) und
„Zugangsschlüssel" **wandern** aus dem Bereich „Einstellungen" in den
neuen Bereich „Account". Sie werden dort nicht zusätzlich angelegt —
im Bereich „Einstellungen" verschwinden sie.

Die Rechteprüfungen aus req-027 und req-028 bleiben unverändert
bestehen; nur der Ort ändert sich.

Nicht betroffen ist die Account-Verwaltung des Gesamt-Admins aus
req-025 — sie bleibt ein eigener Bereich, weil sie andere Accounts
betrifft.

# GUI

- Der Bereich „Account" erscheint im Kopfbereich zwischen den übrigen
  Bereichen, vor der Account-Verwaltung des Gesamt-Admins.
- Die beiden Karten behalten Aufbau und Erscheinungsbild.

# Akzeptanzkriterien

- [ ] Gegeben ich bin angemeldet, wenn ich den Kopfbereich betrachte,
      dann sehe ich den Bereich „Account".
- [ ] Gegeben ich bin Account-Admin, wenn ich den Bereich „Account"
      öffne, dann sehe ich die Karte mit den Personen des Accounts.
- [ ] Gegeben ich bin Account-Admin, wenn ich den Bereich „Account"
      öffne, dann sehe ich die Karte „Zugangsschlüssel".
- [ ] Gegeben ich bin kein Account-Admin, wenn ich den Bereich
      „Account" öffne, dann erscheint die Karte „Zugangsschlüssel"
      NICHT.
- [ ] Gegeben ich bin kein Account-Admin, wenn ich den Bereich
      „Account" öffne, dann sehe ich die Personen des Accounts.
- [ ] Gegeben ich bin kein Account-Admin, wenn ich die Personenkarte
      betrachte, dann erscheint dort KEINE Schaltfläche zum Anlegen.
- [ ] Gegeben der Bereich „Account" ist geöffnet, wenn ich zu einer
      anderen Reise wechsle, dann sind dieselben Personen zu sehen.
- [ ] Gegeben ich öffne den Bereich „Einstellungen", wenn ich ihn
      betrachte, dann erscheint dort KEINE Karte „Zugangsschlüssel".

# Constraints

- Die Rechteprüfung erfolgt weiterhin serverseitig (siehe req-027). Es
  genügt nicht, den Bereich oder eine Karte auszublenden.
- Personen und Zugangsschlüssel gehören zum Account. Sie werden nie
  nach der geöffneten Reise gefiltert.

# Nicht Teil dieses Requirements

- Die Account-Verwaltung des Gesamt-Admins (req-025)
- Neue Rechte oder Rollen
- Weitere Inhalte im Bereich „Account"
- Umbenennung des Accounts
