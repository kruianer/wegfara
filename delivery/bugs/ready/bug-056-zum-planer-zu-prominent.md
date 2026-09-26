---
id: bug-056
app: wegfara
req: req-055
priority: normal
created: 2026-09-26
---

# Observed

Im Begleiter ist der Knopf **„Zum Planer"** viel zu prominent. Er zieht
den Blick auf sich, obwohl er der seltenste Weg in dieser Ansicht ist.

# Expected

Der Wechsel bleibt erreichbar, tritt aber zurück: Der Begleiter ist die
Sicht für unterwegs, und was dort zählt, sind Tagesplan, Karte und Wetter
— nicht der Rückweg in den Planer.

Er darf dabei nicht so weit zurücktreten, dass er unauffindbar wird
(bug-035).

# Steps

1. Als Reiseleiter den Begleiter öffnen, auf einem breiten Bildschirm
2. Auf die Kopfzeile sehen: „Zum Planer" steht dort als beschrifteter
   Knopf mit Rahmen und dominiert die Zeile

# Ursache

Der Knopf trägt Symbol **und** Beschriftung bei 14 px fett, mit Rahmen und
14 px Innenabstand
([header.module.css](../../../app/go/components/header.module.css),
`.wechsel`, Zeilen 91–103):

```
min-width: 44px;  min-height: 44px;
padding: 0 14px;  border-radius: 12px;
border: 1px solid var(--line);
font-size: 14px;  font-weight: 600;
```

Das ist kein Versehen, sondern das Ergebnis von **bug-035**. Der Kommentar
in [header.tsx](../../../app/go/components/header.tsx) (Zeile 142) sagt es
ausdrücklich:

```
/* Mit Beschriftung, nicht nur mit Symbol: zwischen den uebrigen
   Symbolen der Kopfzeile ging er sonst unter (bug-035). */
```

Damals war er zu unauffällig, jetzt ist er zu auffällig. Gesucht ist das
Maß dazwischen — nicht die Rückkehr zum Zustand vor bug-035.

# Erwartete Behebung

Der Wechsel wird leiser: weniger Gewicht als die Bedienelemente, mit denen
man im Begleiter tatsächlich arbeitet.

Wie, entscheidet die Umsetzung. Was gelten muss:

- Er bleibt auffindbar — nicht in ein Menü verschoben, das man erst öffnen
  muss (bug-035).
- Seine Trefferfläche bleibt bei mindestens 44 × 44 px (siehe
  [stack.md](../../stack.md)).
- Er erscheint weiterhin nur, wenn die Person den Planer überhaupt darf
  und der Bildschirm breit genug ist (`zeigtWechsel`, bug-035).

# Notes

Zu prüfen ist, ob die Kopfzeile nach der Änderung noch ausgewogen wirkt:
Neben dem Wechsel stehen dort der Reise-Umschalter, die Themenwahl und
„Mein Bereich".

Geprüft wird bei 375 px, 768 px und 1280 px (siehe
[stack.md](../../stack.md)) — bei 375 px erscheint der Knopf gar nicht.
