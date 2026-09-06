---
id: bug-022
app: wegfara
req: req-046
priority: normal
created: 2026-09-06
---

# Observed

Das Vergrößern eines Programmpunkts im Zeitstrahl funktioniert zwar, ist
aber nicht intuitiv. Man sieht nicht, wo man anfassen kann.

# Expected

Ein Programmpunkt hat oben und unten einen sichtbaren Anfasser. Sobald
ich mit dem Finger daraufbleibe, ändert sich die Rahmenfarbe — ich sehe
also, dass ich die Kante gegriffen habe, bevor ich ziehe.

# Steps

1. Planer auf dem iPad öffnen, Bereich Planung
2. Einen Programmpunkt im Zeitstrahl an der oberen oder unteren Kante
   anfassen
3. Es ist nicht erkennbar, wo der Anfasser liegt und ob er gegriffen
   wurde

# Ursache

Die beiden Kanten aus req-040 und req-046 waren reine Greifflächen: ein
Element ohne eigene Darstellung am oberen bzw. unteren Rand des Blocks
(`.resizeHandle` in `app/plan/components/timeline-column.module.css`).
Sichtbar war daran nichts — nur der Mauszeiger wechselte auf
`ns-resize`, was am iPad niemand sieht.

Auch das Greifen selbst blieb stumm: der Programmpunkt meldete erst
zurück, dass etwas passiert, wenn der Zug schon lief und der Umriss der
Vorschau erschien (req-046). Wer die Kante nur berührte, bekam dieselbe
Ansicht wie zuvor und wusste nicht, ob er die Kante oder den Block als
Ganzes in der Hand hatte.

# Behebung

Beide Kanten tragen jetzt einen sichtbaren Anfasser, und die gegriffene
Kante meldet sich am Rahmen des Programmpunkts.

- In der Mitte jeder Kante liegt ein kurzer, abgerundeter Strich
  (`.resizeGrip`) in einer Farbe, die sich von der Blockfüllung abhebt.
  Er sitzt mittig und kommt damit dem Kreuz zum Entfernen oben rechts
  (req-039) nicht in die Quere. Zeiger-Ereignisse nimmt er nicht an —
  die gehören der Greiffläche um ihn herum, die deutlich größer ist als
  der Strich und am Touchgerät unverändert auf 20 Pixel wächst.
- Liegt der Zeiger auf einer Kante, wechselt der Rahmen des ganzen
  Programmpunkts von seiner Typfarbe auf die Akzentfarbe, der Block
  bekommt einen leichten Schein und der Strich dieser Kante wird
  kräftiger. Mit der Maus zeigt sich das beim Schweben, mit dem Finger,
  sobald er aufsetzt — also vor dem Ziehen.
- Losgelassen wird die Kennzeichnung, wenn der Zeiger die Kante wieder
  verlässt, wenn der Finger loslässt oder der Browser den Zug abbricht,
  und mit dem Ende eines Zuges. Der Rahmen bekommt dann seine Typfarbe
  zurück.

Die Rahmenfarbe steht weiterhin am Element und nicht im Stylesheet: die
Farbe des ungegriffenen Rahmens kommt aus dem Typ des Programmpunkts und
wird ohnehin dort gesetzt — zwei Wege für dieselbe Eigenschaft ergäben
einen Wettlauf.

Geändert: `app/plan/components/timeline-column.tsx` und
`app/plan/components/timeline-column.module.css`.

# Prüfung

Neue Tests, die ohne die Behebung fehlschlagen:

`app/plan/components/planung-view.test.tsx`

- Obere und untere Kante tragen je einen eigenen, sichtbaren Anfasser.
- Der Rahmen wechselt auf die Akzentfarbe, sobald der Finger auf der
  oberen bzw. der unteren Kante liegt — ohne dass gezogen wird.
- Hervorgehoben wird nur der Anfasser der gegriffenen Kante, nicht der
  der anderen.
- Der Rahmen bekommt seine Typfarbe zurück, wenn der Zeiger die Kante
  verlässt und wenn der Finger nach dem Ziehen loslässt.
- Wird der Block selbst angefasst und nicht eine seiner Kanten, bleibt
  der Rahmen unverändert.

`app/plan/components/timeline-column.layout.test.ts` (jsdom führt kein
CSS aus, deshalb direkt am Stylesheet geprüft)

- Der Anfasser hat Größe und Farbe, ist also zu sehen, liegt mittig in
  der Kante und nimmt keine Zeiger-Ereignisse an.
- Der gegriffene Anfasser trägt die Akzentfarbe.

# Akzeptanzkriterien der Behebung

- [x] Gegeben ein Programmpunkt im Zeitstrahl, wenn ich ihn ansehe, dann
      trage er oben und unten einen sichtbaren Anfasser.
- [x] Gegeben ein Programmpunkt, wenn ich mit dem Finger auf seiner
      oberen oder unteren Kante liege, dann ändert sich die Rahmenfarbe,
      bevor ich ziehe.
- [x] Gegeben eine gegriffene Kante, wenn ich sie wieder loslasse oder
      verlasse, dann hat der Programmpunkt wieder seine Typfarbe.
- [x] Gegeben dieselben Handgriffe wie bisher, wenn ich Kanten und Block
      ziehe, dann verhalten sie sich unverändert (req-040, req-046).
