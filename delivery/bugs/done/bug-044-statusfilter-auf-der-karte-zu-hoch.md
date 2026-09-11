---
id: bug-044
app: wegfara
req: req-013
priority: normal
created: 2026-09-11
---

# Observed

Beim POI-Filter nach Status auf der Karte stehen die Zeilen weiterhin zu
weit auseinander — auch nach bug-029.

# Expected

Der senkrechte Abstand zwischen den Statuszeilen wird weiter verringert;
das Feld wird dadurch spürbar kompakter.

Wie bei bug-029: Die Trefferfläche der Kästchen darf die Zeilenhöhe nicht
bestimmen. Sie erreicht ihre 44×44 px, indem sie die Zeile überlagert
(siehe [stack.md](../../stack.md)) — die sichtbaren Zeilen rücken
zusammen.

# Steps

1. Planer öffnen, Bereich POIs
2. Auf der Karte den Statusfilter öffnen
3. Die Zeilen stehen zu weit auseinander

# Ursache

bug-029 hat die Trefferfläche aus dem Fluss der Zeile genommen, sie aber
**mittig** über die Zeile gelegt: 22 px über die Zeilenmitte hinaus nach
oben, 22 px nach unten. Damit gilt die Rechnung aus bug-029 — die Fläche
der Zeile darunter ragt 22 px über deren Mitte hinaus, das eigene
Kästchen nur 9 px — und der Zeilenabstand kann nicht unter 31 px fallen,
ohne dass ein Tipp auf die untere Hälfte eines Kästchens den Status
darunter schaltet. Bei 32 px von Mitte zu Mitte war Schluss; das Feld
blieb 202 px hoch, obwohl darin nur fünf Zeilen mit 12-px-Text stehen.

Die Mittigkeit war also die eigentliche Grenze, nicht die Größe der
Trefferfläche.

# Behebung

Die Trefferfläche bleibt 44×44 px, sitzt aber nicht mehr mittig, sondern
**wächst nach unten**: nach oben ragt sie nur 5 px über das Kästchen
hinaus, die übrigen 21 px liegen darunter.

Das trägt, weil in einer Spalte das spätere Geschwister obenauf liegt:
Reicht keine Fläche über die Oberkante des Kästchens der Zeile darüber,
gehört jedes Kästchen an jeder Stelle weiterhin seinem eigenen Schalter.
Der Zeilenabstand hängt damit nur noch an diesem Überstand nach oben —
nicht mehr an der halben Trefferfläche.

- `components/tippziel-checkbox.module.css`: `.wrapUeberlagernd` nennt den
  Überstand nach oben (`--ueberstand-oben: 5px`) an genau einer Stelle,
  das Eingabefeld hängt daran (`top: calc(-1 * var(--ueberstand-oben))`).
  Zwei Bedingungen an den Aufrufer, beide durch Testfälle gehalten: der
  Zeilenabstand ist größer als dieser Überstand, und unter der letzten
  Zeile bleibt Platz für den Überstand nach unten.
- `app/plan/components/poi-map.module.css`: der Abstand der Zeilen steht
  auf 6 px statt 14 px — 24 px von Mitte zu Mitte statt 32 px, das Feld
  ist 176 px hoch statt 202 px. Die Überschrift behält ihre gewohnten
  14 px Abstand über ein eigenes `margin-bottom: 8px`, und der Kasten
  bekommt unten 21 px Innenabstand: so endet die Fläche der letzten Zeile
  genau an seiner Unterkante, statt unsichtbar auf die Karte zu ragen und
  dort Tipps zu schlucken.
- `app/plan/components/poi-map.tsx` bleibt unverändert — die Schalter
  waren seit bug-029 schon die überlagernde Bauart.

Die Regel „Tippziele mindestens 44×44 px" aus [stack.md](../../stack.md)
bleibt unberührt; auch die Ausnahme von Regel 2 aus bug-029 (unsichtbare
Trefferflächen dürfen einander überlagern) gilt unverändert weiter.

# Prüfung

Neue Tests, die ohne die Behebung fehlschlagen (9 Stück):

- `components/tippziel-checkbox.layout.test.ts`, Abschnitt „Trefferfläche
  wächst nach unten (bug-044)" — der Überstand nach oben steht an einer
  Stelle und trägt die Fläche, er ist deutlich kleiner als bei mittigem
  Sitz, die Fläche deckt das Kästchen weiterhin ganz ab, und ihre eigene
  Mitte (die Regel 3 prüft) liegt innerhalb des Kästchens.
- `app/plan/components/poi-map.layout.test.ts`, Abschnitt „Zeilen des
  Statusfilters (bug-044)" — die Zeilen rücken um mindestens ein Viertel
  näher zusammen als nach bug-029, der Abstand bleibt größer als der
  Überstand nach oben, unter der letzten Zeile ist Platz für den
  Überstand nach unten, und die Überschrift behält ihren Abstand.
- `tests/e2e/bildschirmpruefung.e2e.ts` — im echten Browser: an Ober-,
  Mitte- und Unterkante jedes Kästchens einer fünfzeiligen Spalte liegt
  der Schalter der eigenen Zeile obenauf; die Spalte ist zugleich bei
  allen drei Breiten grün.

Volle Suite grün: 3649 Unit-Tests, 14 E2E-Tests (`npm run test:e2e`,
darin die Bildschirmbreiten-Prüfung aus req-049 bei 375, 768 und
1280 px), Lint, Prettier und `tsc --noEmit`. In Chromium nachgemessen:
Trefferfläche 44×44 px, Kästchen 18×18 px, 24 px von Mitte zu Mitte
(vorher 32 px), Feld 176 px hoch (vorher 202 px), die Fläche der letzten
Zeile endet genau an der Unterkante des Kastens, und an Ober-, Mitte- und
Unterkante aller fünf Kästchen liegt der eigene Schalter obenauf.
