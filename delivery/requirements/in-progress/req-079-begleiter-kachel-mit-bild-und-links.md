---
id: req-079
title: Die Kachel im Begleiter zeigt Bild, Langtext und Links
app: wegfara
area: Reise
priority: normal
created: 2026-09-26
---

# Goal (Why)

Als Mitreisender stehe ich vor einem Programmpunkt und sehe auf der Kachel
eine **farbige Fläche**, wo das Foto des Ortes sein sollte. Die Fotos
liegen längst da — aus Google, selbst aufgenommen oder erzeugt (req-026,
req-068, req-072) —, nur zeigt sie der Begleiter nicht.

„Mehr lesen" bringt den Langtext, aber keine Bilder. Und was ich unterwegs
am dringendsten brauche, fehlt ganz: der Weg dorthin, die Webseite, und
die Antwort auf „müssen wir da noch reservieren?".

# Function (What)

## Das Foto statt der Farbfläche

Der obere Teil der Kachel zeigt das **erste Foto** des POI, aus dem der
Programmpunkt entstanden ist.

Hat er keinen POI oder der POI kein Foto, bleibt es bei der farbigen
Fläche wie heute — sie ist der Rückfall, nicht der Regelfall.

Was heute über der Fläche liegt, bleibt: Art des Programmpunkts, Uhrzeit
und die Markierung „Gewählt". Über einem Foto müssen sie lesbar bleiben.

Ein KI-Bild trägt sein Zeichen auch hier (req-072).

## „Mehr lesen" bringt den Langtext mit Bildern

Aufgeklappt **ersetzt der Langtext den Kurztext** — nicht beides
untereinander.

Darunter stehen die **weiteren Fotos** des POI untereinander, in ihrer
Reihenfolge. Das erste bleibt oben auf der Kachel; es wiederholt sich
nicht.

## Links auf der Kachel

Auf der Kachel stehen die Wege, die man unterwegs braucht:

- **Navigation** zum Ort — es gibt sie schon
  ([maps-link.ts](../../../lib/pois/maps-link.ts))
- **Webseite** des Ortes, sofern hinterlegt
- weitere hinterlegte Kontaktwege (Telefon, E-Mail), sofern vorhanden

Reicht der Platz nicht für Beschriftungen, genügen **Symbole** — dann mit
einem Namen für Vorleseprogramme und als Tooltip.

## Der Buchungszustand

Auf der Kachel ist zu sehen, **ob der Programmpunkt gebucht ist**. Der
Zustand liegt am Programmpunkt (`booked`); die Schaltfläche zum Buchen gibt
es bereits (req-005) — was fehlt, ist die Antwort auf „ist es erledigt?",
ohne sie aus dem Vorhandensein eines Knopfes zu erschließen.

# Acceptance Criteria

- [x] Gegeben ein Programmpunkt aus einem POI mit Foto, wenn ich seine
      Kachel ansehe, dann zeigt der obere Teil das erste Foto.
- [x] Gegeben ein Programmpunkt ohne POI oder dessen POI hat kein Foto,
      wenn ich die Kachel ansehe, dann steht dort die farbige Fläche wie
      heute.
- [x] Gegeben eine Kachel zeigt ein Foto, wenn ich hinsehe, dann sind Art,
      Uhrzeit und „Gewählt" darüber weiterhin lesbar.
- [x] Gegeben das erste Foto ist ein KI-Bild, wenn ich die Kachel ansehe,
      dann trägt es sein Zeichen (req-072).
- [x] Gegeben ich tippe auf „Mehr lesen", wenn ich hinsehe, dann steht dort
      der Langtext und NICHT mehr der Kurztext.
- [x] Gegeben der POI hat vier Fotos, wenn ich aufklappe, dann stehen die
      drei weiteren untereinander unter dem Langtext.
- [x] Gegeben der POI hat nur ein Foto, wenn ich aufklappe, dann erscheint
      es nicht ein zweites Mal.
- [x] Gegeben ich klappe wieder zu, wenn ich hinsehe, dann steht dort
      wieder der Kurztext und die weiteren Fotos sind weg.
- [x] Gegeben der Programmpunkt hat eine Position, wenn ich die Kachel
      ansehe, dann kann ich von dort die Navigation starten.
- [x] Gegeben beim POI ist eine Webseite hinterlegt, wenn ich die Kachel
      ansehe, dann komme ich von dort zu ihr.
- [x] Gegeben beim POI ist keine Webseite hinterlegt, wenn ich die Kachel
      ansehe, dann steht dort kein toter Link und kein Platzhalter.
- [x] Gegeben die Links stehen nur als Symbole, wenn ich eines antippe,
      dann ist seine Trefferfläche mindestens 44 × 44 px (siehe
      [stack.md](../../stack.md)) und es trägt einen Namen.
- [ ] Gegeben ein Programmpunkt ist gebucht, wenn ich die Kachel ansehe,
      dann ist das zu sehen.
- [ ] Gegeben ein Programmpunkt ist nicht gebucht, wenn ich die Kachel
      ansehe, dann ist auch das zu sehen — nicht bloß das Fehlen eines
      Hinweises.
- [ ] Gegeben ein Programmpunkt, bei dem Buchen nicht nötig ist, wenn ich
      die Kachel ansehe, dann steht dort weder „gebucht" noch „offen".
- [ ] Gegeben die Kachel ist auf 375 px, 768 px und 1280 px zu sehen, wenn
      ich sie ansehe, dann sind Foto, Texte und Links auf allen dreien
      benutzbar (siehe [stack.md](../../stack.md)).

# Constraints

- Die Fotos kommen über den POI, auf den der Programmpunkt zeigt
  (`poiId`); ein Programmpunkt ohne POI hat keine.
- Der Buchungszustand steht am Programmpunkt (`booked`, req-005) — nicht
  am POI. Der Buchungsstatus des POI (`poi.buchung`, req-061) beschreibt
  den Ort, nicht den Termin; die beiden werden nicht vermischt.
- Die vorhandenen Bausteine werden genutzt und nicht nachgebaut:
  `maps-link.ts` für die Navigation, `BookingButton` für das Buchen.
- Die Bilder dürfen die Kachel nicht langsam machen: Der Begleiter läuft
  unterwegs, oft über Mobilfunk. Die weiteren Fotos werden erst geladen,
  wenn aufgeklappt wird.
- Ein fehlendes Foto ist kein Fehler und wird nicht als solcher angezeigt
  (vgl. bug-021, bug-027).

# Out of Scope

- Fotos im Begleiter hinzufügen, entfernen oder umsortieren.
- Eine Vollbild- oder Zoom-Ansicht der Fotos.
- Den Buchungszustand im Begleiter ändern (das kann req-005 schon).
- Öffnungszeiten auf der Kachel.
- Die Kachel im Planer.
