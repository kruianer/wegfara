---
id: bug-039
app: wegfara
req: req-060
priority: normal
created: 2026-09-11
---

# Observed

In der POI-Ansicht sind die Knöpfe in der Filterzeile zu hoch — ebenso
die beim Anlegen eines POI.

# Expected

Sie sind genauso hoch wie der Knopf „Bewertungsrunde starten", der die
richtige Höhe hat. Alle Bedienelemente dieser beiden Zeilen wirken damit
als eine Reihe.

Die Regel „Tippziele mindestens 44×44 px" aus [stack.md](../../stack.md)
gilt weiterhin — über die Trefferfläche, nicht über die sichtbare Höhe
(vgl. bug-025, bug-028, bug-029).

# Steps

1. Planer öffnen, Bereich POIs
2. Die Filterzeile und die Zeile zum Anlegen mit dem Knopf
   „Bewertungsrunde starten" vergleichen

# Ursache

Dieselbe wie bei bug-025 und bug-028, an den beiden Zeilen über der Liste:
bug-024 erfüllte die 44×44-px-Regel, indem es das sichtbare Element selbst
so groß machte. `min-height: 44px` steht seither an den drei Auswahllisten
der Filterzeile (`.filterSelect`) und an Feld und Knöpfen der Anlegezeile
(`.input`, `.aiButton`, `.createButton`) — Hintergrund und Rand laufen über
die volle Höhe mit. Gemessen in Chromium: 44 px, wo der Knopf
„Bewertungsrunde starten" in der Leiste darunter 30 px hoch ist.

Dazu kam ein Pixel aus einer anderen Ecke: `.bannerButton` und
`.bannerDangerButton` trugen als einzige Bedienelemente dieser Ansicht kein
`font-family: inherit`. Ein Knopf nimmt ohne diese Angabe die Schrift des
Browsers (Arial) statt der der Anwendung (Figtree) — beide waren damit 29 px
hoch statt 30 px, und ihre Beschriftung stach aus der Ansicht heraus.

# Behebung

Die Trefferfläche bleibt 44 px hoch, gezeichnet werden darin 30 px — die
Höhe des Knopfs „Bewertungsrunde starten". Alle Bedienelemente der beiden
Zeilen stehen damit in einer Reihe.

- `app/plan/components/poi-list.module.css`, `.filterSelect`, und
  `app/plan/components/poi-anlegezeile.module.css`, `.input` sowie
  `.aiButton`/`.createButton`: die 44 px kommen aus einem
  `border: 7px solid transparent` oben und unten. Damit dieser Rand
  unsichtbar bleibt, endet der Hintergrund an der Innenkante
  (`background: … padding-box`) und der sichtbare 1-px-Rand wird als innerer
  Schatten gezeichnet (`box-shadow: inset 0 0 0 1px`) — ein echter Rand
  färbte die Trefferfläche mit. Dieselbe Lösung wie beim Filter-Chip
  (bug-025), den Verweisen der Zeile (bug-028) und dem Löschen-Symbol
  (req-060). Seitlich trägt keines der Elemente einen solchen Rand:
  Beschriftung und Feldbreite machen sie ohnehin breiter als 44 px.
- Die Abstände um die beiden Zeilen zehren den unsichtbaren Rand auf, damit
  sie aussehen wie zuvor: `.filterRow` steht auf `gap: 0 12px` (senkrecht
  kommt der Abstand beim Umbruch aus dem Rand selbst, ein eigener käme
  obendrauf) und `padding: 0 22px 3px` statt 10 px; `.controls` bekommt
  `gap: 0 8px` und `margin-bottom: -7px`, `.bar` dafür 7 px statt 13 px
  Abstand nach unten. Der negative Abstand fällt in den unsichtbaren Rand
  und schiebt kein Bedienelement unter ein anderes — die
  Bildschirmbreiten-Prüfung (req-049) bleibt still.
- `.bannerButton` und `.bannerDangerButton` bekommen `font-family: inherit`
  und damit die Schrift der Anwendung. Ihre Maße bleiben unverändert; die
  Schrift macht sie genau 30 px hoch, exakt so hoch wie die beiden Zeilen
  darüber jetzt gezeichnet werden.

# Prüfung

Neue Abschnitte „sichtbare Größe der Filterzeile (bug-039)" in
`app/plan/components/poi-list.layout.test.ts` und „sichtbare Größe der Zeile
(bug-039)" in `app/plan/components/poi-anlegezeile.layout.test.ts` — zehn
Tests, davon neun ohne die Behebung rot: die Elemente werden 30 px hoch
gezeichnet (Hintergrund an der Innenkante, sichtbarer Rand als innerer
Schatten), die Trefferfläche bleibt 44 px, der unsichtbare Rand sitzt nur
oben und unten, das Überfahrene färbt nur seinen sichtbaren Teil, die
Abstände addieren sich nicht auf den Rand, und der Knopf
„Bewertungsrunde starten" behält Innenabstand und Schriftgröße als Maß.

Volle Suite grün: 3427 Unit-Tests, 13 E2E-Tests (`npm run test:e2e`, darin
die Bildschirmbreiten-Prüfung aus req-049 bei 375, 768 und 1280 px auf der
POI-Ansicht), Lint, Prettier und `tsc --noEmit`.

Zusätzlich im echten Browser nachgemessen (Chromium, `/plan`, Bereich
POIs): Eingabefeld, „Mit KI suchen", „POI anlegen" und alle drei
Auswahllisten des Filters haben 44 px Trefferfläche bei 30 px sichtbarer
Höhe; „Bewertungsrunde starten" und „Ausgewählte löschen" messen dieselben
30 px. Vor der Behebung waren es 44 px gegen 29 px.
