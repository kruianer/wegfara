---
id: req-076
title: Zoom auf dem Zeitstrahl
app: wegfara
area: Planung
priority: normal
created: 2026-09-25
---

# Goal (Why)

Als Reiseleiter ziehe ich einen POI auf 10:15 und treffe 10:30. Eine
Stunde ist 48 px hoch, eine Viertelstunde also **12 px** — auf dem iPad
weniger als eine Fingerbreite. Genaues Positionieren wird zum Glücksspiel,
und ich korrigiere hinterher über das Formular, was ich eigentlich direkt
ziehen wollte.

Umgekehrt will ich beim Überblick über einen vollen Tag nicht scrollen
müssen.

# Function (What)

Der Zeitstrahl lässt sich **zoomen**: Dieselbe Stunde wird höher oder
niedriger dargestellt.

- **Größer** — ein Programmpunkt lässt sich genauer setzen, weil eine
  Viertelstunde mehr Platz bekommt.
- **Kleiner** — mehr Stunden sind auf einen Blick zu sehen.

Bedient wird der Zoom über die Oberfläche; wie, entscheidet die Umsetzung.
Er muss **mit dem Finger** ebenso erreichbar sein wie mit der Maus.

Der gewählte Zoom bleibt beim Wechsel des Reisetags bestehen. Beim
Neustart der App und beim Wechsel der Reise darf er zurückgesetzt werden
(wie die Filter, bug-052).

Das **Raster bleibt bei 15 Minuten** (req-039, req-040): Der Zoom ändert
die Darstellung, nicht die Schrittweite. Was sich ändert, ist die
Treffsicherheit — bei größerem Zoom entspricht eine Viertelstunde mehr
Pixeln.

# Acceptance Criteria

- [x] Gegeben der Zeitstrahl ist in der Grundeinstellung, wenn ich
      vergrößere, dann ist dieselbe Stunde höher dargestellt.
- [x] Gegeben der Zeitstrahl ist vergrößert, wenn ich verkleinere, dann
      sind mehr Stunden gleichzeitig zu sehen.
- [x] Gegeben ich habe vergrößert, wenn ich einen POI auf 10:15 ziehe,
      dann liegt er danach auf 10:15 und nicht auf 10:30.
- [x] Gegeben ich habe den Zoom geändert, wenn ich den Reisetag wechsle
      und zurückkomme, dann gilt derselbe Zoom.
- [x] Gegeben ich habe vergrößert, wenn ich einen Programmpunkt ansehe,
      dann stehen seine Zeiten unverändert da — der Zoom hat sie nicht
      verschoben.
- [x] Gegeben ich habe den Zoom geändert, wenn ich einen Programmpunkt
      verschiebe, dann rastet er weiterhin auf 15 Minuten ein.
- [x] Gegeben ich habe vergrößert, wenn ich einen Transfer zwischen zwei
      Programmpunkten ansehe, dann liegt er weiterhin richtig zwischen
      ihnen (req-052, req-073).
- [x] Gegeben mehrere Programmpunkte überlappen sich, wenn ich den Zoom
      ändere, dann teilen sie sich weiterhin die Breite (req-039).
- [x] Gegeben ich bediene den Zoom auf dem iPad, wenn ich ihn auslöse,
      dann funktioniert er mit dem Finger.
- [x] Gegeben der Zeitstrahl ist auf 375 px, 768 px und 1280 px zu sehen,
      wenn ich den Zoom bediene, dann ist er auf allen dreien erreichbar
      (siehe [stack.md](../../stack.md)).

# Constraints

- `HOUR_HEIGHT_PX` in
  [timeline-grid.ts](../../../lib/plan/timeline-grid.ts) ist heute eine
  feste Konstante und wird an mehreren Stellen gelesen — unter anderem
  beim Umrechnen einer Zieh-Position in eine Uhrzeit
  ([plan-poi.ts](../../../lib/plan/plan-poi.ts), Zeile 43). Alle Stellen
  müssen denselben Wert verwenden, sonst landet ein gezogener POI auf
  einer anderen Zeit als der, auf die er gezogen wurde.
- Das Einrasten auf 15 Minuten bleibt unverändert (req-039, req-040).
- Es gibt eine sinnvolle Ober- und Untergrenze: So klein, dass Titel
  unlesbar werden, und so groß, dass ein Tag unbedienbar lang wird, muss
  es nicht gehen.
- Die Trefferflächen bleiben bei mindestens 44 × 44 px (siehe
  [stack.md](../../stack.md)) — bei kleinem Zoom notfalls über eine
  Trefferfläche, die größer ist als der sichtbare Block (vgl. bug-029,
  bug-044).

# Out of Scope

- Ein feineres Raster als 15 Minuten.
- Waagrecht zoomen oder die Breite der Spalte ändern.
- Zoom im Begleiter (`/go`).
- Der Zoom soll sich nicht selbst an die Belegung des Tages anpassen.
- Mehrere Tage nebeneinander darstellen.
