---
id: bug-052
app: wegfara
req: req-060
priority: normal
created: 2026-09-25
---

# Observed

Im Planer, Bereich POIs: Ich setze einen Filter (Typ, Status oder
Sortierung), wechsle den Bereich und komme zurück — **alle Filter sind
weg**.

Dasselbe passiert schon, wenn ich nur kurz auf eine andere App wechsle
und wieder zurückkomme.

# Expected

Die gesetzten Filter bleiben bestehen:

- beim Wechsel zwischen den Bereichen des Planers und zurück
- beim Wechsel zu einer anderen App und zurück

Zurückgesetzt werden dürfen sie:

- beim Neustart der App
- beim Wechsel der Reise

# Steps

1. Planer öffnen, Bereich POIs
2. Einen Statusfilter setzen, z. B. „Gesetzt"
3. In den Bereich Planung wechseln
4. Zurück in den Bereich POIs
5. Der Filter steht wieder auf „alle"

# Ursache

Filter und Sortierung liegen als lokaler Zustand in der Komponente
([poi-list.tsx](../../../app/plan/components/poi-list.tsx), Zeilen
157–160):

```
const [typeFilter, setTypeFilter] = useState<PoiTypeFilter>("alle");
const [statusFilter, setStatusFilter] = useState<PoiStatusFilter>("alle");
const [sortierung, setSortierung] = useState<PoiSortierung>(...);
```

Beim Bereichswechsel wird die Komponente ausgehängt; mit ihr verschwindet
ihr Zustand, und beim Zurückkommen startet sie wieder auf den Vorgabewerten.

Dass es auch beim kurzen Wechsel in eine andere App passiert, deutet
darauf hin, dass die Ansicht dabei ebenfalls neu aufgebaut wird.

Der Zustand muss die Komponente überdauern — je Reise, damit ein
Reisewechsel ihn wie gewünscht zurücksetzt.

# Notes

Betrifft alle drei Einstellungen der Liste gemeinsam: Typfilter (req-010),
Statusfilter und Sortierung (req-060).

Die Statusauswahl der **Karte** (req-013) ist davon zu unterscheiden —
ob sie dasselbe Problem hat, ist beim Beheben mitzuprüfen.
