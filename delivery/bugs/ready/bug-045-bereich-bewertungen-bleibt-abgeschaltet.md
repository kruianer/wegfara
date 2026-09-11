---
id: bug-045
app: wegfara
req: req-054
priority: high
created: 2026-09-11
---

# Observed

Im Planer bleibt der Menüpunkt „Bewertungen" deaktiviert — auch wenn eine
Bewertungsrunde läuft.

# Expected

Der Bereich lässt sich öffnen und zeigt die laufende Runde: über welche
POIs abgestimmt wird, wie die Stimmen stehen und wer noch nicht gestimmt
hat. Von dort aus lässt sich die Runde beenden.

# Befund

`lib/plan/areas.ts` führt „bewertungen" zwar in `PLAN_AREAS` auf, aber
**nicht** in `SWITCHABLE_PLAN_AREAS`:

    export const SWITCHABLE_PLAN_AREAS: PlanAreaId[] = [
      "pois", "planung", "dokumente", "reisedetails",
    ];

`isSwitchablePlanArea()` liefert dafür also `false` — der Punkt ist
sichtbar, aber dauerhaft abgeschaltet. Es liegt nicht an der Runde.

**Der Bereich wurde nie gebaut**, obwohl req-054 als erledigt gilt. Was
existiert: das Abstimmen im Begleiter
(`app/go/components/bewertungsrunde.tsx`), die Verteilung an der POI-Zeile
(`app/plan/components/poi-bewertung.tsx`) und das Starten aus der
POI-Liste. Was fehlt: der eigene Bereich im Planer, der die Runde als
Ganzes zeigt.

Gleiches gilt für „kosten" — dort ist es aber gewollt, req-062 baut ihn
gerade.

# Steps

1. Planer öffnen, im Bereich POIs eine Bewertungsrunde starten
2. Im Kopfbereich „Bewertungen" wählen
3. Der Punkt ist deaktiviert
