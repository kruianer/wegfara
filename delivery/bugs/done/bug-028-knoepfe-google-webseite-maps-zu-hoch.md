---
id: bug-028
app: wegfara
req: req-049
priority: normal
created: 2026-09-10
---

# Observed

Die Schaltflächen für Google, Webseite und Maps sind zu hoch — sie passen
nicht zu den übrigen Bedienelementen.

# Expected

Sie sehen wieder normal aus, in gewohnter Höhe.

Die Regel „Tippziele mindestens 44×44 px" aus [stack.md](../../stack.md)
gilt weiterhin. Sie lässt sich erfüllen, ohne das sichtbare Element
aufzublähen: Die Trefferfläche darf größer sein als das, was man sieht —
etwa über einen unsichtbaren Rand um das Element. Dieselbe Lösung wie bei
bug-025.

# Steps

1. Planer öffnen, Bereich POIs
2. Einen POI mit Webadresse und Google-Ort ansehen
3. Die Schaltflächen Google, Webseite und Maps sind zu hoch

# Ursache

Dieselbe wie bei bug-025, an einer Stelle, die dort ausgenommen blieb:
bug-024 erfüllte die 44×44-px-Regel, indem es das sichtbare Element selbst
so groß machte — `.linkPill` in `app/plan/components/poi-list.module.css`
bekam `min-height: 44px`. Hintergrund und Rand des Verweises liefen über
die volle Höhe mit, aus 26 px wurden 44 px. bug-025 nahm das für die
Ankreuzboxen und die Filter-Chips zurück, ließ die Verweise aber stehen
(„Knöpfe in 44 px Höhe sind gewohnte Größen") — beobachtet wurde jetzt
das Gegenteil.

# Behebung

Die Trefferfläche bleibt 44 px hoch, gezeichnet wird darin nur der gewohnte
flache Verweis — wie beim Filter-Chip aus bug-025.

- `app/plan/components/poi-list.module.css`, `.linkPill`: die 44 px kommen
  aus einem `border: 9px solid transparent` oben und unten. Damit dieser
  Rand unsichtbar bleibt, endet der Hintergrund an der Innenkante
  (`background: var(--field) padding-box`) und der sichtbare 1-px-Rand wird
  als innerer Schatten gezeichnet (`box-shadow: inset 0 0 0 1px`) — ein
  echter Rand färbte die Trefferfläche mit. Sichtbar bleiben 26 px Höhe,
  genau wie vor bug-024.
  Seitlich trägt der Verweis keinen solchen Rand: seine Beschriftung macht
  ihn ohnehin breiter als 44 px, und ein seitlicher Rand zöge die drei
  Verweise nur auseinander. `min-width: 44px` hält die Breite auch bei einer
  kürzeren Beschriftung.
- `.rowLinks`: waagerecht bleibt der Abstand von 7 px, senkrecht steht er
  auf 0 (`gap: 0 7px`) — beim Umbruch kommt er aus dem unsichtbaren Rand
  der Verweise, ein eigener käme obendrauf. Der Abstand nach oben entfällt
  (`margin-top: 0`) und der nach unten wird um dieselben 9 px negativ
  (`margin-bottom: -9px`); beides zehrt genau den unsichtbaren Rand auf, so
  dass die Zeile aussieht wie zuvor. Der negative Abstand fällt in den
  leeren Innenabstand der Zeile und schiebt kein Bedienelement unter ein
  anderes — anders als ein negativer `gap`, der die Trefferflächen
  überlappen ließe und in der Bildschirmbreiten-Prüfung (req-049) Regel 2
  meldete.

# Prüfung

Neuer Abschnitt in `app/plan/components/poi-list.layout.test.ts`,
„sichtbare Größe der Verweise (bug-028)" — fünf Tests, die ohne die
Behebung fehlschlagen: der Verweis wird flacher gezeichnet als seine
Trefferfläche (Hintergrund an der Innenkante, sichtbarer Rand als innerer
Schatten), die Trefferfläche bleibt 44×44 px, der überfahrene Verweis färbt
nur seinen sichtbaren Teil, der unsichtbare Rand sitzt nur oben und unten,
und die Abstände um die Verweise addieren sich nicht auf ihn.

Volle Suite grün: 3032 Unit-Tests, 11 E2E-Tests (`npm run test:e2e`, darin
die Bildschirmbreiten-Prüfung aus req-049 bei 375, 768 und 1280 px), Lint,
Prettier und `tsc --noEmit`. Zusätzlich in Chromium nachgemessen: die
Trefferfläche ist 44 px hoch und an ihrer Mittelposition auslösbar,
gezeichnet werden davon 26 px, der Abstand zum Text darüber sind wieder
9 px und der zwischen zwei Verweisen 7 px.
