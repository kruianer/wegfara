---
id: bug-042
app: wegfara
req: req-012
priority: normal
created: 2026-09-11
---

# Observed

Die Knöpfe auf der Karte nehmen zu viel Platz: „Suchgebiet zeichnen",
„entfernen" und „Liste ausblenden" stehen mit vollem Text da.

# Expected

Alle drei werden zu **Symbolen mit Tooltip** — der Tooltip nennt
weiterhin, was der Knopf tut, sodass die Bedeutung nicht verlorengeht.

Für „Liste ausblenden" passt ein **Vollbild-Symbol** besser als Text: Es
sagt, was geschieht — die Karte nimmt die ganze Breite. Im ausgeblendeten
Zustand zeigt es entsprechend das Gegenteil.

Die Symbole sind Tippziele: mindestens 44×44 px über ihre Trefferfläche
(siehe [stack.md](../../stack.md)), ohne sichtbar größer zu werden als
die übrigen Elemente der Karte.

# Steps

1. Planer öffnen, Bereich POIs
2. Die Knöpfe über der Karte ansehen
