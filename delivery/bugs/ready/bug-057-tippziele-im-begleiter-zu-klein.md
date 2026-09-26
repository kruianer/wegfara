---
id: bug-057
app: wegfara
req: req-049
priority: normal
created: 2026-09-26
---

# Observed

Im Begleiter (`/go`) sind vier Bedienelemente kleiner als 44×44 px und
verfehlen damit Regel 4 der Bildschirmbreiten aus
[stack.md](../../stack.md) — bei **allen drei** Breiten. Gemessen in
Chromium mit der Prüfung aus req-049 (`tests/e2e/screen-check.ts`):

| Element                                           | gemessen                               |
| ------------------------------------------------- | -------------------------------------- |
| Reisetitel im Kopfbereich (öffnet die Reiseliste) | 191×38 px (375 px), 246×38 px (768 px) |
| „Farbwelt wählen" im Kopfbereich                  | 36×36 px                               |
| „Mehr lesen" am Programmpunkt                     | 61×13 px                               |
| Punkte einer Options-Gruppe („Option 1 von 2")    | 22×22 px                               |

Der Begleiter ist die Sicht für unterwegs — genau hier wird mit dem Finger
bedient.

# Expected

Jedes dieser Elemente hat eine Trefferfläche von mindestens 44×44 px.
Maßgeblich ist die **Trefferfläche, nicht die sichtbare Größe** (vgl.
bug-025, bug-028, bug-029, bug-039): Die Punkte einer Options-Gruppe
sollen weiter klein aussehen, der runde Knopf der Farbwelt weiter 36 px
groß wirken. Die Karten des Zeitstrahls dürfen dabei nicht auseinander
gezogen werden, und keine Fläche darf ein anderes Bedienelement verdecken
(Regel 2 und 3 derselben Vorgabe) — der Buchungs-Knopf steht direkt unter
„Mehr lesen".

# Steps

1. Begleiter öffnen, eine Reise mit Programmpunkten wählen
2. Bei 375 px die vier Elemente oben antippen — Kopfbereich, „Mehr lesen"
   an einer Karte, die Punkte unter einer Options-Gruppe

# Ursache

Nicht gemessen, weil nie geprüft: Die Bildschirmbreiten-Prüfung aus
req-049 läuft automatisch bei jedem `seite.goto` eines E2E-Flusses
(`tests/e2e/fixtures.ts`) — aber **kein einziger Fluss öffnet `/go`**.
Geprüft wurden bisher nur Anmeldeseite und Planer.

Die vier Stellen im CSS:

- `app/go/components/header.module.css`, `.switcher` — ohne Mindesthöhe;
  die 38 px kommen von der Kachel daneben.
- `app/go/components/theme-button.module.css`, `.button` — fest
  `width/height: 36px`. Hier zeichnet der Knopf selbst den Ring, eine
  Vergrößerung auf 44 px verändert also das Aussehen (vgl. bug-025).
- `app/go/components/activity-card.module.css`, `.toggle` — ein reiner
  Textknopf mit `padding: 0`. Eine überlagernde Trefferfläche
  (`TippzielCheckbox`-Muster, bug-029) würde hier den Buchungs-Knopf
  darunter verdecken.
- `app/go/components/activity-option-group.module.css`, `.dot` — 22×22 px
  mit einem 6-px-Punkt als `::after`. Der Knopf zeichnet selbst nichts;
  er darf wachsen, ohne dass sich etwas sichtbar ändert.

# Notes

Gefunden beim Beheben von bug-054 (der Begleiter zeigte den Tagesplan
einer kommenden Reise nicht). Die Verstöße sind **älter** als dieser Fix —
sie stehen genauso an einer laufenden Reise; bug-054 hat nur dafür
gesorgt, dass der Tagesplan auch vor der Reise erscheint.

Beim Beheben gehört ein E2E-Fluss für den Begleiter dazu: Er öffnet `/go`
zu einer Reise mit Programmpunkten und einer Options-Gruppe, womit die
Prüfung aus req-049 dort von selbst greift — bislang ist der Begleiter von
keinem Fluss abgedeckt.
