---
id: req-046
title: Vorschau beim Ziehen und Kanten des Programmpunkts
app: wegfara
area: Planung
priority: normal
created: 2026-09-05
changes: req-039, req-040
---

# Goal (Why)

Als Reiseleiter sehe ich beim Ziehen nicht, wo der Programmpunkt landen
wird — ich lasse los und stelle danach fest, ob es gepasst hat.
Außerdem will ich Anfang und Ende eines Programmpunkts einzeln anfassen
können, statt ihn nur als Ganzes zu verschieben.

# Function (What)

**Vorschau beim Ziehen.** Während ich ziehe, erscheint an der Stelle,
an der der Programmpunkt einrasten wird, ein Umriss in seiner Höhe,
beschriftet mit der Uhrzeit — zum Beispiel „14:00". Er folgt dem Zeiger
und springt dabei auf das 15-Minuten-Raster.

Das gilt für beide Wege:

- einen POI aus „Noch unverplant" auf den Zeitstrahl ziehen (req-039)
- einen liegenden Programmpunkt verschieben (req-040)

**Kanten anfassen.** Die obere und die untere Kante eines
Programmpunkts lassen sich einzeln ziehen:

- die obere ändert die Startzeit, das Ende bleibt stehen
- die untere ändert die Endezeit, der Beginn bleibt stehen

In beiden Fällen ändert sich dadurch die Dauer. Auch hier erscheint die
Vorschau mit der Uhrzeit, und auch hier rastet es auf 15 Minuten ein.
Die kürzeste Dauer bleibt 15 Minuten (req-040).

Das Ziehen des Blocks selbst verschiebt ihn weiterhin als Ganzes, mit
gleichbleibender Dauer.

Alle Änderungen sind sofort gespeichert (req-039).

# Änderung gegenüber heute (req-039, req-040)

- Beim Ziehen gibt es heute keine Vorschau; man sieht das Ergebnis erst
  nach dem Loslassen.
- Die untere Kante lässt sich heute bereits ziehen (req-040); die obere
  nicht.

# Acceptance Criteria

- [ ] Gegeben ich ziehe den POI „Villa Rufolo" aus „Noch unverplant"
      über den Zeitstrahl, wenn der Zeiger bei 14:00 steht, dann sehe
      ich dort einen Umriss mit der Beschriftung „14:00".
- [ ] Gegeben ich ziehe einen POI über den Zeitstrahl, wenn ich den
      Zeiger zwischen 14:00 und 14:15 bewege, dann bleibt der Umriss auf
      14:00 stehen.
- [ ] Gegeben ich ziehe einen liegenden Programmpunkt, wenn der Zeiger
      bei 16:00 steht, dann sehe ich dort einen Umriss mit der
      Beschriftung „16:00".
- [ ] Gegeben ich ziehe einen Programmpunkt und lasse ihn los, wenn ich
      den Zeitstrahl danach ansehe, dann ist KEIN Umriss mehr zu sehen.
- [ ] Gegeben ein Programmpunkt von 10:00 bis 12:30, wenn ich seine
      obere Kante auf 09:00 ziehe, dann beginnt er um 09:00.
- [ ] Gegeben ein Programmpunkt von 10:00 bis 12:30, wenn ich seine
      obere Kante auf 09:00 ziehe, dann endet er weiterhin um 12:30.
- [ ] Gegeben ein Programmpunkt von 10:00 bis 12:30, wenn ich seine
      untere Kante auf 14:00 ziehe, dann beginnt er weiterhin um 10:00.
- [ ] Gegeben ein Programmpunkt von 10:00 bis 12:30, wenn ich seine
      obere Kante über das Ende hinaus nach unten ziehe, dann beginnt er
      um 12:15 und NICHT später.
- [ ] Gegeben ich habe eine Kante gezogen, wenn ich die Seite neu lade,
      dann liegt der Programmpunkt mit der neuen Zeit da.
- [ ] Gegeben ich fasse den Programmpunkt in seiner Mitte an, wenn ich
      ihn auf 14:00 ziehe, dann behält er seine Dauer von 2,5 Stunden.

# Constraints

- Ziehen muss auch mit dem Finger funktionieren (siehe bug-017); die
  Kanten brauchen dafür eine Greiffläche, die sich mit dem Finger
  treffen lässt.

# Out of Scope

- Ortssuche, Autofill und Dauer am POI — das ist req-045.
- Verhindern von Überlappungen — sie bleiben erlaubt (req-039).
- Automatisches Anpassen der Transfers zwischen Programmpunkten.
- Rückgängigmachen einer Verschiebung über einen eigenen Weg.
