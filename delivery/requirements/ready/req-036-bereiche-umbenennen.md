---
id: req-036
title: Verwaltung und Mein Bereich
app: wegfara
area: Planung
priority: normal
created: 2026-09-04
changes: req-025, req-032
---

# Ziel (Warum)

Zwei Bereiche heißen heute beide „Account", meinen aber
Verschiedenes: der eine verwaltet fremde Accounts, der andere enthält
meine eigenen Personen und Zugangsschlüssel. Beim Lesen ist nicht
erkennbar, in welchem man gerade ist.

# Funktion (Was)

Die beiden Bereiche werden umbenannt:

- **Verwaltung** — der Bereich des Gesamt-Admins, in dem Accounts
  angelegt, ihre erste Person eingeladen und Accounts gewechselt
  werden (bisher „Account-Verwaltung", siehe req-025).
- **Mein Bereich** — die Personen und Zugangsschlüssel des eigenen
  Accounts (bisher „Account", siehe req-032).

Das Wort „Account" verschwindet aus der Oberfläche. Wo es bisher für
einen einzelnen Account stand, heißt es künftig **Bereich**: „Neuer
Bereich", „Name des Bereichs", „In den Bereich wechseln: Familie
Huber", „Du arbeitest im Bereich von Familie Huber".

Im Datenmodell, in den Adressen und im Quelltext bleibt alles
unverändert — nur die sichtbaren Beschriftungen ändern sich.

# Änderung gegenüber heute

Beschriftungen werden **ersetzt**, nicht ergänzt. Es entstehen keine
neuen Bereiche und keine zusätzlichen Einträge im Kopfbereich; Inhalt
und Rechte bleiben unverändert.

Betroffen sind unter anderem:

| bisher | künftig |
|---|---|
| Account-Verwaltung | Verwaltung |
| Account (Bereich) | Mein Bereich |
| Neuer Account | Neuer Bereich |
| Name des Accounts | Name des Bereichs |
| In den Account wechseln: X | In den Bereich wechseln: X |
| Du arbeitest im Account von X | Du arbeitest im Bereich von X |

Die Liste ist nicht abschließend: Jede sichtbare Stelle, an der
„Account" steht, wird entsprechend angepasst.

# Akzeptanzkriterien

- [ ] Gegeben ich bin Gesamt-Admin, wenn ich den Kopfbereich
      betrachte, dann steht dort „Verwaltung".
- [ ] Gegeben ich bin angemeldet, wenn ich den Kopfbereich betrachte,
      dann steht dort „Mein Bereich".
- [ ] Gegeben ich bin angemeldet, wenn ich den Kopfbereich betrachte,
      dann steht dort NICHT „Account".
- [ ] Gegeben ich öffne „Verwaltung", wenn ich einen neuen Bereich
      anlege, dann heißt die Schaltfläche „Neuer Bereich".
- [ ] Gegeben ich öffne „Verwaltung", wenn ich die Liste betrachte,
      dann steht bei jedem Eintrag „In den Bereich wechseln".
- [ ] Gegeben ich bin in einen fremden Bereich gewechselt, wenn ich
      den Hinweisbalken betrachte, dann nennt er den Bereich statt den
      Account.
- [ ] Gegeben ich öffne „Mein Bereich", wenn ich ihn betrachte, dann
      sehe ich unverändert die Personen und die Zugangsschlüssel.
- [ ] Gegeben ich bin kein Gesamt-Admin, wenn ich den Kopfbereich
      betrachte, dann erscheint „Verwaltung" NICHT.

# Constraints

- Nur sichtbare Beschriftungen ändern sich. Datenmodell, Adressen der
  Seiten und Bezeichner im Quelltext bleiben unverändert — sie tragen
  weiterhin „account".
- Rechte und Sichtbarkeit bleiben unverändert (siehe req-025,
  req-027, req-032).

# Nicht Teil dieses Requirements

- Umbenennung im Datenmodell oder in den Adressen
- Änderungen an Rechten oder Inhalten der Bereiche
- Umbenennung des Begriffs in den Requirements oder in
  `delivery/`-Dateien
- Umbenennung der Konto-Seite mit Passkey und Notfallcodes
