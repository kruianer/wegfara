---
id: bug-004
title: Programmpunkte und Optionsgruppen sind zeitzonenabhängig
app: wegfara
area: Reise
severity: normal
created: 2026-08-02
relates: req-003, req-004
---

# Beobachtung

Drei Tests der Datenzugriffsschicht schlagen fehl, sobald die
Zeitzone der ausführenden Umgebung nicht UTC ist:

- `lib/db/activities.test.ts` — „liefert die Programmpunkte des
  Accounts, sortiert nach Beginnzeit"
- `lib/db/activity-option-selections.test.ts` — „speichert eine Wahl
  und liefert sie danach zurueck"
- `lib/db/activity-option-selections.test.ts` — „ueberschreibt eine
  bestehende Wahl derselben Gruppe"

# Reproduktion

Auf einem Rechner in mitteleuropäischer Zeit (UTC+2):

```
NODE_ENV=test npx vitest run
```

Ergebnis: 3 von 402 Tests schlagen fehl.

Zum Vergleich, dieselbe Suite mit erzwungener Zeitzone:

```
TZ=UTC NODE_ENV=test npx vitest run
```

Ergebnis: alle Tests grün.

# Ursache (Analyse)

Beginn- und Endzeit eines Programmpunkts werden als Zeitstempel ohne
Zeitzone gespeichert (`timestamp without time zone`). Beim Lesen wird
daraus jedoch an mindestens einer Stelle ein Wert in lokaler Zeit
erzeugt. Läuft die Umgebung nicht in UTC, verschiebt sich die Uhrzeit
um den Zonenversatz.

Sichtbar wird das an den Optionsgruppen aus req-004: Deren Schlüssel
setzt sich aus Reise, Beginn und Ende zusammen. Verschiebt sich die
Uhrzeit beim Lesen, passt der Schlüssel nicht mehr zu dem, unter dem
gespeichert wurde — die getroffene Wahl wird nicht mehr gefunden.

Warum es bisher nicht auffiel: Der Beelink läuft in UTC, dort ist der
Versatz null. Der Fehler tritt nur auf Rechnern mit anderer Zeitzone
auf — und beim Nutzer, sobald sein Gerät in einer anderen Zone steht
als der Server.

# Warum das über die Tests hinaus zählt

wegfara ist eine Reise-App. Ein Nutzer in Italien, ein Server in UTC
und ein geplanter Programmpunkt um 13:30 müssen dieselbe Uhrzeit
ergeben. Die Uhrzeit eines Programmpunkts ist eine Ortszeit am
Reiseziel, kein Zeitpunkt auf einer absoluten Achse — sie darf sich
nicht verschieben, egal wo Server oder Gerät stehen.

# Akzeptanzkriterien der Behebung

- [ ] Gegeben ein Rechner in der Zeitzone Europe/Vienna, wenn ich die
      vollständige Testsuite ausführe, dann sind alle Tests grün.
- [ ] Gegeben ein Rechner in der Zeitzone UTC, wenn ich die
      vollständige Testsuite ausführe, dann sind alle Tests grün.
- [ ] Gegeben ein Programmpunkt mit Beginn 13:30, wenn er in einer
      Umgebung mit der Zeitzone Europe/Vienna gelesen wird, dann lautet
      seine Beginnzeit 13:30.
- [ ] Gegeben eine gespeicherte Wahl in einer Optionsgruppe, wenn sie
      in einer Umgebung mit anderer Zeitzone als beim Speichern gelesen
      wird, dann wird dieselbe Wahl zurückgeliefert.
- [ ] Ein Test deckt ab, dass das Lesen eines Programmpunkts
      unabhängig von der Zeitzone der Umgebung dieselbe Uhrzeit
      ergibt.

# Constraints

- Die Uhrzeit eines Programmpunkts gilt als Ortszeit am Reiseziel. Es
  wird nicht in eine andere Zeitzone umgerechnet.
