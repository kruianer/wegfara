---
id: bug-040
app: wegfara
req: req-060
priority: normal
created: 2026-09-11
---

# Observed

„Ausgewählte löschen" und „Bewertungsrunde starten" stehen in eigenen
Zeilen und kosten Platz.

# Expected

Beide stehen in derselben Zeile wie die Filter — als **Symbol mit
Tooltip** statt mit Text. Der Tooltip nennt weiterhin, was der Knopf tut
(„Ausgewählte löschen", „Bewertungsrunde starten"), sodass die Bedeutung
nicht verlorengeht.

„Ausgewählte löschen" bleibt dabei nur wirksam, wenn POIs angekreuzt sind
— und die Rückfrage vor dem Entfernen bleibt bestehen (req-035).

Die Symbole sind Tippziele: mindestens 44×44 px über ihre Trefferfläche
(siehe [stack.md](../../stack.md)), ohne dass sie sichtbar größer werden
als die übrigen Elemente der Zeile.

# Steps

1. Planer öffnen, Bereich POIs
2. Die Zeilen über der Liste ansehen — Filter, Aktionen und Anlegen
   stehen getrennt
