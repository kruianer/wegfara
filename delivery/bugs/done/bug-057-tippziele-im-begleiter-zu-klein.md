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

# Behebung

Jedes der vier Elemente hat eine Trefferfläche von mindestens 44×44 px;
gezeichnet wird darin weiterhin das, was vorher zu sehen war.

- `app/go/components/header.module.css`, `.switcher`: `min-height: 44px`.
  Der Knopf zeichnet weder Fläche noch Rahmen, die größere Trefferfläche
  bleibt damit unsichtbar — und die Kopfzeile ist durch die 44 px von
  „Mein Bereich" und „Abmelden" ohnehin so hoch
  (`components/abmelden-button.module.css`). Breit ist er durch `flex: 1`
  immer genug.
- `app/go/components/theme-button.module.css`, `.button`: 44×44 px mit
  `border: 4px solid transparent` — gezeichnet werden darin die gewohnten
  36 px. Damit der Rand unsichtbar bleibt, endet der Hintergrund an der
  Innenkante (`background: … padding-box`) und der sichtbare 1-px-Ring wird
  als innerer Schatten gezeichnet (`box-shadow: inset 0 0 0 1px`); ein
  echter Rand färbte die Trefferfläche mit. Dieselbe Lösung wie beim
  Filter-Chip des Planers (bug-025) und seinen Symbolknöpfen (bug-039). Aus
  `border-radius: 50%` folgt an der Innenkante ein Radius von 18 px — der
  Ring bleibt ein Kreis von 36 px. Er kostet die Kopfzeile 8 px Breite, die
  dem Reisetitel abgehen; mehr ändert sich dort nicht.
- `app/go/components/activity-card.module.css`, `.toggle`:
  `display: inline-flex` mit `min-height: 44px` (und `min-width: 44px` als
  Mindestmaß, breiter ist die Beschriftung ohnehin). Gezeichnet wird allein
  der Text, die Fläche bleibt unsichtbar. Die negativen Abstände
  (`margin: -14px 0 -6px`) fallen in genau diese Fläche: im Layout stehen
  von den 44 px nur 24 px, die Karte wird dadurch 5 px höher statt 31 px.
  Nach oben reicht die Fläche in die letzte Zeile des Kurztexts, was nichts
  verdeckt — ein Tipp dorthin klappt den Langtext auf, und mehr tut der Text
  dort nicht. Nach unten bleiben 4 px bis zum Buchungs-Knopf: eine
  überlagernde Trefferfläche (das Muster aus bug-029) hätte ihn verdeckt,
  genau davor warnt „Expected".
- `app/go/components/activity-option-group.module.css`, `.dot`: 44×44 px,
  gezeichnet wird weiterhin nur der 6-px-Punkt als `::after`. `.dots` steht
  dafür auf `gap: 0` und `margin-top: 0`: den Abstand bringt die Fläche
  selbst mit (sie ragt 19 px über ihren Punkt hinaus), ein eigener käme
  obendrauf. Ein negativer Abstand kommt nicht in Frage — die Flächen
  überlagerten einander, und weil jede sichtbar ihren Punkt zeichnet, wäre
  das eine echte Überlappung (Regel 2, anders als bei den unsichtbaren
  Flächen aus bug-029). Die Punkte stehen dadurch 44 px statt 28 px
  auseinander; klein aussehen tun sie weiter. `flex-wrap: wrap` hält die
  Reihe bei sehr vielen Optionen innerhalb des Rands (Regel 1).
- `tests/e2e/begleiter.e2e.ts` (neu, Fluss 6): öffnet `/go` zu einer
  laufenden Reise mit Programmpunkten und einer Options-Gruppe, wählt die
  zweite Alternative und findet sie nach dem Neuladen wieder. Damit greift
  die Bildschirmbreiten-Prüfung aus req-049 dort von selbst — sie hängt am
  `seite.goto` (siehe `tests/e2e/fixtures.ts`). `tests/e2e/seed.ts` bekommt
  dafür `seedActivity`.

Dabei kamen zwei Fehler der Prüfung selbst heraus, die nur auf einer Seite
auffallen, die länger ist als das Sichtfenster — also auf keiner der bisher
geprüften (`tests/e2e/screen-check.ts`):

- Sie merkte sich die Rechtecke aller Bedienelemente und rollte **mitten in
  dieser Schleife** zum nächsten hin. Danach stimmten die zuvor genommenen
  Werte nicht mehr, und Regel 2 und 3 rechneten mit veralteten Positionen —
  auf `/go` meldete sie „Mehr lesen" bei allen drei Breiten als verdeckt,
  obwohl es frei lag. Jetzt wird erst ausgemessen, ohne zu rollen (ein
  gemeinsames Koordinatensystem, was der paarweise Vergleich voraussetzt),
  und Regel 3 kommt zuletzt: sie holt jedes Element einzeln ins Bild und
  misst dort frisch.
