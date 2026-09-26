---
id: bug-059
app: wegfara
req: req-075
priority: normal
created: 2026-09-26
---

# Observed

In der Planungsansicht lassen sich Pfeile zwischen den Markern
einschalten (req-075) — auf der hellen Karte sind sie praktisch nicht
sichtbar.

# Expected

Die Pfeile sind auf der Karte deutlich zu sehen. Sie sind der Grund, die
Anzeige einzuschalten; eine Linie, die man suchen muss, erfüllt ihren
Zweck nicht.

# Steps

1. Planer öffnen, Bereich Planung
2. Mehrere POIs eines Tages verplanen
3. Die Pfeile einschalten
4. Auf die Karte sehen: die Pfeile heben sich kaum ab

# Ursache

Die Pfeilspitze nimmt die Akzentfarbe der App
([day-route-map.module.css](../../../app/plan/components/day-route-map.module.css),
Zeilen 133–135):

```
background: var(--acc);                        /* #d9c589 */
filter: drop-shadow(0 0 3px var(--glow));
```

`--acc` ist ein helles Sandgelb — gewählt für den **dunklen** Grund der
App (Farbwelt „Indigo-Nacht", req-015). Die Karte darunter ist aber hell.
Gemessen gegen einen typischen hellen Kartengrund (`#f2efe9`):

| Farbe | Kontrast |
|---|---|
| `--acc` `#d9c589` | **1,49 : 1** |
| ein dunkler Ton, z. B. `#2b2f45` | 11,5 : 1 |

1,49 : 1 ist praktisch kein Unterschied. Der Glow-Schatten verstärkt das
noch: Auf dunklem Grund hebt er hervor, auf hellem verwäscht er die Kante.

# Erwartete Behebung

Die Pfeile bekommen eine **dunkle** Farbe, die sich auf dem hellen
Kartengrund abhebt.

Welcher Ton, entscheidet die Umsetzung — er muss gegen den Kartengrund
mindestens **4,5 : 1** erreichen, besser mehr, weil unter den Pfeilen
Beschriftungen und Wege der Karte liegen.

Der Glow-Schatten gehört auf hellem Grund überprüft; er darf die Kante
nicht verwaschen.

# Notes

Mitzuprüfen ist, ob dieselbe Farbe auch die **Verbindungslinie** betrifft
(Zeile 106 verwendet ebenfalls `--acc`) — sie hat dasselbe Problem.

Die Marker selbst behalten ihre Statusfarben (req-013); es geht nur um
Pfeile und Linien.
