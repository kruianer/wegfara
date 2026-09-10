---
id: bug-029
app: wegfara
req: req-049
priority: normal
created: 2026-09-10
---

# Observed

Auf der Karte, im aufgeklappten Status-Feld, stehen die einzelnen Zeilen
zu weit auseinander. Es kommt von den zu groß gewordenen Checkboxen.

# Expected

Die Zeilen stehen wieder so eng beieinander wie zuvor — das Feld bleibt
kompakt.

bug-025 hat die Checkboxen auf der Karte bereits verkleinert; ihre
Trefferfläche wirkt aber offenbar weiterhin auf die Zeilenhöhe. Die
Trefferfläche darf größer sein als das sichtbare Element, ohne die Zeilen
auseinanderzuschieben — etwa indem sie die Zeile überlagert, statt ihre
Höhe zu bestimmen.

Die Regel „Tippziele mindestens 44×44 px" aus [stack.md](../../stack.md)
gilt dabei weiterhin.

# Steps

1. Planer öffnen, Bereich POIs
2. Auf der Karte das Status-Feld öffnen
3. Die Zeilen stehen zu weit auseinander
