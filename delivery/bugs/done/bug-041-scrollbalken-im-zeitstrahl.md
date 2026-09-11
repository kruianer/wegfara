---
id: bug-041
app: wegfara
req: req-011
priority: normal
created: 2026-09-11
---

# Observed

Im Zeitstrahl heben sich die senkrechten Scrollbalken vom Rest ab.

# Expected

Sie tragen die Hintergrundfarbe der Spalte, in der sie liegen, und fügen
sich damit ein — statt als helle oder dunkle Leiste aufzufallen.

Das gilt in beiden Farbwelten (hell und dunkel, req-007): Der Balken
nimmt die Farbe seiner Umgebung an, nicht einen festen Wert.

# Steps

1. Planer öffnen, Bereich Planung
2. Einen Reisetag wählen, dessen Zeitstrahl über die Höhe hinausreicht
3. Der senkrechte Scrollbalken hebt sich ab

# Ursache

Die rollenden Flächen der Planung sagten zu ihrer Bildlaufleiste nichts —
`.scroll` in `app/plan/components/timeline-column.module.css` und `.list`
in `app/plan/components/unplanned-column.module.css` trugen allein
`overflow-y: auto`. Dann zeichnet der Browser seine eigene Leiste, und die
bringt ihre Farbe selbst mit: eine helle Rille mit grauem Griff in einer
Ansicht, die durchgehend dunkel ist (Farbwelt „Indigo-Nacht"). Neben der
Spalte stand damit ein Streifen in einer Farbe, die sonst nirgends in der
Ansicht vorkommt.

Dass es auch anders geht, zeigte die POI-Liste: sie färbt ihre Leiste seit
bug-016 selbst (`scrollbar-color`, `::-webkit-scrollbar*` in
`poi-list.module.css`) — nur galt das eben nur dort.

Dasselbe gilt für den Zeitstrahl des Begleiters (`.content` in
`app/go/go-view.module.css`): auf einem breiten Bildschirm steht auch dort
die Standard-Leiste, und weil der Begleiter zehn Farbwelten kennt
(req-007), passt kein fester Wert.

# Behebung

Ein gemeinsames Blatt `components/bildlauf.module.css` mit der Klasse
`.bildlauf`. Es nennt keine einzige Farbe, sondern zieht beide aus
Variablen, die die rollende Fläche selbst setzt:

- `--bildlauf-rille` — der Hintergrund der Fläche, in der die Leiste
  liegt. Ist sie nicht gesetzt, bleibt die Rille durchsichtig und zeigt
  die Fläche selbst; der helle Standard des Browsers kommt nie zurück.
- `--bildlauf-griff` — die Farbe des Griffs, gewohnt die Rahmenfarbe der
  Umgebung. Er steht nicht bis an die Kante: ein durchsichtiger Rand von
  2 px zeigt die Rille und lässt ihn schmaler wirken.

Gesetzt wird beides über `scrollbar-color` (Firefox) und die
`::-webkit-scrollbar`-Pseudoelemente (WebKit, Chromium) — ohne beides
bliebe in einem der beiden Browser der Standard stehen.

Die Klasse tragen die drei senkrecht rollenden Flächen des Zeitstrahls;
jede setzt die zwei Variablen auf ihre eigenen Farben:

- `timeline-column.module.css` `.scroll`: `var(--card-alt)` — der
  Hintergrund der Spalte „Zeitstrahl" — und `var(--bd)`.
- `unplanned-column.module.css` `.list`: `var(--card)` — der Hintergrund
  der Spalte „Noch unverplant" — und `var(--bd)`.
- `go-view.module.css` `.content`: `var(--bg)` — der Hintergrund des
  Begleiters (`.app`) — und `var(--line)`. Beide kommen aus der gewählten
  Farbwelt (req-007) und färben die Leiste damit in jeder der zehn mit,
  ohne dass eine davon einen eigenen Wert braucht.

Das Blatt liegt unter `components/`, weil Planer und Begleiter es teilen
und einander nicht kennen dürfen (siehe [stack.md](../../stack.md)) — wie
`components/cards.module.css` und `components/dialog.module.css`.

Unverändert bleibt die POI-Liste: ihre Leiste ist seit bug-016 schon
eingefärbt und fiel nicht auf.

# Prüfung

Neu: `components/bildlauf.layout.test.ts` (zehn Tests). Vier prüfen das
gemeinsame Blatt — Rille und Griff kommen aus den Variablen, das Blatt
enthält keinen Farbwert (kein `#…`, kein `rgb(…)`), beide Browser-Wege
sind bedient, und ohne gesetzte Rille bleibt sie durchsichtig. Sechs
prüfen je Fläche (Zeitstrahl des Planers, „Noch unverplant", Zeitstrahl
des Begleiters), dass die Rille genau den Hintergrund ihrer Umgebung trägt
— gelesen aus der Regel der Umgebung selbst, nicht fest eingetippt — und
dass auch der Griff aus einer Variablen kommt.

Dazu je ein Test in `app/plan/components/planung-view.test.tsx` und
`app/go/go-view.test.tsx`, dass die Klasse auf der rollenden Fläche auch
ankommt.

Alle zwölf sind ohne die Behebung rot (nachgestellt mit `git stash` auf
die beiden .tsx und die drei .css): das Blatt fehlt, und die rollenden
Flächen tragen nur ihre eigene Klasse.

Volle Suite grün: 3570 Unit-Tests in 300 Dateien (`npm test`), dazu
`npm run lint`, `npx prettier` und `npx tsc --noEmit`.

Nicht gelaufen: `npm run test:e2e` und das Nachsehen im echten Browser —
auf dieser Maschine fehlen PostgreSQL und Docker, die das Kommando
braucht. Wie die Leiste tatsächlich aussieht, ist damit erst auf der
dev-URL zu sehen; geprüft ist hier nur, dass sie ihre Farben aus der
Umgebung nimmt.
