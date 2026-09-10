---
id: bug-035
app: wegfara
req: req-055
priority: high
created: 2026-09-10
---

# Observed

Vom Begleiter komme ich nicht mehr in den Planer.

# Expected

Ist der Bildschirm groß genug für den Planer, führt ein Weg dorthin —
req-055 sagt es zu: „Wer beide Bereiche darf, findet im Kopfbereich beider
einen Wechsel."

# Befund

Der Knopf existiert bereits in `app/go/components/header.tsx` („Zum
Planer", mit Symbol), er hängt aber allein an `darfPlanen` aus
`lib/einstieg/ziel.ts` — und das prüft nur die **Rolle**: Reiseleiter
einer Reise oder Account-Admin. Die **Bildschirmbreite** spielt keine
Rolle.

Zwei Dinge sind daran zu prüfen:

1. **Warum er fehlt.** Bin ich bei der geöffneten Reise weder Reiseleiter
   noch Account-Admin, erscheint er gar nicht. Ist das der Fall, ist die
   Regel zu eng: Wer den Planer aufrufen darf, soll auch hinkommen.
2. **Ob er zu unauffällig ist.** Er trägt nur ein Symbol, ohne Text.
   Zwischen den übrigen Symbolen der Kopfzeile geht er unter.

Zusätzlich soll die Bildschirmbreite mitentscheiden: Auf einem schmalen
Bildschirm ergibt der Wechsel keinen Sinn — der Planer verweist dort
ohnehin auf einen breiteren (siehe [stack.md](../../stack.md)). Ab der
Breite, ab der der Planer benutzbar ist, gehört der Weg sichtbar zu sein.

# Steps

1. Begleiter auf einem breiten Bildschirm öffnen
2. Die Kopfzeile nach einem Weg in den Planer absuchen
3. Es gibt keinen

# Behebung

Der Wechsel in der Kopfzeile des Begleiters trägt jetzt seine Beschriftung
„Zum Planer" neben dem Symbol und erscheint genau dort, wo der Planer
benutzbar ist.

**Zur ersten Frage — warum er fehlt.** Die Regel ist nicht zu eng: Der
Knopf hängt an `darfPlanen` aus `lib/einstieg/ziel.ts`, und exakt dieselbe
Funktion mit denselben Eingaben sperrt in `app/plan/page.tsx` den Planer
selbst. Wer den Planer aufrufen darf, sieht also auch den Weg dorthin; wer
ihn nicht darf, würde ohne Meldung wieder in den Begleiter geleitet — ein
Weg, der ihn nur zurückbrächte. Damit die beiden Seiten nicht
auseinanderlaufen, hält `app/protected-pages.test.ts` sie jetzt an der
Quelle aneinander fest. Was fehlte, war nicht die Erlaubnis, sondern die
Auffindbarkeit — also Punkt 2.

**Zur zweiten Frage — er war zu unauffällig.** Er trug nur ein Symbol und
ging zwischen den übrigen Symbolen der Kopfzeile unter. Jetzt steht die
Beschriftung daneben, so wie der Wechsel in der Gegenrichtung (der Eintrag
„Begleiter" in `components/bereichsleiste.tsx`) auch schon Text trägt. Das
Tippziel bleibt mindestens 44 × 44 px, ist mit Text aber breiter als hoch —
aus dem festen Maß wurde deshalb ein Mindestmaß.

**Zur Bildschirmbreite.** Der Wechsel erscheint erst ab
`PLANNER_MIN_WIDTH_PX` (1180 px, `lib/plan/viewport.ts`) — derselben Zahl,
ab der der Planer sich zeigt statt auf einen breiteren Bildschirm zu
verweisen. Darunter gibt es ihn gar nicht erst, auch nicht per Tastatur.
Wird das Fenster breit genug gezogen, kommt er nach.

- Gemessen wird mit `components/use-window-width.ts`. Der Haken lag zuvor
  unter `app/plan/` und ist dorthin gewandert, weil ihn nun beide Bereiche
  brauchen — aus `app/plan/` nach `app/go/` wird nichts importiert (siehe
  `delivery/stack.md`, Conventions). Die angenommene Breite vor der ersten
  Messung ist jetzt ein Parameter: der Planer nimmt breit an, der Begleiter
  schmal — jeder seinen Normalfall, damit nichts kurz aufblitzt.
- Bei 375 px und 768 px ändert sich an der Kopfzeile nichts: dort gibt es
  den Knopf nicht.

Geprüft durch `app/go/go-view.test.tsx` (sichtbare Beschriftung; Wechsel ab
1180 px, keiner darunter, Nachkommen beim Verbreitern),
`app/go/components/header.layout.test.ts` (Tippziel und nicht umbrechende
Beschriftung im CSS — jsdom rechnet kein Layout) und
`app/protected-pages.test.ts` (Begleiter und Planer messen den Zugang mit
derselben Regel).
