---
id: req-080
title: Reiseplan zum Ausdrucken
app: wegfara
area: Planung
priority: normal
created: 2026-10-10
---

# Goal (Why)

Als Reiseleiter will ich den fertigen Plan **verschicken und aushändigen**
können — an die Mitreisenden vor der Reise, als etwas, das man anschaut
und aufhebt. Heute steht der Plan nur in der App; wer ihn vorher sehen
will, muss sich anmelden und durch den Planer klicken.

Der gedruckte Plan ist **nicht der Begleiter unterwegs** — das ist die
App. Er ist das Versprechen vorher: Hier fahren wir hin, das sehen wir,
so viel kostet es.

Die Gestaltung ist am Mockup entschieden:
[delivery/design/reiseplan-druck/](../../design/reiseplan-druck/) —
`variante-c-magazin.mockup.html` ist die gewählte Richtung, das README
daneben beschreibt sie. **Das Mockup ist die verbindliche Vorlage**, nicht
dieser Text: Wo beide etwas über das Aussehen sagen, gilt das Mockup.

# Function (What)

## Der Weg zum Plan

Im Planer lässt sich der Reiseplan **als Seite zum Ausdrucken** öffnen.
Daraus entsteht das PDF über die Druckfunktion des Browsers.

Die Seite ist für **A4 hoch, randlos** gesetzt: Farbflächen und Fotos
laufen bis an die Blattkante, der Textsatz hält 15 mm Sicherheitsrand.

## Was auf den Seiten steht

**Seite 1 — Bild und Dashboard.** Ein Foto über die oberen zwei Drittel
mit Titel und Ort darauf; darunter eine Fläche in Mitternachtsblau mit
der Beschreibung der Reise, vier Zahlen (Dauer, Stationen, Reisende,
geplante Kosten) und den Eckdaten.

**Dann ein Tag je Seite** — oder mehrere Seiten, wenn ein Tag viele
Stationen hat. Jede Station zeigt:

- die **Startzeit** — und nur die. Keine Dauer, keine Endzeit.
- den **Namen** des Ortes
- den **Langtext** (req-044)
- **ein großes Foto und zwei bis drei kleine**, je nachdem was vorhanden
  ist (req-068)

Ein Tag **ohne** Programmpunkte bleibt als Seite stehen, mit seinem Datum
und einem Satz dazu — beim Durchblättern soll man sehen, was noch offen
ist.

**Letzte Seite — Kosten und Buchungen.** Je Position Betrag und
Buchungszustand, offene Positionen als „offen" statt als 0 €. Darunter
die Summe und der Betrag je Person.

## Fünf Layouts, die wechseln

Jede Station bekommt eines von fünf Layouts. Die Maße stehen im Mockup:

| | Aufbau |
|---|---|
| **L1** | großes Bild links, Text rechts, zwei kleine unter dem Text |
| **L2** | Text links, großes Bild rechts, drei kleine darunter |
| **L3** | großes Bild oben über die ganze Breite, Text darunter, drei kleine rechts |
| **L4** | Text zuerst über die ganze Breite, darunter eine Bildreihe |
| **L5** | Nebenstation: schmal, ein kleines Bild, kurzer Text |

Die großen Bilder sind **unterschiedlich groß** — das ist Absicht, nicht
Nachlässigkeit.

**Der Wechsel folgt einer Regel, nicht dem Zufall:** erste Station des
Tages L1, die nächste große L2, danach wechselnd L3 und L4,
Nebenstationen immer L5. So stehen nie zwei gleiche Layouts
untereinander. Zufall erzeugte gelegentlich zwei gleiche hintereinander,
und die Seite wirkte unruhig statt lebendig.

Hat ein POI nur ein Foto, fällt die Bildreihe darauf zusammen.

## Das Flag am Programmpunkt

Im Planer bekommt jeder Programmpunkt des fertigen Plans ein Kennzeichen,
**wie er im gedruckten Plan erscheint**. Drei Werte:

- **Vollständig** — eine der Layouts L1 bis L4, mit Fotos und Langtext.
  Das ist die Vorgabe.
- **Als Nebenstation** — klein, Layout L5. Für den Kaffee auf dem Weg,
  das Mittagsrestaurant.
- **Nicht anzeigen** — die Station fehlt im gedruckten Plan.

Das Kennzeichen wirkt **ausschließlich auf den gedruckten Plan**. In der
App — Planer wie Begleiter — bleibt jeder Programmpunkt sichtbar, gleich
was dort steht. Es blendet nichts aus, es gestaltet nur das Heft.

## Was nicht im gedruckten Plan steht

- **Transfers.** Grundsätzlich nicht — sie gehören zum Fahrplan, und
  unterwegs sagt die App, wie lange die Fahrt dauert.
- **Dauer und Endzeit** einer Station.
- **Buchungszustand und Preise** im Tagesteil; beides gesammelt auf der
  letzten Seite.
- **Alle Alternativen einer Options-Gruppe** (req-004). Nur die
  Hauptoption bekommt Raum; die Alternative wird in einem Satz erwähnt.

# Acceptance Criteria

- [x] Gegeben eine Reise mit Programmpunkten, wenn ich den Reiseplan zum
      Ausdrucken öffne, dann erscheint er als Seite im Format A4 hoch.
- [x] Gegeben die Seite ist offen, wenn ich sie über den Browser drucke,
      dann entsteht ein PDF, dessen Seiten dem Mockup entsprechen.
