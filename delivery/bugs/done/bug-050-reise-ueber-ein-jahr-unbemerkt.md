---
id: bug-050
app: wegfara
req: req-033
priority: hoch
created: 2026-09-19
---

# Observed

Auf prod eine Reise für zwei Tage angelegt. Der Planer zeigt aber sehr
viel mehr Reisetage an.

Die Reise steht in der Datenbank als:

```
30 Johr zämma – Rothenburg | 2026-10-25 | 2027-10-26 | 367 Tage
```

Beginn **2026**, Ende **2027** — ein Jahr auseinander. Der Planer zeigt
damit 367 Tage.

# Expected

Zweierlei:

1. Im Planer erscheinen **genau die Tage von Beginn bis Ende** — das tut
   er bereits richtig, sobald die Daten stimmen.
2. Eine Reise, deren Ende ein Jahr nach dem Beginn liegt, entsteht nicht
   unbemerkt. Wer so etwas speichert, wird darauf hingewiesen — und sieht
   beim Eintragen, wie lang die Reise wird.

# Steps

1. Eine neue Reise anlegen
2. Als Beginn den 25.10.2026 eintragen
3. Beim Ende im Kalender versehentlich ins Jahr 2027 geraten
4. Speichern — es erscheint kein Hinweis
5. Im Planer stehen 367 Reisetage

# Ursache

`tripDays` in [days.ts](../../../lib/trips/days.ts) rechnet korrekt: alle
Tage von `startDate` bis `endDate`, jeweils einschließlich. Bei 367 Tagen
Abstand sind es eben 367 Tage. Der Planer zeigt also richtig an, was
gespeichert ist.

Der Fehler sitzt beim **Speichern**: In
[validate.ts](../../../lib/trips/validate.ts) (Zeile 105) wird zum Ende
nur geprüft, ob es **vor** dem Beginn liegt:

```
} else if (!errors.startDate && draft.endDate < draft.startDate) {
  errors.endDate = TRIP_ERRORS.endBeforeStart;
}
```

Ein Ende ein Jahr später ist damit formal gültig und wird stillschweigend
übernommen. Auf dem Datumsfeld des iPads ist genau das leicht passiert:
Der Kalender steht beim leeren Feld auf dem heutigen Tag, und beim Drehen
rutscht die Jahreszahl mit.

Verschärfend: Beim Eintragen ist nirgends zu sehen, **wie lang** die Reise
wird. Die Zahl der Tage fällt erst im Planer auf.

# Erwartete Behebung

- Eine ungewöhnlich lange Reise wird beim Speichern **nicht stillschweigend
  angenommen**. Wo die Grenze liegt und ob der Hinweis blockiert oder nur
  warnt, entscheidet die Umsetzung — unbemerkt durchgehen darf es nicht.
- Beim Eintragen von Beginn und Ende ist **sichtbar, wie viele Tage** die
  Reise umfasst.
- Die bestehende Prüfung „Ende nicht vor Beginn" bleibt.

# Notes

Die betroffene Reise auf prod ist von Hand zu korrigieren — das ist Sache
einer Sitzung mit dem Betreiber, nicht des Workers (siehe
[devops.md](../../devops.md)).

Geprüft wird bei 375 px, 768 px und 1280 px (siehe
[stack.md](../../stack.md)).
