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
