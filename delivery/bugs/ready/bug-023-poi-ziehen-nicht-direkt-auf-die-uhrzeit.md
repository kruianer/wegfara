---
id: bug-023
app: wegfara
req: req-039
priority: normal
created: 2026-09-06
---

# Observed

Das Verschieben eines POI auf den Zeitstrahl funktioniert grundsätzlich,
ist aber alles andere als intuitiv:

- Beim Draufbleiben mit dem Finger gibt es keine Rückmeldung, dass der
  POI gegriffen ist.
- Es sieht so aus, als müsse man den POI zuerst auf die Tagesansicht
  ziehen — sonst funktioniert es nicht.

# Expected

- Sobald ich mit dem Finger auf dem POI bleibe, ändert sich seine
  Rahmenfarbe: ich sehe, dass er gegriffen ist.
- Ich kann den POI in einem Zug direkt auf die gewünschte Uhrzeit im
  Zeitstrahl ziehen, ohne Zwischenschritt über die Tagesansicht.

# Steps

1. Planer auf dem iPad öffnen, Bereich Planung
2. Einen POI aus „Noch unverplant" mit dem Finger anfassen — keine
   sichtbare Rückmeldung
3. Ihn direkt auf eine Uhrzeit im Zeitstrahl ziehen
