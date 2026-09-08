---
id: bug-024
app: wegfara
req: req-049
priority: normal
created: 2026-09-08
---

# Observed

Die mit req-049 eingeführte automatische Bildschirmbreiten-Prüfung
(`tests/e2e/screen-check.ts`) deckt auf, dass ein Großteil der
Bedienelemente im Planer (`/plan`, 1280 px — die einzige Breite, bei der
der Planer seinen eigentlichen Inhalt statt des Hinweises auf einen
breiteren Bildschirm zeigt) kleiner ist als die in
[stack.md](../../stack.md), Abschnitt „Bildschirmbreiten" geforderten
44×44 px:

- Kopfbereich: die Bereichs-Knöpfe „POIs", „Planung", „Bewertungen",
  „Kosten", „Dokumente", „Reisedetails" sowie „Begleiter" und „Mein
  Bereich" (jeweils ca. 27–33 px hoch), der Reise-Knopf (31 px) und
  „Abmelden" (38×38 px).
- POI-Filter: alle Typ-Chips („Alle", „Sehenswürdigkeit", „Stadt & Dorf",
  „Restaurant", „Strand", „Aktivität", „Hotel", „Weltkulturerbe", je ca.
  27 px hoch).
- POI-Liste: die Checkboxen zur Auswahl (13×13 px), der Status-Auswahl
  „Status von …" (28 px hoch), „POI anlegen" (32 px), „Liste ausblenden"
  (30 px), „Suchgebiet zeichnen" (32 px).
- Bewertungsrunde: die fünf Stimm-Radios „Gesetzt", „Wahrscheinlich",
  „Weiß noch nicht", „Wenn wir Zeit haben", „Auf keinen Fall" (je
  13×13 px).

Zusätzlich liegt der Filter-Chip „Weltkulturerbe" bei 1280 px an seiner
Mittelposition unter der Kartenansicht (`canvas[aria-label="Map"]`) —
ausgelöst wird er dort nicht, obwohl er sichtbar erscheint.

# Expected

Jedes Bedienelement im Planer ist bei 1280 px mindestens 44×44 px groß
und an seiner Mittelposition tatsächlich auslösbar — wie es die vier
Regeln in stack.md für alle drei geprüften Breiten verlangen.

# Steps

1. `npm run test:e2e` ausführen (setzt `E2E_CHROMIUM_PATH`, falls kein
   von Playwright mitgeliefertes Chromium vorhanden ist).
2. Jeder der vier Flüsse aus req-047 schlägt an der automatischen
   Bildschirmbreiten-Prüfung (req-049) fehl, sobald er `/plan` öffnet;
   die Meldung listet die betroffenen Elemente einzeln auf (siehe
   „Observed").

# Hinweis

Dies ist eine bewusste Folge von req-049 („Bestehende Verstöße beheben"
ist dort explizit außerhalb des Umfangs) — die Prüfung macht einen
bestehenden Zustand sichtbar, der zuvor unbemerkt blieb. Die Behebung
betrifft mehrere Komponenten (`header.tsx`, die POI-Filter- und
-Listenansicht, die Bewertungs-Stimmen) und ist deshalb als eigener Lauf
sinnvoller als ein Seiteneffekt von req-049.
