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

| Farbe                            | Kontrast     |
| -------------------------------- | ------------ |
| `--acc` `#d9c589`                | **1,49 : 1** |
| ein dunkler Ton, z. B. `#2b2f45` | 11,5 : 1     |

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

# Behebung

Pfeile und Linien liegen in einem dunklen Indigo, `#1f2547`. Es steht als
Domänenwert in [routenfarbe.ts](../../../lib/map/routenfarbe.ts) und nicht
mehr in einer Variablen der Oberfläche — dieselbe Überlegung wie beim
Suchgebiet (bug-030), nur in die andere Richtung: die Kartenkacheln sind
hell, der Akzent des Planers gehört dem dunklen Grund der App.

Gemessen gegen die Flächen, auf denen ein Weg liegen kann
([kontrast.ts](../../../lib/design/kontrast.ts)):

| Fläche      | vorher (`--acc`) | jetzt (`#1f2547`) |
| ----------- | ---------------- | ----------------- |
| Kartengrund | 1,49 : 1         | **12,94 : 1**     |
| Wasser      | 1,06 : 1         | 9,26 : 1          |
| Wald        | 1,31 : 1         | 11,39 : 1         |
| Bebauung    | 1,12 : 1         | 9,77 : 1          |
| Straße      | 1,71 : 1         | 14,85 : 1         |

Die Linien werden deckend gezeichnet. Die 0,8 bzw. 0,9 davor sollten sie
auf dunklem Grund dämpfen und nahmen ihnen auf hellem einen Teil des
Kontrasts (bei 0,8 blieben von 12,94 : 1 nur 7,20 : 1).

Der Glow ist weg. Statt seiner setzt eine Kontur von einem Pixel Weiß
(14,85 : 1 gegen die Pfeilfarbe) die Spitze scharf gegen die Karte ab — und
gegen die Linie, auf der sie in derselben Farbe liegt. Der Glow lief 3 px
weit und ließ die Kante auf hellem Grund ausfransen.

Die Farbe steht an einer Stelle: `day-route-map.tsx` gibt sie den
Kartenebenen mit und setzt sie als `--route` an die Kartenspalte, von wo das
Stylesheet die Pfeilspitze färbt — so wie `poi-map.tsx` es mit
`--suchgebiet` tut. Die Marker sind unberührt.

Repro-first: zehn Tests waren ohne den Fix rot — sechs in
[day-route-map.test.tsx](../../../app/plan/components/day-route-map.test.tsx)
(Farbe und Kontrast beider Linienebenen, die Farbe der Pfeilspitze) und vier
in
[day-route-map.layout.test.ts](../../../app/plan/components/day-route-map.layout.test.ts)
(Herkunft der Farbe, Ersatzwert, kein Glow, enge helle Kontur). Die Farbe
selbst prüft
[routenfarbe.test.ts](../../../lib/map/routenfarbe.test.ts) gegen alle fünf
Kartenflächen.
