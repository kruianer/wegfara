---
id: req-111
title: Teaserbild und Typ am Programmpunkt im Zeitstrahl
app: wegfara
area: Planung
priority: normal
changes: req-011, req-074, req-105
created: 2026-11-16
---

# Goal (Why)

Ein verplanter POI steht im Zeitstrahl als Block mit Nummer, Titel,
Uhrzeit und Typ — **ohne Bild**. In der POI-Liste hat derselbe Ort ein
Teaserbild (req-097), auf dem man ihn wiedererkennt; im Plan ist er auf
seinen Namen zurückgeworfen.

Wer eine Reise plant, erkennt einen Ort am Bild schneller als am Namen.
Gerade beim Umplanen, wo mehrere Blöcke nebeneinander liegen, wäre das
der Unterschied zwischen Lesen und Sehen.

# Scope (What)

## Das Bild links im Block

Links im Block steht das erste Foto des POI, aus dem der Programmpunkt
entstanden ist. **In fester Breite**, über die ganze Blockhöhe:

```
60 min, 48 px hoch:
┌──────┬──────────────────────────┐
│ BILD │ 12 Guggenheim-Museum     │
│      │ 09:00–10:00 · Museum     │
└──────┴──────────────────────────┘

15 min, 24 px hoch:
┌──────┬──────────────────────────┐
│ BILD │ 12 Kaffeepause           │
└──────┴──────────────────────────┘
  ↑ senkrechter Ausschnitt aus der Bildmitte
```

Die feste Breite ist Absicht: Der Titel beginnt in jedem Block an
derselben Stelle, die Spalte bleibt ruhig. Ist der Block flach, wird das
Bild zu einem **waagerechten Streifen aus seiner Mitte** (`object-fit:
cover`, `object-position: center`) — nie gestaucht, nie verzerrt.

**Geladen wird die Miniatur** (`poiMiniaturUrl`, req-105), nie das
Original: ein Block ist kleiner als die POI-Liste, und im Plan stehen
viele auf einmal.

## Wann es entfällt

**Ohne Foto** steht links nichts — kein Platzhalter, kein grauer Kasten.
Der Titel nimmt dann die ganze Breite. Dasselbe bei einem von Hand
angelegten Programmpunkt: Er hat keinen POI (`poiId` ist dort leer) und
damit kein Bild.

**Bei einem zu schmalen Block** entfällt es ebenfalls. Liegen
Programmpunkte gleichzeitig, teilen sie sich die Breite in Spuren
(`laneStyle`): bei heutiger Spaltenbreite 408 px in einer Spur, 202 bei
zwei, **133 bei drei**. Unter einer Grenze braucht der Titel den Platz
dringender als das Bild.

Die Grenze wird am **gemessenen Block** entschieden, nicht an der Zahl
der Spuren: Seit req-109 lässt sich die Spalte breiter ziehen, dann
passt auch bei drei Spuren noch ein Bild.

## Der Typ als Zeichen auf dem Bild

Auf dem Bild — wie in der POI-Liste, wo Nummer und Typ auf dem Teaser
liegen (req-097) — steht der Typ des Programmpunkts in seiner Farbe
(`ACTIVITY_TYPE_COLOR`), auf leicht durchscheinendem Grund.

**Er entfällt, wenn der Block zu flach ist.** Ab welcher Höhe er passt,
ergibt sich aus seiner Schriftgrösse; darunter bleibt das Bild allein.
Die Uhrzeit-Zeile trägt den Typ heute schon als Text
(`ACTIVITY_TYPE_LABEL`) — ist sie zu sehen, genügt sie, und das Zeichen
ist eine Zugabe für den Blick, keine zweite Quelle.

**Es ist der Typ des Programmpunkts, nicht der des POI.** Die beiden
sind verschieden (`ACTIVITY_TYPE` gegen `POI_TYPE`): Ein Museum kann als
„Besichtigung" geplant sein. Im Zeitstrahl gilt, was geplant ist.

## Was bleibt, wie es ist

- **Die POI-Nummer** steht weiter vor dem Titel (req-074) und bleibt
  auch im flachsten Block ganz lesbar. Dafür gibt es `min-height: 24px`
  am Block, mit genau dieser Begründung — die Zahl darf nie
  angeschnitten sein.
- **Die Rahmenfarbe** des Blocks bleibt die Typfarbe. Sie ist die
  Zuordnung, die auf den ersten Blick trägt.
- **Das Ziehen und die Kanten** bleiben unberührt: Verschieben (req-040),
  Beginn und Ende ziehen (bug-022), mit dem Finger (bug-017). Das Bild
  ist **kein Griff** und fängt keinen Zug ab.
