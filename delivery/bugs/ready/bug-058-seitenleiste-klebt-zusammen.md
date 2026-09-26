---
id: bug-058
app: wegfara
req: req-077
priority: normal
created: 2026-09-26
---

# Observed

In der aufgeklappten Seitenleiste klebt alles zu sehr zusammen: Slogan,
die gewählte Reise und die Menüpunkte stehen fast ohne Luft übereinander.

# Expected

Zwischen den drei Gruppen — Name mit Slogan, gewählte Reise, Menüpunkte —
steht sichtbar mehr Abstand als zwischen den Menüpunkten untereinander.
Man erkennt am Abstand, was zusammengehört.

# Steps

1. Planer öffnen, Seitenleiste aufklappen
2. Auf den Bereich zwischen Slogan, Reise und erstem Menüpunkt sehen

# Ursache

Alle Gruppen stehen in derselben Flex-Spalte mit **einem** Abstand für
alles ([seitenleiste.module.css](../../../app/plan/components/seitenleiste.module.css)):

```
.tafel { gap: 10px; }      /* zwischen ALLEN Gruppen */
.nav   { gap: 2px; }       /* zwischen den Menuepunkten */
.slogan { margin-top: 3px; }
```

10 px trennen damit den Slogan von der Reise und die Reise von der
Navigation — dieselben 10 px, die auch innerhalb einer Zeile zwischen
Symbol und Text stehen. Der Slogan hängt mit 3 px praktisch am Namen.

Für den Unterschied zwischen „gehört zusammen" und „ist eine andere
Gruppe" bleibt damit kein Spielraum.

Zum Vergleich LivingGardenTwin, die Vorlage aus req-077: Dort trennen
**16 px vor** und **20 px nach** der Uhr die Gruppen
(`--rail-clock-lead: 16px`, `--rail-clock-trail: 20px`), während die
Einträge mit 4 px dicht beieinander bleiben.

# Erwartete Behebung

Der Abstand **zwischen den Gruppen** wird größer als der innerhalb einer
Gruppe. Wie groß, entscheidet die Umsetzung — der Unterschied muss auf
einen Blick zu sehen sein.

Die Maße aus req-078 bleiben: Slogan 21 px, aufgeklappt 320 px,
Beschriftung 13 px, Symbole 22 px, Zeilenhöhe 44 px.

# Notes

Die eingeklappte Leiste zeigt nur Symbole — dort ist nichts zu ändern.

Geprüft wird bei 375 px, 768 px und 1280 px (siehe
[stack.md](../../stack.md)): Bei mehr Abstand muss die aufgeklappte Leiste
auf niedrigen Bildschirmen weiterhin vollständig hineinpassen.
