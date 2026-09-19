---
id: req-070
title: Flyout am Kartenmarker
app: wegfara
area: Planung
priority: normal
created: 2026-09-19
---

# Goal (Why)

Als Reiseleiter sehe ich auf der Karte dreißig nummerierte Tropfen und
weiß nicht, welcher welcher ist. Um das herauszufinden, muss ich jeden
einzeln öffnen und wieder schließen — und verliere dabei jedes Mal den
Überblick über die Karte.

Ein kurzer Blick soll reichen: Was ist das für ein Ort, wie sieht er aus,
wie ist er bewertet.

# Function (What)

## Am Mauszeiger

Fahre ich mit der Maus über einen Marker, erscheint ein **Flyout** neben
ihm. Es zeigt:

- **Bild** — das erste Foto des POI. Hat er keines, bleibt die Stelle leer
  (kein Platzhalter, der so aussieht, als fehle etwas).
- **Titel** — Name des POI, mit seiner Nummer, wie sie auch im Marker
  steht.
- **Beschreibung** — der Kurztext (req-044). Fehlt er, entfällt die Zeile.
- **Bewertung** — die Google-Bewertung mit der Zahl der Bewertungen
  dahinter (req-057). Hat der POI keine, entfällt die Zeile — das ist
  etwas anderes als die Bewertung 0.

Verlasse ich den Marker, verschwindet das Flyout.

## Am Finger

Auf einem Touchscreen gibt es kein Darüberfahren, deshalb:

- Der **erste Tap** auf einen Marker zeigt das Flyout.
- Der **zweite Tap** auf denselben Marker — oder ein Tap auf das Flyout
  selbst — öffnet den POI, wie es heute der erste tut.
- Ein Tap auf die Karte daneben schließt das Flyout, ohne etwas zu öffnen.
- Ein Tap auf einen **anderen** Marker zeigt dessen Flyout; das vorige
  schließt sich.

## Überall

Das Flyout bleibt im sichtbaren Bereich der Karte: Liegt der Marker am
Rand, klappt es zur anderen Seite, statt abgeschnitten zu werden.

Es ändert den Kartenausschnitt nicht — kein Zoom, kein Verschieben
(bug-048).

# Acceptance Criteria

- [ ] Gegeben ein POI mit Foto, Kurztext und Bewertung, wenn ich mit der
      Maus über seinen Marker fahre, dann zeigt das Flyout Bild, Titel,
      Beschreibung und Bewertung.
- [ ] Gegeben ich fahre mit der Maus vom Marker weg, wenn ich die Karte
      ansehe, dann ist das Flyout verschwunden.
- [ ] Gegeben ein POI ohne Foto, wenn sein Flyout erscheint, dann ist
      kein leerer Bildrahmen und kein Platzhalter zu sehen.
- [ ] Gegeben ein POI ohne Kurztext, wenn sein Flyout erscheint, dann
      fehlt die Beschreibungszeile und es steht dort kein Ersatztext.
- [ ] Gegeben ein POI ohne Google-Bewertung, wenn sein Flyout erscheint,
      dann steht dort KEINE Bewertung — insbesondere nicht „0".
- [ ] Gegeben ich tippe auf dem iPad einmal auf einen Marker, wenn ich
      hinsehe, dann zeigt sich das Flyout und der POI ist NICHT geöffnet.
- [ ] Gegeben das Flyout eines Markers steht offen, wenn ich ein zweites
      Mal auf denselben Marker tippe, dann öffnet sich der POI.
- [ ] Gegeben das Flyout steht offen, wenn ich auf das Flyout tippe, dann
      öffnet sich der POI.
- [ ] Gegeben das Flyout steht offen, wenn ich auf die Karte daneben
      tippe, dann schließt es sich und es öffnet sich nichts.
- [ ] Gegeben das Flyout eines Markers steht offen, wenn ich auf einen
      anderen Marker tippe, dann zeigt sich dessen Flyout und das vorige
      ist zu.
- [ ] Gegeben ein Marker liegt am Rand der Karte, wenn sein Flyout
      erscheint, dann ist es vollständig zu sehen.
- [ ] Gegeben ein Flyout erscheint, wenn ich die Karte ansehe, dann sind
      Zoom und Mitte unverändert.
- [ ] Gegeben die Karte ist auf 375 px, 768 px und 1280 px zu sehen, wenn
      ein Flyout erscheint, dann ist es auf allen dreien lesbar und
      verdeckt die Karte nicht vollständig (siehe [stack.md](../../stack.md)).

# Constraints

- Das Flyout zeigt nur, was der POI schon mitbringt: Es wird nichts
  nachgeladen und nichts bei Google nachgefragt.
- Der Kurztext fasst höchstens 200 Zeichen (req-044) und passt damit ohne
  Kürzung ins Flyout.
- Die Farbe des Markers bleibt der Statusanzeige vorbehalten (req-013);
  das Flyout führt keine zweite ein.
- Auf dem Touchscreen zählt ein Tippen nicht schon bei `click` als
  ausgelöst — dort greift `pointerup` wie beim vorhandenen Marker (siehe
  bug-005, bug-015).

# Out of Scope

- Das Flyout bearbeitbar machen (Status setzen, Notiz ändern).
- Mehrere Fotos im Flyout durchblättern.
- Ein Flyout an den Markern des Begleiters (`/go`) oder der Tagesroute.
- Öffnungszeiten, Adresse, Telefonnummer oder Kosten im Flyout.
- Die KI-Begründung (req-057) im Flyout zeigen.
