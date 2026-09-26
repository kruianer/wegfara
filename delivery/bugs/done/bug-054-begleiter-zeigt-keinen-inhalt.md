---
id: bug-054
app: wegfara
req: req-055
priority: hoch
created: 2026-09-26
---

# Observed

Der Begleiter (`/go`) zeigt keinen Inhalt an, obwohl die Reise
Programmpunkte hat.

Beobachtet auf prod mit der Reise „30 Johr zämma – Rothenburg".

# Expected

Der Begleiter zeigt den Tagesplan der vorausgewählten Reise — auch dann,
wenn die Reise noch **nicht freigegeben** ist und ihr Zeitraum **in der
Zukunft** liegt. Der Reiseleiter muss sehen können, was die Mitreisenden
später sehen werden.

# Steps

1. Als Reiseleiter im Planer die Seitenleiste öffnen
2. „Begleiter" wählen
3. Es erscheint kein Tagesplan

# Verifizierter Datenstand (prod, 26.09.2026)

Die Daten sind vollständig — es fehlt also nichts in der Datenbank:

```
Reise:  30 Johr zämma – Rothenburg
        25.10.2026 – 26.10.2026, Zustand in_planung
        6 Programmpunkte, alle am 25.10.:
          09:00 Dornbirn
          12:15 Café Martin
          15:00 Romantik Hotel & Restaurant Markusturm
          19:00 Gaststuben im Zunfthaus der Schiffleute
          19:00 HerR Restaurant
          21:30 Nachtwächter Tour

Reise:  KSB Weinreise 2027
        21.05.2027 – 28.05.2027, 0 Programmpunkte
```

Heute ist der **26.09.2026** — beide Reisen liegen in der Zukunft.

# Was als Ursache ausgeschlossen ist

- **Nicht der Zustand der Reise.** `listTripsForSession`
  ([trips.ts](../../../lib/db/trips.ts), Zeile 130) filtert **nicht** nach
  `freigegeben`. Eine Reise in `in_planung` erreicht den Begleiter.
- **Nicht der Zeitraum in der Zukunft.** `defaultDay`
  ([select-default.ts](../../../lib/trips/select-default.ts)) fällt auf den
  **Anreisetag** zurück, wenn heute außerhalb liegt:
  `if (todayIso >= trip.startDate && todayIso <= trip.endDate) return todayIso; return trip.startDate;`
- **Nicht die Reisewahl.** `defaultTripId` nimmt ohne aktive Reise die
  **nächste geplante** — das ist Rothenburg (25.10.2026 liegt vor
  21.05.2027).
- **Nicht fehlende Programmpunkte.** Sechs liegen auf dem Anreisetag.

Nach der Logik müsste der 25.10. mit sechs Programmpunkten erscheinen.
Wo es tatsächlich abbricht, ist damit noch offen — zu prüfen sind
`go-view.tsx` (Zeilen 115–190, insbesondere der frühe Ausstieg
`if (!selectedTrip || !selectedDate)` in Zeile 190) und die Frage, ob
`activities` überhaupt an den Begleiter gelangen.

# Notes

Zwei der sechs Programmpunkte („Gaststuben", „HerR Restaurant") liegen
beide 19:00–21:00 und bilden damit eine Options-Gruppe (req-004) — beim
Beheben ist mitzuprüfen, ob der Begleiter damit umgehen kann (vgl.
bug-053).

Geprüft wird bei 375 px, 768 px und 1280 px (siehe
[stack.md](../../stack.md)) — der Begleiter ist die Sicht für unterwegs.