- [x] Gegeben ich sehe die erste Seite, wenn ich sie ansehe, dann stehen
      dort Foto, Titel, Ort, Beschreibung, vier Zahlen und die Eckdaten.
- [x] Gegeben ein Tag mit vier Stationen, wenn ich seine Seiten ansehe,
      dann tragen die Stationen verschiedene Layouts und keine zwei
      gleichen stehen untereinander.
- [x] Gegeben eine Station, wenn ich sie ansehe, dann steht dort ihre
      **Startzeit** und KEINE Dauer und KEINE Endzeit.
- [x] Gegeben eine Station, wenn ich sie ansehe, dann steht dort ihr
      **Langtext** und nicht der Kurztext.
- [x] Gegeben ein POI mit sieben Fotos, wenn seine Station erscheint, dann
      zeigt sie ein großes und zwei bis drei kleine.
- [x] Gegeben ein POI mit nur einem Foto, wenn seine Station erscheint,
      dann füllt dieses eine Foto den Bildbereich und es bleibt keine
      leere Fläche.
- [x] Gegeben zwei Programmpunkte zur gleichen Zeit (req-004), wenn ich
      die Seite ansehe, dann bekommt nur die Hauptoption Raum und die
      Alternative wird in einem Satz erwähnt.
- [x] Gegeben ein Tag hat Transfers, wenn ich seine Seiten ansehe, dann
      erscheint **kein** Transfer.
- [x] Gegeben ein Programmpunkt ist gebucht, wenn ich seine Station im
      Tagesteil ansehe, dann steht dort **nichts** von Buchung oder Preis.
- [x] Gegeben ich sehe die letzte Seite, wenn ich sie ansehe, dann stehen
      dort je Position Betrag und Buchungszustand, die Summe und der
      Betrag je Person.
- [x] Gegeben eine Position ist noch nicht festgelegt, wenn ich die
      Kostenseite ansehe, dann steht dort „offen" und nicht „0 €".
- [x] Gegeben ein Reisetag hat keine Programmpunkte, wenn ich den Plan
      durchblättere, dann hat er eine eigene Seite mit Datum und Hinweis.
- [x] Gegeben ich setze bei einem Programmpunkt das Kennzeichen auf
      **Nebenstation**, wenn ich den Plan ansehe, dann erscheint er als
      schmale Station (L5).
- [x] Gegeben ich setze das Kennzeichen auf **Nicht anzeigen**, wenn ich
      den Plan ansehe, dann fehlt dieser Programmpunkt.
- [x] Gegeben ich setze das Kennzeichen auf **Nicht anzeigen**, wenn ich
      denselben Programmpunkt im **Planer** ansehe, dann ist er dort
      unverändert vorhanden.
- [x] Gegeben ich setze das Kennzeichen auf **Nicht anzeigen**, wenn ich
      denselben Programmpunkt im **Begleiter** ansehe, dann ist er dort
      unverändert vorhanden.
- [x] Gegeben ich lege einen neuen Programmpunkt an, wenn ich sein
      Kennzeichen ansehe, dann steht es auf **Vollständig**.
- [x] Gegeben das Schema wurde geändert, wenn ich
      [datenbank.md](../../datenbank.md) ansehe, dann ist sie nachgezogen.

# Constraints

- **Das Mockup ist die Vorlage:**
  `delivery/design/reiseplan-druck/variante-c-magazin.mockup.html` samt
  README. Maße, Farben und Layouts stehen dort; dieser Text wiederholt
  sie nur grob.
- **Farben:** Mitternachtsblau `#141a33` als Tinte, Linien und Fläche;
  Papier hell; Hervorhebungen in warmem Rot `#b5341f` und Safran
  `#c8871a`. Das ist **nicht** die Farbwelt der App (req-015) — der
  gedruckte Plan hat seine eigene.
- **Schriften** sind die der App: Playfair Display, Figtree, Caveat. Sie
  werden mitgeliefert und nicht zur Laufzeit von einem fremden Dienst
  geladen (siehe [stack.md](../../stack.md), wie in req-077 gelöst).
- **Kein serverseitiges PDF in diesem Schritt.** Das PDF entsteht über
  die Druckfunktion des Browsers. Serverseitig bräuchte es einen
  Headless-Browser; Playwright ist nur eine Dev-Abhängigkeit, und im
  Prod-Container ist **kein Browser** installiert (geprüft am 10.10.2026).
  Das wäre ein eigener Schritt.
- Die Fotos kommen über den POI, auf den der Programmpunkt zeigt
  (`poiId`). Ein Programmpunkt ohne POI hat keine.
- Der Langtext steht am Programmpunkt (`longText`, req-044).
- Das Kennzeichen gehört zum **Programmpunkt**, nicht zum POI: Derselbe
  Ort kann an einem Tag die Hauptstation sein und an einem anderen die
  Pause.
- Wird das Schema geändert, ist `delivery/datenbank.md` nachzuziehen.

# Out of Scope

- **Serverseitig ein PDF erzeugen** und als Datei anbieten.
- Den Plan aus der App heraus verschicken (E-Mail, Nachricht).
- Eine Karte im gedruckten Plan.
- Bewertungsrunden, Stimmen und Kommentare.
- Dokumente und Tickets.
- Andere Formate als A4 hoch.
- Die Variante B aus dem Mockup-Ordner (`variante-b-hell.mockup.html`) —
  sie bleibt als Vergleich liegen, wird aber nicht gebaut.
- Welche der sieben Fotos genommen werden, auswählbar machen. Vorerst
  gelten die ersten in ihrer Reihenfolge.
