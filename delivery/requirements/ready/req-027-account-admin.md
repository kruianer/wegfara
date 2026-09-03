---
id: req-027
title: Account-Admin
app: wegfara
area: Planung
priority: normal
created: 2026-09-03
changes: req-019
---

# Ziel (Warum)

Sobald mehrere Personen in einem Account arbeiten, soll nicht jede von
ihnen die Personenliste umbauen oder später Zugangsschlüssel setzen
können. Es braucht eine Person, die für den Account verantwortlich ist
— unabhängig davon, wer bei welcher Reise Reiseleiter ist.

# Funktion (Was)

Jede Person eines Accounts kann die Kennzeichnung **Account-Admin**
tragen. Sie gilt für den ganzen Account, nicht für eine einzelne Reise
— anders als die Rolle Reiseleiter aus req-021.

Die erste Person eines neuen Accounts ist automatisch Account-Admin
(siehe req-025).

Ein Account-Admin kann weitere Personen des Accounts dazu ernennen und
ihnen die Kennzeichnung wieder entziehen. Die letzte lässt sich nicht
entziehen: Ein Account hat immer mindestens einen Account-Admin.

**Nur ein Account-Admin darf Personen anlegen, ändern und entfernen.**
Wer die Kennzeichnung nicht trägt, sieht die Personenliste, kann sie
aber nicht verändern.

Der Gesamt-Admin aus req-025 gilt in jedem Account, in den er
gewechselt ist, als Account-Admin.

# Änderung gegenüber heute (req-019)

Heute darf jede angemeldete Person Personen anlegen, ändern und
entfernen. Das wird auf Account-Admins **eingeschränkt**. Die
Personenverwaltung selbst bleibt unverändert; nur wer sie bedienen
darf, ändert sich.

Alle heute bestehenden Personen ohne Kennzeichnung behalten Lesezugang
zur Liste.

# GUI

- Die Kennzeichnung erscheint in der Karte „Reiseteilnehmer" je Person
  als umschaltbares Merkmal, sichtbar nur für Account-Admins.
- Personen ohne die Kennzeichnung sehen die Liste ohne Schaltflächen
  zum Anlegen, Ändern und Entfernen.
- Erscheinungsbild wie der übrige Planer.

# Akzeptanzkriterien

- [ ] Gegeben ich bin Account-Admin, wenn ich die Karte
      „Reiseteilnehmer" betrachte, dann sehe ich die Schaltfläche zum
      Anlegen einer Person.
- [ ] Gegeben ich bin kein Account-Admin, wenn ich die Karte
      betrachte, dann erscheint dort KEINE Schaltfläche zum Anlegen.
- [ ] Gegeben ich bin kein Account-Admin, wenn ich die Karte
      betrachte, dann sehe ich die Personen des Accounts.
- [ ] Gegeben ich bin kein Account-Admin, wenn ich über die
      Schnittstelle eine Person anzulegen versuche, dann wird sie NICHT
      angelegt.
- [ ] Gegeben ich bin Account-Admin und „Clara Berger" ist es nicht,
      wenn ich sie dazu ernenne, dann trägt sie die Kennzeichnung.
- [ ] Gegeben „Clara Berger" ist Account-Admin, wenn ich ihr die
      Kennzeichnung entziehe, dann trägt sie sie nicht mehr.
- [ ] Gegeben ich bin der einzige Account-Admin, wenn ich mir die
      Kennzeichnung zu entziehen versuche, dann trage ich sie
      weiterhin.
- [ ] Gegeben ein neu angelegter Account, wenn seine erste Person sich
      anmeldet, dann ist sie Account-Admin.
- [ ] Gegeben ich bin Gesamt-Admin und in einen fremden Account
      gewechselt, wenn ich die Karte betrachte, dann sehe ich die
      Schaltfläche zum Anlegen einer Person.

# Constraints

- Die Kennzeichnung Account-Admin gilt für einen Account. Sie ist etwas
  anderes als die Rolle Reiseleiter aus req-021, die je Reise gilt, und
  etwas anderes als der Gesamt-Admin aus req-025, der accountübergreifend
  arbeitet.
- Die Prüfung erfolgt serverseitig. Es genügt nicht, Schaltflächen
  auszublenden — ein Zugriff über die Schnittstelle muss ebenso
  abgewiesen werden.
- Ein Account hat immer mindestens einen Account-Admin.

# Nicht Teil dieses Requirements

- Zugangsschlüssel je Account
- Einschränkung anderer Bereiche (Reisen, POIs, Programmpunkte) nach
  Rolle
- Rechte der Rolle Reiseleiter aus req-021
- Anzeige, wer wann eine Kennzeichnung vergeben hat
