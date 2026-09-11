---
id: bug-042
app: wegfara
req: req-012
priority: normal
created: 2026-09-11
---

# Observed

Die Knöpfe auf der Karte nehmen zu viel Platz: „Suchgebiet zeichnen",
„entfernen" und „Liste ausblenden" stehen mit vollem Text da.

# Expected

Alle drei werden zu **Symbolen mit Tooltip** — der Tooltip nennt
weiterhin, was der Knopf tut, sodass die Bedeutung nicht verlorengeht.

Für „Liste ausblenden" passt ein **Vollbild-Symbol** besser als Text: Es
sagt, was geschieht — die Karte nimmt die ganze Breite. Im ausgeblendeten
Zustand zeigt es entsprechend das Gegenteil.

Die Symbole sind Tippziele: mindestens 44×44 px über ihre Trefferfläche
(siehe [stack.md](../../stack.md)), ohne sichtbar größer zu werden als
die übrigen Elemente der Karte.

# Steps

1. Planer öffnen, Bereich POIs
2. Die Knöpfe über der Karte ansehen

# Ursache

Alle drei Knöpfe trugen ihren vollen Satz als Beschriftung und brauchten
deshalb die Breite dieses Satzes:

- `.drawPanel` in `app/plan/components/poi-map.module.css` stand auf
  `width: 220px` — die Breite, die „Suchgebiet zeichnen" und „Suchgebiet
  entfernen" untereinander brauchten. Der Kasten verdeckte damit oben links
  dauerhaft 220 px der Karte, auch wenn gar nicht gezeichnet wurde.
- `.collapseToggle` in `app/plan/components/split-view.module.css` war eine
  Pille mit `padding: 7px 14px` um den Text „Liste ausblenden" — unten
  rechts rund 130 px breit.

# Behebung

Alle drei tragen jetzt ein Symbol; was sie tun, nennt weiterhin ihr Tooltip
(`title`) und, für Vorlesegeräte, ihr `aria-label` — wörtlich wie die
bisherige Beschriftung, sodass die Bedeutung nicht verlorengeht. Dieselbe
Lösung wie bei den Aktionen der Filterzeile (bug-040).

- `components/icons.tsx`: drei neue Symbole. `PolygonIcon` (eine Fläche mit
  den Griffen an ihren Ecken) für „Suchgebiet zeichnen", `FullscreenIcon`
  (die vier Ecken nach außen) für „Liste ausblenden" und
  `FullscreenExitIcon` (die vier Ecken nach innen) für „Liste einblenden" —
  im ausgeblendeten Zustand zeigt der Knopf damit das Gegenteil. „Suchgebiet
  entfernen" nimmt den vorhandenen `TrashIcon`.
- `app/plan/components/poi-map.tsx`: die beiden Knöpfe stehen nebeneinander
  in `.drawActions` statt untereinander. Der Satz steht einmal als
  `zeichnenLabel` und geht von dort in `title` und `aria-label`; am
  Zeichenmodus selbst ändert sich nichts (`aria-pressed`, Escape, Griffe).
- `app/plan/components/split-view.tsx`: derselbe Schnitt als
  `umschaltenLabel`. Das Sichtbare liegt in einem `.collapseChip` im Knopf —
  nötig, weil die Glasscheibe (`backdrop-filter`) über die ganze Fläche des
  Knopfes wirkt und einen durchsichtigen Rand als 44 px großen Kreis
  sichtbar machen würde.
- Tippziele: die Trefferfläche ist bei allen drei 44×44 px (stack.md,
  Bildschirmbreiten, Regel 4), gezeichnet werden darin 30×30 px — die
  gewohnte Höhe der übrigen Bedienelemente des Planers. Bei den
  Karten-Symbolen sind die äußeren 7 px ein durchsichtiger Rand, der allein
  die Trefferfläche trägt; damit er unsichtbar bleibt, endet der Hintergrund
  an der Innenkante (`padding-box`) und der sichtbare 1-px-Rand wird als
  innerer Schatten gezeichnet (`box-shadow: inset 0 0 0 1px`). Beim
  Umschalter trägt der Knopf die 44 px und der Chip die sichtbaren 30 px.
  Damit sind die Symbole Tippziele, ohne sichtbar größer zu sein als die
  übrigen Elemente der Karte.
- `.drawPanel` hat keine feste Breite mehr: der Kasten ist so breit wie das,
  was in ihm steht — zwei Symbole nebeneinander (92 px statt 220 px), beim
  Zeichnen der Hinweis darunter.
- Unverändert bleibt der Hinweis „Zeichenmodus aktiv — …": er erklärt eine
  Geste, dafür gibt es kein Symbol. Er steht weiterhin nur während des
  Zeichnens.

# Prüfung

Neuer Abschnitt „Kartenknoepfe als Symbole (bug-042)" in
`app/plan/components/poi-map.test.tsx` (vier Tests) und
`app/plan/components/poi-map.layout.test.ts` (vier Tests), Abschnitt
„Vollbild-Symbol statt Text (bug-042)" in
`app/plan/components/split-view.test.tsx` (drei Tests) und
`app/plan/components/split-view.layout.test.ts` (drei Tests).

Dreizehn von vierzehn sind ohne die Behebung rot (nachgestellt mit
`git stash` auf die beiden .tsx und die beiden .css): die Knöpfe tragen
Text statt eines `svg`, nennen ihn nicht im `title`, der Umschalter zeigt
im ausgeblendeten Zustand dieselbe Form, und im CSS fehlen die 44 px
Trefferfläche bei 30 px sichtbarer Größe, die Symbole nebeneinander, die
freie Breite des Bedienfeldes und das Glas im Chip. Der vierzehnte ist ein
Wächter: der Hinweis zum Zeichenmodus bleibt Text und war auch vorher
schon grün.

Volle Suite grün: 3639 Unit-Tests in 304 Dateien (`npm test`), dazu
`npm run lint`, `npx prettier` und `npx tsc --noEmit`.

Nicht gelaufen: `npm run test:e2e` und das Nachmessen im echten Browser —
auf dieser Maschine fehlen PostgreSQL und Docker, die das Kommando
braucht. Die Bildschirmbreiten-Prüfung aus req-049 (375/768/1280 px auf
der POI-Ansicht) ist damit für diese Änderung offen; sie sollte vor der
Promotion nach prod einmal laufen. Wie die Symbole tatsächlich aussehen,
ist erst auf der dev-URL zu sehen.