- Die Optionszeilen (zeitgleiche Alternativen, req-004) bleiben in
  diesem Requirement unverändert.

# Acceptance Criteria

- [ ] Gegeben ein verplanter POI mit Foto, wenn ich den Zeitstrahl
      ansehe, dann steht links im Block sein Teaserbild.
- [ ] Gegeben dieses Bild, wenn ich die geladene Adresse ansehe, dann
      ist es die **Miniatur** (req-105) und nicht das Original.
- [ ] Gegeben zwei Blöcke verschiedener Höhe, dann ist das Bild in
      beiden **gleich breit** und der Titel beginnt an derselben Stelle.
- [ ] Gegeben ein flacher Block von 24 px, dann zeigt das Bild einen
      waagerechten Ausschnitt aus seiner Mitte — nicht gestaucht.
- [ ] Gegeben ein POI ohne Foto, dann steht links **nichts** und der
      Titel nimmt die ganze Breite.
- [ ] Gegeben ein von Hand angelegter Programmpunkt, dann hat er kein
      Bild — und keinen Platzhalter.
- [ ] Gegeben drei gleichzeitige Programmpunkte bei heutiger
      Spaltenbreite, dann entfällt das Bild und der Titel nimmt den
      Platz.
- [ ] Gegeben dieselben drei, wenn ich die Spalte breit genug ziehe
      (req-109), dann erscheint das Bild wieder.
- [ ] Gegeben ein Block, der hoch genug ist, dann steht der Typ als
      Zeichen auf dem Bild, in seiner Farbe.
- [ ] Gegeben ein flacher Block, dann entfällt das Zeichen und das Bild
      bleibt allein.
- [ ] Gegeben ein Museum, das als „Besichtigung" geplant ist, dann nennt
      das Zeichen **Besichtigung** — den Typ des Programmpunkts.
- [ ] Gegeben der flachste Block, dann ist seine POI-Nummer ganz lesbar
      (req-074) — das Bild schneidet sie nicht an.
- [ ] Gegeben ein Block mit Bild, wenn ich ihn verschiebe, dann geht das
      wie bisher (req-040) — auch wenn ich ihn am Bild anfasse.
- [ ] Gegeben ein Block mit Bild, wenn ich seine obere oder untere Kante
      ziehe, dann geht das wie bisher (bug-022).
- [ ] Gegeben eine Vorlesehilfe liest den Block, dann sagt sie nicht
      zweimal denselben Typ.
- [ ] Gegeben die Bildschirmprüfung bei 1280 und 1920 px, dann ist sie
      grün und kein Block ragt über die Spalte (stack.md, Regel 1).

# Constraints

- **Die Miniatur, nie das Original** (req-105). Im Plan stehen viele
  Blöcke auf einmal.
- Die feste Bildbreite und die beiden Grenzen (Mindesthöhe für das
  Zeichen, Mindestbreite für das Bild) stehen als Token an **einer**
  Stelle in `lib/design/stil.ts` — nicht als Zahl im Stylesheet und in
  der Komponente (wie `POI_AUSWAHL_BREITE_PX` schon).
- Entschieden wird am **gemessenen Block**, nicht an der Zahl der Spuren
  oder der Dauer: Die Spaltenbreite ändert sich beim Ziehen (req-109),
  die Blockhöhe beim Zoomen (`ZOOM_STUFEN_PX` von 24 bis 176 px je
  Stunde).
- `min-height: 24px` am Block bleibt und behält seine Begründung: Die
  POI-Nummer darf nie angeschnitten sein (req-074).
- Das Bild ist **kein Griff**: Es darf keinen Zug und keinen Klick
  abfangen, der heute den Block trifft (req-040, bug-017, bug-022).
- Die Fotos kommen als Zuordnung von POI-Kennung zu Bild in die
  Komponente, nach dem Muster von `poiNummernNachId` (req-074) — der
  Zeitstrahl fragt sie nicht selbst ab.
- Es ist der Typ des **Programmpunkts** (`ACTIVITY_TYPE_COLOR`,
  `ACTIVITY_TYPE_LABEL`), nie der des POI.

# Out of Scope

- Das Bild in den Optionszeilen zeitgleicher Alternativen (req-004).
  Erst der Block.
- Das Bild am Transfer-Block. Ein Transfer hat keinen POI.
- Das Bild im Begleiter-Zeitstrahl. Dort hat die Kachel es schon
  (req-079).
- Ein Platzhalterbild für POIs ohne Foto.
- Das Bild im gedruckten Plan (req-080, req-103).
- Mehrere Fotos im Block oder ein Wechsel zwischen ihnen.
- Die POI-Nummer, den Titel oder die Uhrzeit-Zeile umzubauen.
