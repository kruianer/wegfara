---
id: bug-016
app: wegfara
req: req-035
priority: normal
created: 2026-09-04
---

# Observed

Beim Bearbeiten eines POI ragt der Speichern-Knopf über den unteren Rand
hinaus. Eine Scrollbar gibt es nicht, dadurch lässt sich der Knopf nur
schwer drücken.

# Expected

Der Speichern-Knopf ist vollständig sichtbar und ohne Mühe erreichbar —
entweder weil das Formular scrollbar ist oder weil der Knopf im
sichtbaren Bereich bleibt.

# Steps

1. Planer öffnen, Bereich POIs
2. Einen bestehenden POI zum Bearbeiten öffnen
3. Zum unteren Ende des Formulars sehen

# Ursache

Zwei Dinge trafen zusammen.

Erstens war die linke Spalte kein durchgehender Bildlaufbereich: gescrollt
hat nur die Liste selbst (`.rows`). Das Formular beim Anlegen stand als
starre Zeile daneben — war es höher als der freie Platz, schrumpfte die
Liste auf null und der Rest ragte unter den Rand der Spalte, den
`.pane` (split-view) mit `overflow: hidden` ohne Bildlaufleiste
abschneidet. Der Speichern-Knopf war dort nicht mehr erreichbar.

Zweitens stand die Knopfleiste des Formulars am Ende eines langen
Formulars: das aufgeklappte Formular einer Zeile ist mit allen Feldern
höher als der sichtbare Ausschnitt der Liste. Es ließ sich zwar scrollen,
aber überlagernde Bildlaufleisten (macOS, Windows 11) blenden sich aus,
solange man nicht scrollt — ohne sichtbaren Hinweis wirkt ein Formular,
das unter den Rand reicht, abgeschnitten.

# Behebung

Alles unterhalb der Leisten — das Formular beim Anlegen, der Balken für
die Bewertungsrunde und die Liste — liegt jetzt in einem gemeinsamen
Bildlaufbereich (`.scroll`). Damit ist jedes Formular vollständig
erreichbar, gleich ob es beim Anlegen oder in einer Zeile steht. Die
Bildlaufleiste behält ihren Platz (`scrollbar-gutter: stable`) und ist
dauerhaft sichtbar, statt sich auszublenden.

Zusätzlich bleibt die Knopfleiste des Formulars mit „Speichern“,
„Abbrechen“ und „POI löschen“ am unteren Rand des sichtbaren Bereichs
stehen (`position: sticky`), solange das Formular im Bild ist. Der Knopf
ist damit erreichbar, ohne vorher ans Ende scrollen zu müssen. Sie liegt
unter den Ortsvorschlägen, damit diese sie weiterhin überdecken.

Die Breite beider Formulare bleibt unverändert (bug-014): das beim
Anlegen über `.formStandalone` mit 22 px seitlichem Abstand, das der
Zeile über den unveränderten Innenabstand der Liste.

Geändert: `app/plan/components/poi-list.tsx`,
`app/plan/components/poi-list.module.css` und
`app/plan/components/poi-form.module.css`.

# Akzeptanzkriterien der Behebung

- [x] Gegeben ein bestehender POI mit aufgeklapptem Formular, wenn das
      Formular höher ist als die Spalte, dann lässt sich der Bereich
      scrollen und die Bildlaufleiste ist sichtbar.
- [x] Gegeben dasselbe Formular, wenn ich es ansehe, dann steht die
      Knopfleiste mit „Speichern“ am unteren Rand des sichtbaren
      Bereichs, statt darunter zu liegen.
- [x] Gegeben das Formular beim Anlegen eines POI, wenn es höher ist als
      der freie Platz, dann liegt es im selben Bildlaufbereich wie die
      Liste und wird nicht mehr am Rand der Spalte abgeschnitten.
- [x] Gegeben ein aufgeklapptes Formular, wenn ich seine Breite mit der
      bei der Neuanlage vergleiche, dann ist sie weiterhin dieselbe
      (bug-014).
- [x] Gegeben ein aufgeklapptes Formular, wenn die Ortssuche Vorschläge
      zeigt, dann liegen sie über der Knopfleiste.
