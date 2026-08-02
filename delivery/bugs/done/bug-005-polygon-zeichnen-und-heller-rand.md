---
id: bug-005
title: Suchgebiet lässt sich per Finger nicht zeichnen, heller Rand um die Seite
app: wegfara
area: Planung
severity: high
created: 2026-08-02
relates: req-012, req-009
---

# Beobachtung

Zwei Punkte, beide auf dem Touchscreen aufgefallen:

**1. Zeichnen funktioniert nicht.** Im Bereich „POIs" ist der
Zeichenmodus aktiv (die Schaltfläche wurde gedrückt, der Modus ist
erkennbar), aber ein Tippen mit dem Finger auf die Karte setzt keinen
Eckpunkt. Es passiert nichts.

**2. Heller Rand.** Um die gesamte Seite läuft ein heller Rand, als
läge der Inhalt in einem weißen Kasten.

# Erwartet

**1.** Ein Tippen auf die Karte setzt einen Eckpunkt, wie mit der Maus
(siehe req-012).

**2.** Der dunkle Hintergrund reicht bis an alle Ränder des Fensters.

# Ursache (Analyse)

**Zum Zeichnen.** `app/plan/components/poi-map.tsx` registriert für das
Setzen der Eckpunkte ausschließlich `map.on("click", …)`. Auf einem
Touchscreen behandelt die Kartenbibliothek eine Berührung zunächst als
mögliche Geste zum Verschieben oder Zoomen. Ein kurzes Tippen wird
dabei verworfen, ohne dass ein Klick-Ereignis entsteht — mit der Maus
tritt das Problem nicht auf.

Zusätzlich fehlt der Kartenfläche eine Angabe, wie Berührungen zu
behandeln sind (`touch-action`), sodass der Browser eigene Gesten
darüberlegt.

**Zum hellen Rand.** `app/layout.tsx` liefert kein Stylesheet für
`html` und `body`; eine globale CSS-Datei existiert nicht. Der Browser
setzt daher seinen Standardabstand von 8 Pixeln am `body` und zeigt
darunter seinen hellen Standardhintergrund. Der dunkle Hintergrund der
Anwendung beginnt erst innerhalb dieses Abstands.

# Reproduktion

**Zeichnen:**

1. https://dev.wegfara.com/plan auf einem Gerät mit Touchscreen öffnen
2. Bereich „POIs" wählen
3. Schaltfläche zum Zeichnen des Suchgebiets antippen
4. Mit dem Finger auf die Karte tippen

Ergebnis: Es entsteht kein Eckpunkt.

**Rand:** Beliebige Seite von wegfara öffnen — außen umlaufend ein
heller Rand.

# Akzeptanzkriterien der Behebung

- [x] Gegeben der Zeichenmodus ist aktiv, wenn ich auf einem
      Touchscreen viermal auf die Karte tippe, dann sind vier
      Eckpunkte gesetzt.
- [x] Gegeben der Zeichenmodus ist aktiv und drei Punkte sind gesetzt,
      wenn ich auf einem Touchscreen auf den ersten Punkt tippe, dann
      schließt sich die Fläche.
- [x] Gegeben eine fertige Fläche, wenn ich auf einem Touchscreen einen
      Eckpunkt mit dem Finger ziehe, dann folgt die Fläche.
- [x] Gegeben der Zeichenmodus ist NICHT aktiv, wenn ich mit dem Finger
      über die Karte wische, dann verschiebt sich der Kartenausschnitt
      weiterhin.
- [x] Gegeben der Zeichenmodus ist aktiv, wenn ich mit der Maus auf die
      Karte klicke, dann wird weiterhin ein Eckpunkt gesetzt.
- [x] Gegeben eine beliebige Seite von wegfara, wenn ich sie öffne,
      dann reicht der Hintergrund bis an alle Ränder des Fensters.
- [x] Gegeben eine beliebige Seite von wegfara, wenn ich sie öffne,
      dann erscheint KEIN heller Rand um den Inhalt.

# Constraints

- Das Verschieben und Zoomen der Karte per Finger muss außerhalb des
  Zeichenmodus unverändert funktionieren.

# Behebung

- `app/plan/components/poi-map.tsx`: Im Zeichenmodus setzt jetzt neben
  `map.on("click", …)` zusätzlich ein Paar aus `map.on("touchstart", …)`
  und `map.on("touchend", …)` einen Eckpunkt. Bewegt sich der Finger
  zwischen beiden Ereignissen um mehr als 8 Pixel, gilt es als
  Wischgeste (Verschieben der Karte) statt als Tipp und es wird kein
  Punkt gesetzt — das hält AC4 (Verschieben außerhalb des Zeichenmodus
  bleibt ohnehin unberührt, da der Handler nur im Zeichenmodus
  registriert ist) und die Unterscheidung Tipp/Wischen innerhalb des
  Zeichenmodus ein. `MapTouchEvent` liefert dafür wie `MapMouseEvent`
  bereits `lngLat` sowie zusätzlich `point` (Pixelkoordinate), siehe
  `maplibre-gl.d.ts`.
- `app/plan/components/poi-map.module.css`: `.map` erhält
  `touch-action: none`, damit der Browser eine Berührung auf der
  Kartenfläche vollständig an MapLibre weiterreicht, statt sie zunächst
  selbst als Scroll-/Zoom-Geste zu interpretieren.
- `app/globals.css` (neu) mit einem Reset für `html, body` (Marge 0,
  dunkler Seitenhintergrund `#0c0f1e` als Fallback), eingebunden über
  `app/layout.tsx`. Verhindert den 8px-Standardabstand des Browsers am
  `body` und dessen hellen Standardhintergrund darunter; `app/go` hat
  kein eigenes `<body>` (verschachteltes Layout), der Fix greift daher
  für beide Bereiche.
- Tests (reproduce-first, vor dem Fix verifiziert fehlschlagend):
  - `tests/mocks/maplibre-gl.ts`: `simulateTouchTap` und
    `simulateTouchPan` bilden Tipp- bzw. Wischgesten im Test-Double der
    Kartenbibliothek nach.
  - `app/plan/components/poi-map.test.tsx`: neue Suite „Zeichnen per
    Finger auf dem Touchscreen (bug-005)" deckt vier getippte
    Eckpunkte samt Schließen der Fläche ab sowie, dass eine
    Wischbewegung keinen Punkt setzt.
  - `app/plan/components/poi-map.layout.test.ts` (neu) prüft
    `touch-action: none` direkt am CSS (jsdom führt kein CSS aus).
  - `app/layout.test.ts` (neu) prüft den Import von `globals.css` in
    `layout.tsx` sowie Marge und Hintergrund der `body`-Regel direkt am
    CSS, nach demselben Muster wie
    `app/go/go-view.layout.test.ts` (bug-001).
- Volle Suite (411 Tests), Typecheck, Lint und Build sind grün (die
  drei bestehenden Lint-Fehler in `delivery/design/planer/*` sind
  unverändert vorbestehend und nicht Teil dieser Änderung).