- Was in einer waagerecht wischbaren Leiste gerade neben dem Bild steht —
  die Reisetage, die Karten einer Options-Gruppe —, galt ihr als
  unerreichbar. Erreichbar ist es durch Wischen; gewischt wird aber nicht
  von der Prüfung, denn in der Options-Gruppe wäre das eine Bedienung (sie
  übernimmt die eingerastete Karte als Wahl). Regel 3 überspringt solche
  Elemente deshalb und prüft sie beim nächsten Aufruf, wenn die Leiste
  anders steht. Was `overflow: hidden` wegschneidet, bleibt ein Verstoß —
  dort kann der Nutzer nicht rollen, auch wenn `scrollIntoView` es
  programmatisch hereinholen würde (in Chromium nachgemessen: es rollt auch
  `overflow: hidden`, deshalb rollt die Prüfung jetzt selbst und nur
  senkrecht).

Nicht angefasst: der Buchungs-Knopf (`booking-button.module.css`, rund
26 px hoch). In der Anwendung entsteht er nie als Bedienelement — `booked`
und die Kontaktwege schreibt sie nirgends, der Knopf erscheint nur zu
Demo-Daten und dann als `<span>` „Unterlagen". Er gehört zu keinem der vier
beobachteten Elemente; ein eigener Bug dafür wäre Spekulation über Daten,
die es noch nicht gibt.

# Prüfung

Reproduce-first: der neue E2E-Fluss war ohne die Behebung rot und nannte
genau die vier Elemente — bei allen drei Breiten, gemessen in Chromium:

```
/go bei 375px — Tippziele: button[aria-label="Farbwelt wählen"] (36×36px)
/go bei 375px — Tippziele: button "Mehr lesen" (61×13px)   [3 Karten]
/go bei 375px — Tippziele: button[aria-label="Option 1 von 2"] (22×22px)
/go bei 768px — Tippziele: button "E2E Reise …" (246×38px)
```

Neue Tests, die ohne die Behebung fehlschlagen (11 von 23 am Blatt; jsdom
rechnet kein Layout, geprüft wird deshalb direkt am CSS):

- `app/go/components/header.layout.test.ts`, Abschnitt „Reisetitel als
  Tippziel (bug-057)" — 44 px Mindesthöhe, unsichtbar (keine Fläche, kein
  Rahmen), die Kachel daneben bleibt bei 38 px.
- `app/go/components/theme-button.layout.test.ts` (neu) — 44×44 px
  Trefferfläche bei 36 px gezeichnet, Hintergrund an der Innenkante,
  sichtbarer Ring als innerer Schatten, rund.
- `app/go/components/activity-card.layout.test.ts` (neu) — 44×44 px,
  unsichtbar, die negativen Abstände lassen von den 44 px höchstens 24 px im
  Layout, und der Abstand nach unten bleibt kleiner als der des
  Buchungs-Knopfs: er wird nicht verdeckt.
- `app/go/components/activity-option-group.layout.test.ts` (neu) — 44×44 px
  bei 6 px gezeichnetem Punkt, kein Abstand zwischen den Flächen (keine
  Überlagerung), kein eigener Abstand nach oben, umbrechende Reihe.
- `tests/e2e/bildschirmpruefung.e2e.ts`, drei Fälle zur Prüfung selbst —
  zwei Knöpfe weit unter der Falz sind grün (ohne die Behebung rot), was der
  Nutzer in einer Leiste ins Bild wischt ist erreichbar und die Prüfung
  wischt dabei nicht selbst (`scrollLeft` bleibt 0, ohne die Behebung rot),
  ein verdeckter Knopf unter der Falz wird weiterhin gemeldet (Gegenprobe:
  grün vor und nach der Behebung).

In Chromium nachgemessen (`/go` bei 375 px, Trefferfläche → gezeichnet):
Reisetitel 183×49 px (238×49 px bei 768 px), Farbwelt 44×44 → 36×36 px,
„Mehr lesen" 61×44 px (vorher 61×13 px) bei 233 px hoher Karte (vorher
228 px), Punkte 44×44 → 6×6 px, 44 px von Mitte zu Mitte (vorher 22×22 px
und 28 px), Punktmitte 22 px unter der Karte (vorher 21 px).

Volle Suite grün: 4278 Unit-Tests, 19 E2E-Tests (`npm run test:e2e`, darin
die Bildschirmbreiten-Prüfung aus req-049 bei 375, 768 und 1280 px — jetzt
auch auf dem Begleiter), Lint, Prettier, `tsc --noEmit` und
`npm run build`.
