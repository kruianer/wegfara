---
id: bug-031
app: wegfara
req: req-010
priority: normal
created: 2026-09-10
---

# Observed

Die Trennleiste in der Mitte des Bildschirms zwischen POI-Liste und Karte
lässt sich nicht mit dem Finger verschieben.

# Expected

Sie lässt sich auch mit dem Finger ziehen — so wie mit der Maus. Auf dem
iPad ist der Finger der einzige Weg.

Wie bei bug-017 und bug-023: Ziehen muss über Zeiger-Ereignisse laufen,
nicht nur über Maus-Ereignisse. Die Greiffläche der Leiste muss dabei
groß genug sein, um sie mit dem Finger zu treffen (44 px, siehe
[stack.md](../../stack.md)) — ohne dass die Leiste selbst dicker aussieht.

# Steps

1. Planer auf dem iPad öffnen, Bereich POIs
2. Die Trennleiste zwischen Liste und Karte mit dem Finger ziehen
3. Es passiert nichts

# Ursache

Die Trennleiste hing ausschließlich an Maus-Ereignissen: `mousedown` an
der Leiste, `mousemove` und `mouseup` am Fenster
(`app/plan/components/split-view.tsx`).

Zum Finger schickt Safari auf dem iPad kein `mousemove` — es entsteht
allenfalls ein nachgereichter Klick, nachdem der Finger schon wieder weg
ist. Die Anwendung bekam vom Ziehen also nichts mit, und die Leiste
blieb stehen. Es ist derselbe Mechanismus wie bei bug-017 und bug-023,
dort für das Ziehen der POIs.

Dazu kommt die Greiffläche: Die Leiste ist acht Pixel breit. Selbst mit
Zeiger-Ereignissen wäre sie mit dem Finger kaum zu treffen — verlangt
sind 44 Pixel (siehe [stack.md](../../stack.md)).

# Behebung

Gezogen wird jetzt über Zeiger-Ereignisse, die von Maus, Finger und
Stift gleichermaßen kommen (`app/plan/components/split-view.tsx`):
`pointerdown` an der Leiste, `pointermove`, `pointerup` und
`pointercancel` am Fenster.

- Ab dem Aufnehmen gehört der Zeiger der Leiste
  (`setPointerCapture`) — der Zug läuft weiter, auch wenn der Finger die
  schmale Leiste längst verlassen hat.
- Der Zug merkt sich, welcher Zeiger ihn führt: ein zweiter Finger
  übernimmt ihn nicht.
- Nimmt der Browser den Zeiger an sich (`pointercancel`), endet der Zug
  wie beim Loslassen.
- Mindestbreite der Liste und der Platz, der der Karte am rechten Rand
  bleibt, gelten unverändert.

Die Greiffläche (`split-view.module.css`) wächst am Touchgerät
(`pointer: coarse`) auf 44 Pixel: eine unsichtbare Fläche über der
Leiste, die zur Hälfte über jeder Nachbarspalte liegt. Die Leiste selbst
bleibt acht Pixel breit und sieht unverändert aus. Mit der Maus bleibt es
bei den acht Pixeln — sonst läge ein Streifen der Karte unter der
Greiffläche und ließe sich nicht mehr anfassen. Die Fläche liegt über den
Spalten, aber unter „Liste ausblenden“, damit die Schaltfläche bedienbar
bleibt.

Dazu, was der Finger sonst nicht bedienen kann: Die Leiste nimmt den
Zeiger ganz (`touch-action: none`), sonst nähme der Browser die Geste als
Rollen an sich; und sie nimmt keine Textauswahl mehr an, damit das iPad
beim Liegenbleiben nicht die Lupe darüber legt (wie bei den POI-Karten,
bug-023).

# Prüfung

Neue Tests in `app/plan/components/split-view.test.tsx`, die ohne die
Behebung fehlschlagen:

- Die Leiste lässt sich mit dem Finger nach rechts und nach links
  verschieben; die Spalte zieht dabei mit, nicht erst beim Loslassen.
- Mit Maus und Stift verschiebt sie sich genauso.
- Mindestbreite der Liste und Platz für die Karte werden eingehalten.
- Nach dem Loslassen, nach einem Abbruch durch den Browser und bei einem
  bloßen Tippen bewegt sich nichts (mehr); ein zweiter Finger übernimmt
  den laufenden Zug nicht.

In `app/plan/components/split-view.layout.test.ts` (jsdom führt kein CSS
aus, deshalb direkt am Stylesheet geprüft): Die Greiffläche ist am
Touchgerät 44 Pixel breit, die Leiste selbst bleibt acht Pixel und
bekommt keinen zusätzlichen Hintergrund, sie liegt unter „Liste
ausblenden“, und der Zeiger gehört ihr statt dem Rollen.

Der Test zum Ziehen mit der Maus in `app/plan/plan-view.test.tsx` treibt
den Zug jetzt über Zeiger-Ereignisse — die schickt der Browser zur Maus
ebenso.

# Akzeptanzkriterien der Behebung

- [x] Gegeben der Planer am iPad im Bereich POIs, wenn ich die
      Trennleiste mit dem Finger ziehe, dann verschiebt sie sich mit —
      wie mit der Maus.
- [x] Gegeben die Trennleiste, wenn ich sie mit dem Finger anfasse, dann
      treffe ich sie auf 44 Pixel Breite, ohne dass sie dicker aussieht.
- [x] Gegeben ein Zug mit der Maus, wenn ich ihn ausführe, dann verhält
      er sich unverändert.
