---
id: req-078
title: Seitenleiste und Zoom nachziehen
app: wegfara
area: Planung
priority: normal
created: 2026-09-26
---

# Goal (Why)

Zwei Nachbesserungen an dem, was gerade fertig geworden ist.

**Die Seitenleiste** (req-077) wirkt gedrängter als die von
LivingGardenTwin, an der sie sich ausrichtet. Gemessen sind Beschriftung
(13 px), Symbole (22 px) und Zeilenhöhe (44 px) bereits gleich — kleiner
sind der Slogan und die aufgeklappte Breite:

| | LGT | wegfara |
|---|---|---|
| Slogan | 21 px | 16 px |
| Aufgeklappt | 320 px | 256 px |

**Der Zoom** (req-076) reicht nicht weit genug. Die größte Stufe ist
96 px je Stunde, also 24 px je Viertelstunde — auf dem iPad immer noch
knapp, wenn ein Programmpunkt genau auf 10:15 soll.

# Function (What)

## Seitenleiste

- Der **Slogan** wird auf **21 px** vergrößert, wie bei LGT.
- Die **aufgeklappte Breite** wächst auf **320 px**.

Die übrigen Maße bleiben: Beschriftung 13 px, Symbole 22 px, Zeilenhöhe
44 px, eingeklappt 66 px.

Der Slogan steht weiterhin in **einer** Zeile und wird nicht
abgeschnitten — bei 320 px ist dafür mehr Platz als bisher.

## Zoom

Der Zeitstrahl lässt sich **weiter vergrößern** als heute. Die
Grundeinstellung (48 px je Stunde) bleibt, wo sie ist; es kommen Stufen
darüber hinzu.

Wie weit, entscheidet die Umsetzung — Maßstab ist, dass sich ein
Programmpunkt auf dem iPad **mit dem Finger** treffsicher auf eine
Viertelstunde setzen lässt. Die Trefferfläche einer Viertelstunde sollte
dafür die 44 px erreichen, die [stack.md](../../stack.md) für
Bedienelemente verlangt; das entspricht etwa 176 px je Stunde.

Beim Verkleinern bleibt es bei der heutigen kleinsten Stufe.

# Acceptance Criteria

- [x] Gegeben die Leiste ist aufgeklappt, wenn ich den Slogan ansehe,
      dann ist er so groß wie bei LGT (21 px) und steht in einer Zeile.
- [x] Gegeben die Leiste ist aufgeklappt, wenn ich sie ansehe, dann ist
      sie 320 px breit.
- [x] Gegeben die Leiste ist aufgeklappt, wenn ich die Beschriftungen
      ansehe, dann sind sie unverändert 13 px und die Symbole 22 px.
- [x] Gegeben die Leiste ist eingeklappt, wenn ich sie ansehe, dann ist
      sie unverändert schmal.
- [x] Gegeben ich vergrößere den Zeitstrahl bis zur größten Stufe, wenn
      ich eine Viertelstunde ansehe, dann ist sie mindestens 44 px hoch.
- [x] Gegeben der Zeitstrahl ist auf der größten Stufe, wenn ich einen POI
      auf 10:15 ziehe, dann liegt er auf 10:15.
- [x] Gegeben ich verkleinere bis zur kleinsten Stufe, wenn ich hinsehe,
      dann ist sie dieselbe wie bisher.
- [x] Gegeben ich zoome auf eine der neuen Stufen, wenn ich einen
      Programmpunkt verschiebe, dann rastet er weiterhin auf 15 Minuten
      ein (req-039, req-040).
- [x] Gegeben ich zoome auf eine der neuen Stufen, wenn Programmpunkte
      sich überlappen, dann teilen sie sich weiterhin die Breite
      (req-039).
- [x] Gegeben der Planer ist auf 375 px, 768 px und 1280 px zu sehen, wenn
      ich die aufgeklappte Leiste ansehe, dann bleibt der Inhalt daneben
      benutzbar (siehe [stack.md](../../stack.md)).

# Constraints

- Die Zoom-Stufen stehen an einer Stelle
  ([timeline-zoom.ts](../../../lib/plan/timeline-zoom.ts),
  `ZOOM_STUFEN_PX`); es kommt keine zweite Liste daneben.
- Die Stundenhöhe bleibt am Raster und wird über `gridHourHeightPx`
  gelesen — jede Umrechnung von Pixel in Zeit nimmt denselben Wert
  (req-076, Constraints).
- Bei 320 px aufgeklappter Breite darf der Inhalt daneben auf 768 px nicht
  unbrauchbar werden. Die Leiste liegt **über** der Seite (req-077), schiebt
  also nichts weg — zu prüfen ist, was sie verdeckt.
- Der Slogan bleibt bei `--acc-text` und nicht bei einer der leisen
  Textstufen (vgl. bug-051).

# Out of Scope

- Ein feineres Raster als 15 Minuten.
- Weitere Maße der Leiste an LGT anpassen, die schon gleich sind.
- Eine Uhr in der Leiste.
- Zoom im Begleiter (`/go`).
