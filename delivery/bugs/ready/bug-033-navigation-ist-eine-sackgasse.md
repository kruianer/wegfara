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
