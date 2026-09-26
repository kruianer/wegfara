---
id: bug-053
app: wegfara
req: req-004
priority: hoch
created: 2026-09-25
---

# Observed

Plane ich zwei POIs auf dieselbe Zeit, überlappen sie sich im Zeitstrahl
**vollständig**: Die Titel stehen übereinander, und es ist nicht zu
erkennen, dass es zwei Programmpunkte sind.

# Expected

Eine Options-Gruppe ist als solche erkennbar. Ich sehe:

- dass an dieser Stelle **mehrere Alternativen** liegen und wie viele
- **welche** Alternativen es sind — nicht nur die erste
- **welche** davon gerade gewählt ist

Und ich kann zwischen ihnen wechseln, ohne die Zeiten zu ändern.

# Steps

1. Planer öffnen, Bereich Planung
2. Einen POI auf 10:00–12:00 ziehen
3. Einen zweiten POI auf dieselbe Zeit 10:00–12:00 ziehen
4. Im Zeitstrahl steht scheinbar ein Block; die Titel liegen übereinander

# Ursache

Zwei Programmpunkte mit **exakt gleichem Beginn und Ende** werden zu einer
Options-Gruppe zusammengefasst
([groups.ts](../../../lib/activities/groups.ts)) — das ist so gewollt
(req-004: Alternativen zur Auswahl).

Falsch ist nur die Darstellung. In
[timeline-column.tsx](../../../app/plan/components/timeline-column.tsx)
(Zeile 137) reduziert `resolveGroupActivity` die Gruppe auf **einen**
Programmpunkt:

```
const selectedId = optionSelections[groupKey(group)] ?? group.activities[0].id;
return group.activities.find((a) => a.id === selectedId) ?? group.activities[0];
```

Gezeichnet wird dann nur dieser eine Block. Dass weitere Alternativen
darunter liegen, ist nirgends zu sehen: In
`timeline-column.module.css` gibt es **keine einzige** Regel für Gruppen.

`assignLanes` (req-039) hilft hier nicht — es teilt die Breite nur
zwischen verschiedenen Blöcken auf, und die Gruppe zählt als einer.

Die Auswahl (`optionSelections`) existiert im Datenmodell und wird an die
Tagesroute durchgereicht, aber im Zeitstrahl gibt es keine Bedienung, um
sie zu ändern.

# Erwartete Behebung

- Eine Options-Gruppe ist im Zeitstrahl **auf einen Blick** von einem
  einzelnen Programmpunkt zu unterscheiden.
- Die Zahl der Alternativen ist ablesbar.
- Die gewählte Alternative ist erkennbar, und es lässt sich zu einer
  anderen wechseln.
- Wie das aussieht, entscheidet die Umsetzung — Titel dürfen dabei nicht
  übereinander liegen.

# Notes

Zu unterscheiden von teilweiser Überlappung: Zwei Punkte von 10:00–12:00
und 11:00–13:00 sind **keine** Gruppe und teilen sich bereits korrekt die
Breite (req-039). Nur exakt gleiche Zeiten werden gruppiert.

Beim Beheben ist mitzuprüfen, ob req-074 (POI-Nummer im Zeitstrahl) davon
berührt ist: Eine Gruppe vereint mehrere POIs mit je eigener Nummer.

Geprüft wird bei 375 px, 768 px und 1280 px (siehe
[stack.md](../../stack.md)).
