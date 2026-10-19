---
id: req-082
title: Feines Raster auf dem Zeitstrahl
app: wegfara
area: Planung
priority: normal
created: 2026-10-19
---

# Goal (Why)

Als Reiseleiter plane ich einen Tag und stoße an das 15-Minuten-Raster:
Die Führung beginnt um 10:05, das Restaurant hat um 19:20 reserviert, der
Zug fährt 14:35. Solche Zeiten lassen sich heute nicht eintragen — ich
runde auf die Viertelstunde und die Planung stimmt nicht mehr mit der
Wirklichkeit.

Das Raster ist für den Alltag richtig: Es hält den Plan aufgeräumt und
macht das Ziehen treffsicher. Was fehlt, ist die Möglichkeit, für die
Feinarbeit darauf zu verzichten.

# Function (What)

## Der Umschalter

Im Zeitstrahl des Planers lässt sich zwischen zwei Rastern wählen:

- **15 Minuten** — die Vorgabe, wie heute
- **5 Minuten** — für die Feinarbeit

Der Umschalter sitzt dort, wo auch der Zoom bedient wird (req-076,
req-078). Das gewählte Raster ist sichtbar, ohne dass man es ausprobieren
muss.

Es überdauert den Wechsel des Reisetags. Beim Neustart der App und beim
Wechsel der Reise darf es auf 15 Minuten zurückfallen — wie der Zoom
(bug-052).

## Was das Raster bestimmt

Im gewählten Raster rasten ein:

- die **Startzeit** eines Programmpunkts beim Ziehen in den Zeitstrahl
- die **Startzeit** beim Verschieben eines liegenden Programmpunkts
- die **Dauer** beim Ziehen an seiner Kante
- die **Dauer** eines POI im Formular (req-058)

Ein Programmpunkt, der im feinen Raster auf 10:05 gelegt wurde, **behält
diese Zeit**, wenn später auf 15 Minuten zurückgeschaltet wird. Das Raster
gilt für neue Eingaben, es rechnet Bestehendes nicht um.

## Weitere Zoomstufen

Der Zeitstrahl lässt sich **zwei bis drei Stufen weiter vergrößern** als
heute, damit das feine Raster auch mit dem Finger bedienbar ist.

Maßstab wie in req-078: Eine Rastereinheit soll die **44 px** erreichen,
die [stack.md](../../stack.md) für Bedienelemente verlangt. Bei fünf
Minuten entspricht das etwa **528 px je Stunde** — die heutige größte
Stufe von 176 px gibt einer Fünf-Minuten-Einheit nur knapp 15 px.

Welche Stufen genau dazukommen, entscheidet die Umsetzung. Die kleinste
Stufe bleibt, wie sie ist.

# Acceptance Criteria

- [x] Gegeben ich öffne die Planung, wenn ich den Umschalter ansehe, dann
      steht er auf 15 Minuten.
- [ ] Gegeben ich schalte auf 5 Minuten, wenn ich einen POI auf 10:05
      ziehe, dann liegt er auf 10:05.
- [ ] Gegeben das Raster steht auf 15 Minuten, wenn ich einen POI auf
      10:05 ziehe, dann liegt er auf 10:00 — wie heute.
- [ ] Gegeben das Raster steht auf 5 Minuten, wenn ich einen liegenden
      Programmpunkt verschiebe, dann rastet er auf 5 Minuten ein.
- [ ] Gegeben das Raster steht auf 5 Minuten, wenn ich an der Kante eines
      Programmpunkts ziehe, dann ändert sich seine Dauer in
      5-Minuten-Schritten.
- [ ] Gegeben das Raster steht auf 5 Minuten, wenn ich im POI-Formular
      eine Dauer von 35 Minuten eintrage, dann wird sie angenommen.
- [ ] Gegeben das Raster steht auf 15 Minuten, wenn ich im POI-Formular
      35 Minuten eintrage, dann wird das abgewiesen — wie heute.
