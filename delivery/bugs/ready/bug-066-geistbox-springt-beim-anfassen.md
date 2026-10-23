---
id: bug-066
app: wegfara
req: req-040
priority: normal
created: 2026-10-23
---

# Observed

Fasse ich im Zeitstrahl einen Programmpunkt an, um ihn zu verschieben,
springt die Vorschau („Geistbox") sofort — und zwar um so weiter, je
tiefer unten im Block ich ihn gegriffen habe.

# Expected

Im Augenblick des Anfassens liegt die Vorschau **deckungsgleich** über dem
bestehenden Block, unabhängig davon, wo ich ihn gegriffen habe. Erst wenn
ich den Zeiger bewege, wandert sie mit — und behält dabei den Abstand zum
Greifpunkt.

Das Verschieben soll sich anfühlen wie das Verschieben eines Blattes auf
dem Tisch: Es folgt der Hand, aber es springt nicht unter ihr weg.

# Steps

1. Planer öffnen, Bereich Planung
2. Einen liegenden Programmpunkt am **unteren** Rand anfassen und die
   Maustaste halten
3. Die Vorschau sitzt sofort deutlich tiefer als der Block selbst
4. Zum Vergleich in der Mitte anfassen: der Sprung ist halb so groß

# Ursache

Die Vorschau rechnet mit der **Zeigerposition im Raster**, nicht mit der
Oberkante des gezogenen Blocks.

In [drag-preview.ts](../../../lib/plan/drag-preview.ts) (Zeile 76):

```
const start = snapStartMinutes(minutesAtOffset(offsetPx, grid), raster);
```

`offsetPx` kommt aus
[timeline-column.tsx](../../../app/plan/components/timeline-column.tsx)
(Zeile 678):

```
return event.clientY - event.currentTarget.getBoundingClientRect().top;
```

Das ist der Abstand des Zeigers zur Oberkante des **Rasters**. Wo
innerhalb des Blocks gegriffen wurde, wird nirgends erfasst — der Beginn
der Vorschau landet also dort, wo der Zeiger steht, statt dort, wo der
Block anfängt.

Beim Ziehen eines POI aus der Auswahl ist dieses Verhalten richtig: Dort
gibt es keinen bestehenden Block, der Zeiger **ist** der Beginn. Nur beim
Verschieben eines liegenden Programmpunkts ist es falsch.

# Erwartete Behebung

Beim Anfassen wird der Abstand zwischen Zeiger und Oberkante des Blocks
festgehalten und von der Rechnung abgezogen. Dann gilt:

- Im Augenblick des Anfassens: Vorschau deckungsgleich mit dem Block.
- Beim Bewegen: Die Vorschau folgt dem Zeiger und behält den Greifabstand.
- Das Einrasten bleibt, wie es ist (15 oder 5 Minuten, req-082).

Für das Ziehen eines POI aus der Auswahl (`drag.kind === "poi"`) bleibt
alles unverändert — dort ist der Zeiger zu Recht der Beginn.

Dasselbe gilt für den Finger auf dem iPad (`pointerdown`/`pointerup`,
bug-017): Auch dort soll nichts springen.

# Notes

Das Ziehen an den **Kanten** (`resize-start`, `resize-end`) ist nicht
betroffen — dort ist der Zeiger die gezogene Kante, und das ist richtig.

Geprüft wird bei 375 px, 768 px und 1280 px (siehe
[stack.md](../../stack.md)), mit Maus und mit Finger.
