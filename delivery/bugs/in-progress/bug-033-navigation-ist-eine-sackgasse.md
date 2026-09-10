---
id: bug-033
app: wegfara
req: req-043
priority: high
created: 2026-09-10
---

# Observed

Bin ich in „Mein Bereich", in der „Verwaltung" oder bei den „Kosten",
komme ich nie wieder in die anderen Bereiche zurück.

# Expected

Aus jedem Bereich sind alle übrigen erreichbar — ohne Umweg über die
Adresszeile oder den Zurück-Knopf des Browsers.

# Befund

Die Bereiche sind unterschiedlich gebaut, und das ist die Ursache:

- **Mein Bereich** (`/mein-bereich`) hat **gar keine Kopfleiste**. Der
  einzige Ausgang ist „Zurück zur App" ganz unten nach allen Karten — und
  er führt auf `/`, das seit req-055 je nach Lage irgendwohin weiterleitet
  (Begleiter, wenn eine Reise läuft), nicht verlässlich in den Planer.
- **Verwaltung** (`/plan/accounts`) hat eine eigene Kopfleiste mit
  „Zurück zum Planer" — immerhin ein Ausgang, aber nur einer: In einen
  bestimmten Bereich führt er nicht.
- **Kosten** ist ein gewöhnlicher Bereich des Planers und sollte die
  Bereichsleiste haben. Dass es dort ebenfalls klemmt, ist zu prüfen —
  vielleicht wird die Leiste dort verdeckt oder ausgeblendet.

Die Bereichsleiste des Planers (`app/plan/components/header.tsx`) kennt
alle Wege bereits — sie fehlt auf diesen Seiten nur. Eine Kopfleiste, die
überall gleich aussieht und dieselben Ziele anbietet, löst alle drei
Fälle auf einmal.

# Steps

1. Planer öffnen
2. „Mein Bereich" wählen
3. Es gibt keinen Weg zurück zu POIs, Planung oder Reisedetails

# Behebung

Die Kopfleiste des Planers liegt jetzt als gemeinsame **Bereichsleiste** in
`components/bereichsleiste.tsx` und steht auf jeder Seite, die Bereiche
anbietet — im Planer, in „Mein Bereich" und in der „Verwaltung". Sie sieht
überall gleich aus und bietet überall dieselben Ziele an: die Bereiche der
Reise, den Begleiter, „Mein Bereich" und beim Gesamt-Admin die „Verwaltung".

- **Mein Bereich** trägt die Leiste am oberen Rand. „Zurück zur App" ganz
  unten ist damit entbehrlich und entfällt. Wer den Planer nicht darf
  (req-055), bekommt seine Bereiche gar nicht erst angeboten — er landete
  dort ohne Meldung wieder im Begleiter.
- **Verwaltung** trägt dieselbe Leiste; „Zurück zum Planer" als einziger
  Ausgang entfällt.
- Außerhalb des Planers gibt es keinen Planer-Zustand, den eine Schaltfläche
  umschalten könnte. Die Bereiche führen dort als Verweis auf
  `/plan?bereich=<id>`; der Planer geht in genau diesem Bereich auf
  (`planAreaPath` / `planAreaFromParam` in `lib/plan/areas.ts`). Ein Verweis
  landet damit gezielt, nicht nur „irgendwo im Planer".

**Kosten, geprüft:** Im Planer klemmte dort nichts, und verdeckt war die
Leiste auch nicht — „Kosten" (wie „Bewertungen") ist schlicht noch nicht
gebaut und steht nicht in `SWITCHABLE_PLAN_AREAS`. Die Leiste schluckte das
Tippen darauf wortlos, ohne dass etwas geschah; das liest sich wie eine
Sackgasse. Beide Bereiche sind jetzt sichtbar abgeschaltet — so wie die noch
leeren Bereiche des Begleiters (`app/go/components/bottom-nav.tsx`). Der
„Kosten"-Bereich, der wirklich benutzt wird, liegt im Begleiter und hat dort
seine Leiste am unteren Rand; von dort ging es immer schon weiter.

**Nebenbefund, nicht Teil dieses Bugs:** `/mein-bereich` verletzt bei allen
drei Breiten die Tippziel-Regel aus `delivery/stack.md` (Regel 4) — „Dieses
Gerät hinzufügen", „Abmelden", „Überall abmelden", „Neuen Satz erzeugen",
„Teilnehmer hinzufügen", „Einladen", „Setzen", das Bereichs-Admin-Kästchen
und „Teilnehmer ändern" sind alle flacher als 44 px. Das gilt unverändert
schon vor dieser Änderung und gehört in einen eigenen Bug.
