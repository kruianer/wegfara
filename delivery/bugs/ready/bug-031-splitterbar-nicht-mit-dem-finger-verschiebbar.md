---
id: bug-031
app: wegfara
req: req-010
priority: normal
created: 2026-09-10
---

# Observed

Die Trennleiste in der Mitte des Bildschirms zwischen POI-Liste und Karte
lässt sich nicht mit dem Finger verschieben.

# Expected

Sie lässt sich auch mit dem Finger ziehen — so wie mit der Maus. Auf dem
iPad ist der Finger der einzige Weg.

Wie bei bug-017 und bug-023: Ziehen muss über Zeiger-Ereignisse laufen,
nicht nur über Maus-Ereignisse. Die Greiffläche der Leiste muss dabei
groß genug sein, um sie mit dem Finger zu treffen (44 px, siehe
[stack.md](../../stack.md)) — ohne dass die Leiste selbst dicker aussieht.

# Steps

1. Planer auf dem iPad öffnen, Bereich POIs
2. Die Trennleiste zwischen Liste und Karte mit dem Finger ziehen
3. Es passiert nichts
