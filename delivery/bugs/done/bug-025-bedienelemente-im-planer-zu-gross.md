---
id: bug-025
app: wegfara
req: req-049
priority: normal
created: 2026-09-10
---

# Observed

Seit der Umstellung auf die Mindestgröße für Tippziele sind Bedienelemente
im Planer unnatürlich groß geworden:

- In der POI-Ansicht sind die Checkboxen unnatürlich groß und passen gar
  nicht ins Bild.
- In der Legende der Karte ebenso.
- Die Filter-Chips im POI-Bereich sind zu hoch.

# Expected

Die Elemente sehen wieder normal aus — Checkboxen in gewohnter Größe,
Filter-Chips in gewohnter Höhe.

Die Regel „Tippziele mindestens 44×44 px" aus [stack.md](../../stack.md)
gilt weiterhin. Sie lässt sich erfüllen, ohne das sichtbare Element
aufzublähen: Die Trefferfläche darf größer sein als das, was man sieht —
etwa über einen unsichtbaren Rand um das Element oder eine vergrößerte
Fläche des zugehörigen Labels.

# Steps

1. Planer öffnen, Bereich POIs
2. Checkboxen in der Liste und die Filter-Chips darüber ansehen
3. Die Legende der Karte daneben ansehen

# Ursache

bug-024 erfüllte die 44×44-px-Regel, indem es die Elemente selbst so groß
machte: die nativen Ankreuzboxen bekamen `width/height: 44px`, die
Filter-Chips `min-height: 44px`. Damit wuchs auch das Sichtbare mit — die
Ankreuzbox des Browsers malt sich über ihre ganze Fläche (13×13 px waren
der Standard, jetzt 44×44 px), der Chip zog seinen Hintergrund und Rand
über die volle Höhe.

Ein unsichtbarer Rand allein hilft bei der nativen Ankreuzbox nicht: sie
füllt auch Rand und Innenabstand aus. Nachgemessen in Chromium — ein
`input[type=checkbox]` mit `44×44 px` und `border: 13px solid transparent`
wird unverändert 44 px groß gezeichnet. Beim Chip dagegen genügt der
unsichtbare Rand, sobald Hintergrund und sichtbarer Rand nicht mehr über
ihn hinauslaufen.

Verkleinern per `transform: scale()` oder `zoom` scheidet aus: beides
verkleinert auch das, was `getBoundingClientRect` liefert — die
Trefferfläche wäre damit wieder zu klein, und die
Bildschirmbreiten-Prüfung (req-049) meldete zu Recht Regel 4.

# Behebung

Die Trefferfläche bleibt 44×44 px, gezeichnet wird darin nur das gewohnte
kleine Element.

- Neu: `components/tippziel-checkbox.tsx` mit
  `tippziel-checkbox.module.css` — eine Ankreuzbox, deren Eingabefeld
  unsichtbar die vollen 44×44 px einnimmt (es bleibt das Element, das
  Maus, Finger und Tastatur bedienen) und die darüber ein 18-px-Kästchen
  zeichnet. Das Kästchen ist `pointer-events: none`, damit an der
  Mittelposition das Eingabefeld liegt und nicht es selbst (Regel 3 der
  Prüfung aus req-049). Angekreuzter Zustand, Haken, Tastatur-Fokus und
  der abgeschaltete Zustand hängen am Kästchen (`.input:checked + .box`).
  Sie liegt in `components/`, weil beide Bereiche sie brauchen können.
- `app/plan/components/poi-list.tsx`: die Ankreuzbox der Zeile und „Alle
  POIs auswählen" kommen jetzt von dort; `.rowCheckbox` und
  `.bannerCheckbox` entfallen.
- `app/plan/components/poi-map.tsx`: die fünf Status-Schalter der Legende
  ebenso; `.statusFilterSwitch` entfällt. Das Bedienfeld ist wieder
  242 px breit statt der 270 px, die die großen Schalter brauchten.
- `app/plan/components/poi-list.module.css`, `.chip`: die 44 px kommen
  jetzt aus einem `border: 8px solid transparent`. Damit dieser Rand auch
  unsichtbar bleibt, endet der Hintergrund an der Innenkante
  (`background: var(--field) padding-box`) und der sichtbare 1-px-Rand
  wird als innerer Schatten gezeichnet (`box-shadow: inset 0 0 0 1px`) —
  ein echter Rand färbte die Trefferfläche mit. Sichtbar bleiben davon
  28 px Höhe wie vor bug-024.
  Der Abstand zwischen den Chips kommt aus diesem Rand, deshalb steht die
  Filterleiste auf `gap: 0` und der untere Innenabstand von Überschrift
  und Filterleiste ist um dieselben 8 px kleiner — sonst addierte sich
  beides. Ein negativer Abstand kommt nicht in Frage: dann überlappten
  sich die Trefferflächen und die Prüfung meldete Regel 2.

Nicht angefasst wurden die übrigen Elemente aus bug-024 (Kopfbereich,
„POI anlegen", die Verweise Google/Website/Maps, die Status-Auswahl,
„Suchgebiet zeichnen", die Anmeldeseite): Knöpfe und Auswahlfelder in
44 px Höhe sind gewohnte Größen — beobachtet wurden allein die
Ankreuzboxen und die Chips.

# Prüfung

Neue Tests, die ohne die Behebung fehlschlagen:

- `components/tippziel-checkbox.layout.test.ts` — Trefferfläche 44×44 px,
  Eingabefeld unsichtbar über der ganzen Fläche, sichtbares Kästchen
  höchstens 20 px, Klicks gehen durch das Kästchen hindurch.
- `components/tippziel-checkbox.test.tsx` — bleibt eine gewöhnliche
  Ankreuzbox (Rolle, Beschriftung, Ankreuzen), reicht `role="switch"`
  durch, das die Legende der Karte nutzt.
- `app/plan/components/poi-list.layout.test.ts`, neuer Abschnitt
  „sichtbare Größe der Bedienelemente (bug-025)" — der Chip ist kleiner
  gezeichnet als seine Trefferfläche, die Liste baut keine 44×44 px
  großen Ankreuzboxen mehr selbst.
- `app/plan/components/poi-map.layout.test.ts`, neuer Abschnitt
  „sichtbare Größe der Legende (bug-025)".

Die Tests aus bug-024 zu den Ankreuzboxen und Schaltern sind durch die
neuen ersetzt — sie forderten genau das, was hier zurückgenommen wird;
die 44 px halten jetzt die Tests der `TippzielCheckbox` fest.

Volle Suite grün: 2971 Unit-Tests, 11 E2E-Tests (`npm run test:e2e`,
darin die Bildschirmbreiten-Prüfung aus req-049 bei 375, 768 und
1280 px), Lint und `tsc --noEmit`. Zusätzlich in Chromium nachgemessen:
alle Bedienelemente der POI-Ansicht und der Legende sind weiterhin
mindestens 44×44 px groß und an ihrer Mittelposition auslösbar.
