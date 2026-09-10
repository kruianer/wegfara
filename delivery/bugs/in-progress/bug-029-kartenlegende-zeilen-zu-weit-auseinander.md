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

# Ursache

bug-025 hat das sichtbare Kästchen verkleinert (18 px), nicht aber die
Trefferfläche: `components/tippziel-checkbox.tsx` ist ein 44×44 px großes
Element, in dem das Kästchen mittig gezeichnet wird. Im Status-Feld der
Karte steht diese Fläche im normalen Fluss der Zeile — sie war damit das
Größte darin und bestimmte die Zeilenhöhe. Zusammen mit dem Abstand von
8 px standen die Zeilen 52 px von Mitte zu Mitte auseinander; das Feld
war 304 px hoch, obwohl darin nur fünf Zeilen mit 12-px-Text stehen.

Die Legende links unten (`.legend`) war nie betroffen — sie trägt keine
Bedienelemente. Gemeint ist das Feld „Status auf der Karte" rechts oben.

# Behebung

Die Trefferfläche bleibt 44×44 px, legt sich aber über die Zeile, statt
ihre Höhe zu bestimmen.

- `components/tippziel-checkbox.tsx` bekommt die Kennzeichnung
  `ueberlagernd`. Damit ist die Ankreuzbox im Layout nur noch so groß wie
  ihr Kästchen (18×18 px); das unsichtbare Eingabefeld darin steht auf
  44×44 px und ist mittig darüber gelegt (`inset: auto`, `top/left: 50%`,
  `translate(-50%, -50%)`). Ohne die Kennzeichnung bleibt alles wie
  bisher — die POI-Liste hat Zeilen, die ohnehin höher sind.
- `app/plan/components/poi-map.tsx`: die fünf Status-Schalter nutzen sie.
  `.statusFilterRow` bekommt weiterhin keine Höhe — die Zeile ist so hoch
  wie das, was man in ihr sieht.
- `app/plan/components/poi-map.module.css`: der Abstand zwischen den
  Zeilen steht auf 14 px. Zusammen mit der 18 px hohen Zeile sind das
  32 px von Mitte zu Mitte statt 52 px, das Feld ist 204 px hoch statt
  304 px. Weniger geht nicht: die Trefferfläche der Nachbarzeile ragt
  22 px über deren Mitte hinaus, das eigene Kästchen 9 px — bei engerem
  Stand fiele ein Tipp auf die untere Hälfte eines Kästchens der Zeile
  darunter zu.
- `tests/e2e/screen-check.ts`, Regel 2: Trefferflächen, die selbst nichts
  zeichnen (`opacity: 0`), zählen beim paarweisen Vergleich nicht mit.
  Genau das ist hier gewollt — sie überlagern einander, ohne dass sichtbar
  etwas überlappt. Ihre Bedienbarkeit bleibt geprüft: Regel 3 verlangt
  weiterhin, dass jedes Bedienelement an seiner eigenen Mittelposition
  obenauf liegt, und Regel 4 misst weiterhin die vollen 44×44 px. Ohne
  diese Ausnahme meldete die Prüfung die bewusste Überlagerung als
  Verstoß — genau deshalb kam bei bug-025 und bug-028 ein negativer
  Abstand nicht in Frage.

# Prüfung

Neue Tests, die ohne die Behebung fehlschlagen:

- `components/tippziel-checkbox.layout.test.ts`, Abschnitt „überlagernde
  Trefferfläche (bug-029)" — im Layout so groß wie das Kästchen, darin
  weiterhin 44×44 px, mittig über die Zeile gelegt.
- `components/tippziel-checkbox.test.tsx` — die Kennzeichnung wirkt und
  landet nicht als Attribut im Markup; ohne sie bleibt die Ankreuzbox wie
  bisher.
- `app/plan/components/poi-map.layout.test.ts`, Abschnitt „Zeilenabstand
  im Status-Feld (bug-029)" — die Zeilen stehen enger als die
  Trefferfläche hoch ist, und die Trefferfläche der Nachbarzeile reicht
  nicht über das eigene Kästchen.
- `app/plan/components/poi-map.test.tsx` — die Status-Schalter der Karte
  sind die überlagernde Bauart.
- `tests/e2e/bildschirmpruefung.e2e.ts` — zwei dicht stehende Ankreuzboxen
  mit einander überlagernden, unsichtbaren Trefferflächen sind grün; eine
  unsichtbare Trefferfläche über einem Knopf schlägt weiterhin fehl
  (Regel 3).

Volle Suite grün: 3097 Unit-Tests, 13 E2E-Tests (`npm run test:e2e`, darin
die Bildschirmbreiten-Prüfung aus req-049 bei 375, 768 und 1280 px), Lint,
Prettier und `tsc --noEmit`. In Chromium nachgemessen: Trefferfläche
44×44 px, Kästchen 18×18 px, 32 px von Mitte zu Mitte, und an Ober-,
Mitte- und Unterkante jedes Kästchens liegt der Schalter der eigenen Zeile
obenauf.
