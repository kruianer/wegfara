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

# Nachtrag (2026-09-11)

Was der Bereich zeigen soll, steht inzwischen ausgearbeitet in **req-063**
— Stand der Runde je POI, sortiert nach Zustimmung, mit Status setzen und
Runde beenden.

Dieser Bug bleibt trotzdem stehen: Er ist der kleine Schritt, der den
Bereich überhaupt erreichbar macht. Wird req-063 zuerst gebaut, erledigt
es ihn mit — dann kann er ohne eigene Arbeit geschlossen werden.

# Behebung

Genau dieser Fall ist eingetreten: **req-063 wurde vor diesem Bug gebaut
und hat ihn mit erledigt.** Nachgeprüft am 2026-09-11, ohne weitere
Änderung am Quelltext.

- `lib/plan/areas.ts` führt „bewertungen" seit req-063 auch in
  `SWITCHABLE_PLAN_AREAS` — damit liefert `isSwitchablePlanArea()` dafür
  `true`, der Menüpunkt ist bedienbar, und `planAreaFromParam()` öffnet
  den Bereich auch aus der Adresse (`?bereich=bewertungen`, bug-033).
  Abgeschaltet ist jetzt kein Bereich mehr; die Unterscheidung bleibt
  für den nächsten neuen stehen.
- `app/plan/components/bewertungen-view.tsx` ist der Bereich, der bis
  dahin fehlte. Er zeigt die anzuzeigende Runde mit „Runde läuft" bzw.
  „Runde beendet", je POI eine Zeile mit Name und Status, die Stimmen je
  Stufe, die noch offenen und die Zustimmung — sortiert nach Zustimmung,
  die höchste oben. Aufgeklappt steht in der Zeile, wer wie gestimmt hat
  und wer noch nicht gestimmt hat. „Runde beenden" steht im Kopf des
  Bereichs, bei laufender Runde und nur für den Reiseleiter (serverseitig
  geprüft in `lib/db/rating-rounds.ts`).
- `app/plan/plan-view.tsx` schaltet bei `activeArea === "bewertungen"`
  auf diesen Bereich um.

Damit ist die Erwartung dieses Bugs vollständig gedeckt: Der Bereich
lässt sich öffnen, zeigt über welche POIs abgestimmt wird, wie die
Stimmen stehen und wer noch nicht gestimmt hat, und die Runde lässt sich
von dort beenden.

Die Anmerkung zu „kosten" aus dem Befund ist ebenfalls überholt:
req-062 hat den Bereich inzwischen gebaut.

# Prüfung

Tests, die ohne die Behebung fehlschlagen, liegen aus req-063 vor:

- `lib/plan/areas.test.ts` — „hat seit req-063 alle sechs Bereiche
  bedienbar", `isSwitchablePlanArea("bewertungen")` ist `true`, und
  „öffnet den Bereich Bewertungen, seit es ihn gibt (req-063)" für den
  Weg über die Adresse. Genau diese Erwartungen scheitern, sobald
  „bewertungen" wieder aus `SWITCHABLE_PLAN_AREAS` fällt — der Zustand
  dieses Bugs.
- `app/plan/plan-view.test.tsx` — „öffnet beim Klick auf ‚Bewertungen'
  den Bereich (req-063)" (der Menüpunkt ist bedienbar und zeigt den
  Bereich), „öffnet den Bereich Bewertungen aus der Adresse (req-063)"
  und der Block „PlanView -- Bereich Bewertungen (req-063)" mit dem
  Stand der Runde bis zum Beenden.
- `app/plan/components/bewertungen-view.test.tsx` und
  `app/plan/components/bewertungen-view.layout.test.ts` — Inhalt des
  Bereichs und seine Darstellung bei 375, 768 und 1280 px.

Volle Suite grün: 3649 Unit-Tests in 304 Dateien, dazu Lint, Prettier
und `tsc --noEmit`. Kein Quelltext geändert — dieser Bug wird allein
geschlossen.