- [ ] Gegeben ein Programmpunkt liegt auf 10:05, wenn ich auf 15 Minuten
      zurückschalte, dann liegt er weiterhin auf 10:05.
- [ ] Gegeben ich habe das Raster umgeschaltet, wenn ich den Reisetag
      wechsle und zurückkomme, dann gilt dasselbe Raster.
- [ ] Gegeben ich vergrößere bis zur größten Stufe, wenn das Raster auf 5
      Minuten steht, dann ist eine Rastereinheit mindestens 44 px hoch.
- [ ] Gegeben der Zeitstrahl ist auf der größten Stufe, wenn ich einen POI
      auf 10:05 ziehe, dann liegt er auf 10:05 und nicht auf 10:00 oder
      10:10.
- [ ] Gegeben ich verkleinere bis zur kleinsten Stufe, wenn ich hinsehe,
      dann ist sie dieselbe wie bisher.
- [ ] Gegeben Programmpunkte überlappen sich, wenn ich Raster oder Zoom
      ändere, dann teilen sie sich weiterhin die Breite (req-039).
- [ ] Gegeben ein Transfer liegt zwischen zwei Programmpunkten, wenn ich
      auf 5 Minuten schalte, dann stimmt sein Zeitpuffer weiterhin
      (req-073).
- [ ] Gegeben ich bediene den Umschalter auf dem iPad, wenn ich ihn
      antippe, dann ist seine Trefferfläche mindestens 44 × 44 px.
- [ ] Gegeben die Planung ist auf 375 px, 768 px und 1280 px zu sehen,
      wenn ich Umschalter und Zoom bediene, dann sind sie auf allen
      dreien erreichbar (siehe [stack.md](../../stack.md)).

# Constraints

- **Das Raster steht an einer Stelle.** Heute ist es dreifach getrennt
  festgeschrieben:
  `SNAP_MINUTES = 15` in
  [move-activity.ts](../../../lib/plan/move-activity.ts) (Zeile 22),
  `SNAP_MINUTES = 15` in
  [plan-poi.ts](../../../lib/plan/plan-poi.ts) (Zeile 17) und
  `RASTER_MINUTEN = 15` in
  [tagesplan.ts](../../../lib/plan/tagesplan.ts) (Zeile 34). Dazu
  `DURATION_STEP_MINUTES = 15` in
  [estimated-duration.ts](../../../lib/pois/estimated-duration.ts).
  Drei Kopien und ein Umschalter ergeben Zustände, die nicht
  zusammenpassen.
- **Die Stundenhöhe bleibt am Raster** und wird über `gridHourHeightPx`
  gelesen (req-076): Jede Umrechnung von Pixel in Zeit nimmt denselben
  Wert. Sonst landet ein gezogener POI auf einer anderen Zeit als der, auf
  die er gezogen wurde.
- **Keine Migration nötig.** Die Datenbank prüft nur `duration_min > 0`
  (`poi_duration_min_valid`, geprüft am 19.10.2026); das 15er-Raster
  steckt allein in der Anwendung.
- `MIN_DURATION_MINUTES` (heute 15) ist beim feinen Raster mitzuprüfen:
  Eine Mindestdauer von 15 Minuten widerspricht 5-Minuten-Schritten
  nicht, muss aber bewusst entschieden sein.
- Die Zoomstufen stehen weiterhin an einer Stelle
  ([timeline-zoom.ts](../../../lib/plan/timeline-zoom.ts),
  `ZOOM_STUFEN_PX`).
- Die geschätzten Dauern je POI-Typ (req-011) bleiben Vielfache von 15
  Minuten — sie sind Schätzungen, keine Feinarbeit.

# Out of Scope

- Ein Raster feiner als 5 Minuten, oder ein frei wählbares.
- Das Raster im Begleiter (`/go`).
- Bestehende Programmpunkte auf ein neues Raster umrechnen.
- Das Raster je Reise oder je Account merken.
- Die KI-Planung (req-057) auf das feine Raster umstellen — sie plant
  weiterhin in Viertelstunden.
