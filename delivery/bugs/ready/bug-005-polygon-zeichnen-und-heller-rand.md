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

- [ ] Gegeben der Zeichenmodus ist aktiv, wenn ich auf einem
      Touchscreen viermal auf die Karte tippe, dann sind vier
      Eckpunkte gesetzt.
- [ ] Gegeben der Zeichenmodus ist aktiv und drei Punkte sind gesetzt,
      wenn ich auf einem Touchscreen auf den ersten Punkt tippe, dann
      schließt sich die Fläche.
- [ ] Gegeben eine fertige Fläche, wenn ich auf einem Touchscreen einen
      Eckpunkt mit dem Finger ziehe, dann folgt die Fläche.
- [ ] Gegeben der Zeichenmodus ist NICHT aktiv, wenn ich mit dem Finger
      über die Karte wische, dann verschiebt sich der Kartenausschnitt
      weiterhin.
- [ ] Gegeben der Zeichenmodus ist aktiv, wenn ich mit der Maus auf die
      Karte klicke, dann wird weiterhin ein Eckpunkt gesetzt.
- [ ] Gegeben eine beliebige Seite von wegfara, wenn ich sie öffne,
      dann reicht der Hintergrund bis an alle Ränder des Fensters.
- [ ] Gegeben eine beliebige Seite von wegfara, wenn ich sie öffne,
      dann erscheint KEIN heller Rand um den Inhalt.

# Constraints

- Das Verschieben und Zoomen der Karte per Finger muss außerhalb des
  Zeichenmodus unverändert funktionieren.
