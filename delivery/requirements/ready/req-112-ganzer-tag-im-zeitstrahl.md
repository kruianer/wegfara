---
id: req-112
title: Der Zeitstrahl der Planung zeigt den ganzen Tag, von 00:00 bis 24:00
app: wegfara
area: Planung
priority: normal
changes: req-011, req-076
created: 2026-11-20
---

# Goal (Why)

Das Raster des Zeitstrahls zeigt heute **8:00 bis 22:00**
(`DEFAULT_START_HOUR`, `DEFAULT_END_HOUR` in `lib/plan/timeline-grid.ts`)
und wächst nur, wenn ein **vorhandener** Programmpunkt darüber
hinausreicht:

```
startHour: Math.min(8, Math.ceil(earliestStart) - 1)
endHour:   Math.max(22, Math.floor(latestEnd) + 1)
```

Das ist ein blinder Fleck: **Was ausserhalb liegt, lässt sich nicht
anlegen.** Ein Flug um 6:00, ein Nachtzug um 23:30, ein Abendessen, das
bis 0:30 geht — für alles davon gibt es keine Rasterfläche, auf die man
ziehen oder klicken könnte. Das Raster wächst erst, *nachdem* der Punkt
existiert, und entstehen kann er nur dort, wo das Raster schon ist.

Eine Reise hat Stunden vor acht und nach zehn. Das Raster soll den Tag
zeigen, den es gibt, nicht den, den jemand für üblich hielt.

# Scope (What)

## Das Raster geht immer von 00:00 bis 24:00

`computeTimelineGrid` beginnt bei 0 und endet bei 24 — unabhängig davon,
ob und wann etwas geplant ist. Ein leerer Tag zeigt denselben Rahmen wie
ein voller.

**Über Mitternacht hinaus bleibt es, wie es ist:** Reicht ein
Programmpunkt in den Folgetag, geht `endHour` weiter über 24 hinaus
(`hoursSinceDayStart` rechnet dann +24). Sonst wäre ein Nachtzug
abgeschnitten — genau der Fall, um den es hier geht.

## Beim Öffnen rollt der Zeitstrahl zum Tag

Mit 24 Stunden wird das Raster bei Standard-Zoom **1152 px** hoch, bei
grösstem Zoom über 4000; sichtbar sind rund 600 bis 900 px. Es startet
heute immer am oberen Rand — das wäre künftig Mitternacht, also meist
eine leere Fläche.

Deshalb: Beim Öffnen eines Tages rollt der Zeitstrahl **auf den ersten
Programmpunkt**, mit etwas Luft darüber. Ein Tag ohne Programmpunkte
rollt auf den Morgen.

| Rasterhöhe | Zoom 24 | Zoom 48 | Zoom 176 |
| --- | ---: | ---: | ---: |
| heute (8–22) | 336 | 672 | 2464 |
| neu (0–24) | 576 | **1152** | 4224 |

Gerollt wird auch beim **Wechsel des Tages** — jeder Tag beginnt dort,
wo sein erster Punkt liegt. Nicht gerollt wird, während man zieht oder
eine Kante greift: Wer gerade arbeitet, soll die Fläche nicht unter dem
Zeiger verlieren.

## Was dadurch erst möglich wird

Ein Programmpunkt lässt sich zu jeder Tageszeit anlegen, indem man einen
POI auf die Stelle zieht (req-039) oder einen Punkt dorthin verschiebt
(req-040) — auch um 5:00 oder um 23:00. Das ist der eigentliche Gewinn;
die 24 Stunden sind nur das Mittel.

# Acceptance Criteria

- [ ] Gegeben ein Tag ohne Programmpunkte, wenn ich die Planung öffne,
      dann reicht das Raster von 00:00 bis 24:00.
- [ ] Gegeben ein Tag mit Punkten zwischen 9:00 und 17:00, dann reicht
      das Raster trotzdem von 00:00 bis 24:00.
- [ ] Gegeben das Raster, dann trägt jede Stunde von 00:00 bis 23:00
      ihre Beschriftung.
- [ ] Gegeben ein Programmpunkt, der bis 0:30 des Folgetages reicht,
      dann reicht das Raster über 24:00 hinaus und der Punkt ist ganz zu
      sehen.
- [ ] Gegeben ich ziehe einen POI auf 5:00, dann entsteht dort ein
      Programmpunkt (req-039).
- [ ] Gegeben ich ziehe einen Programmpunkt auf 23:00, dann liegt er
      danach dort (req-040).
- [ ] Gegeben ein Tag mit dem ersten Punkt um 9:00, wenn ich ihn öffne,
      dann ist dieser Punkt zu sehen — die Ansicht steht nicht bei
      00:00.
- [ ] Gegeben ein Tag ohne Punkte, wenn ich ihn öffne, dann ist der
      Morgen zu sehen.
- [ ] Gegeben ich wechsle von einem Tag auf einen anderen, dann rollt
      die Ansicht auf dessen ersten Punkt.
- [ ] Gegeben ich rolle nach oben, dann sind die Nachtstunden
      erreichbar.
- [ ] Gegeben ich ziehe einen Programmpunkt, dann rollt der Zeitstrahl
      **nicht** von selbst weg.
- [ ] Gegeben jede Zoomstufe (24 bis 176 px je Stunde), dann umfasst das
      Raster weiterhin den ganzen Tag und die Umrechnung von Zeit in
      Pixel stimmt (req-076).
- [ ] Gegeben die Bildschirmprüfung bei 1280 und 1920 px, dann ist sie
      grün.

# Constraints

- Der Stundenbereich wird an **einer** Stelle bestimmt
  (`computeTimelineGrid`). Dort stehen heute `DEFAULT_START_HOUR` und
  `DEFAULT_END_HOUR`; danach braucht es sie in dieser Form nicht mehr.
- Jede Stelle, die Zeit in Pixel umrechnet, bekommt das Raster mit und
  rechnet damit zwangsläufig mit denselben Zahlen (req-076,
  Constraints). Das bleibt so — keine zweite Rechnung.
- `endHour > 24` bleibt möglich und nötig (Punkte über Mitternacht).
- Das Rollen beim Öffnen ist eine Sache der Oberfläche, nicht des
  Rasters: `computeTimelineGrid` bleibt eine reine Funktion ohne
  Kenntnis der Ansicht.
- Beim Ziehen und beim Greifen einer Kante wird nicht gerollt
  (req-040, bug-022, bug-017).
- Die Zoomstufen bleiben unverändert (`ZOOM_STUFEN_PX`, req-076).

# Out of Scope

- Den Rasterbereich einstellbar zu machen (etwa „nur Tagstunden
  zeigen"). Erst der ganze Tag; ob jemand ihn einschränken will, zeigt
  sich.
- Die Nachtstunden anders einzufärben oder zusammenzufalten.
- Eine Linie für die aktuelle Uhrzeit im Planer. Die hat der Begleiter
  (`app/go/components/timeline.tsx`), der Planer nicht — ein eigenes
  Thema.
- Den Zeitstrahl des Begleiters. Er zeigt den Tag als Liste, nicht als
  Raster.
- Das Raster des gedruckten Plans (req-080, req-103).
