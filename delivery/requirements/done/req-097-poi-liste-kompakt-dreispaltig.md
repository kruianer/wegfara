---
id: req-097
title: POI-Liste kompakt und dreispaltig
app: wegfara
area: Planung
priority: normal
changes: req-010, req-060, req-095
created: 2026-10-28
---

# Goal (Why)

Die POI-Liste nimmt zu viel Breite. Als Reiseleiter will ich beim Sammeln
so viel Karte wie möglich sehen — dort entscheidet sich, ob zwei Orte
beieinander liegen.

Dazu ist das Teaser-Bild mit 84 × 84 px zu klein: Man erkennt kaum etwas
darauf, obwohl das Bild beim Durchsehen einer Sammlung das Erste ist,
worauf das Auge fällt.

Gemessen am 28.10.2026: Die POI-Spalte verlangt mindestens **410 px**
(`MIN_LEFT_WIDTH_PX`), dazu 60 px Seitenleiste und 8 px Trenner. Auf dem
iPad quer (1024 px) bleiben der Karte damit 546 px.

Entwurf: `delivery/design/poi-liste/poi-liste.mockup.html`

**Nur iPad quer und grösser** (ab 1024 px). Das Layout für das Telefon
kommt später und ist nicht Teil dieses Requirements.

# Function (What)

## Die Zeile hat drei Spalten

| | Inhalt |
|---|---|
| **links**, 104 px | Teaser-Bild, darunter Bewertung und Buchung |
| **Mitte**, flexibel | Titel oben, Kurztext in der Mitte, Wege unten |
| **rechts**, ~110 px | Status und Gegend |

Die Zeile hat eine **feste Höhe**: Die Bildspalte gibt sie vor (78 px Bild
+ Fuge + 17 px Fakten). Fehlt der Kurztext, bleibt die Zeile gleich hoch —
unterschiedlich hohe Zeilen machen eine lange Liste unruhig.

Die Spalte kommt damit auf **324 px** statt 410. Der Karte bleiben auf dem
iPad quer 646 statt 546 px.

**Die Spalte wächst nicht mit dem Schirm.** Bei 4K wären 25 % über 900 px —
eine Liste, in der das Auge wandern muss. Sie bleibt bei grossen Breiten
bei etwa 366 px und nutzt den Zuwachs nur für eine Zeile mehr Text; alles
andere geht an die Karte.

## Das Teaser-Bild

**104 × 78 px** statt 84 × 84. Querformat statt Quadrat: Mehr vom Motiv
ist zu erkennen, und es kostet keine zusätzliche Zeilenhöhe.

Darauf liegen zwei Angaben, beide **leicht durchscheinend**
(`backdrop-filter`), damit das Motiv dahinter ahnbar bleibt:

- **oben links die Nummer** des POI (req-013)
- **unten der Typ**, über die ganze Breite, in **seiner Typfarbe**
  (`POI_TYPE_COLOR`, `lib/pois/type-meta.ts`) — abgedunkelt, damit der
  weisse Text darauf lesbar bleibt

Beide brauchen damit keinen Platz in der Mitte. Hat ein POI kein Bild,
stehen Nummer und Typ trotzdem auf der leeren Fläche.

**Weltkulturerbe** bekommt einen Glow um das Bild und ein **leises Atmen**
des Typ-Bands: 4,5 Sekunden, 8 % Helligkeitsänderung. Es ist die
Auszeichnung, nicht nur eine Art — aber bei mehreren solchen POIs in einer
Liste darf es nicht flimmern. Wer Bewegung abgestellt hat
(`prefers-reduced-motion`), bekommt nur den Glow.

## Unter dem Bild: Bewertung und Buchung

Die Bewertung (`★ 4,7` mit der Anzahl) und der Buchungszustand als
Symbol: Haken für gebucht, Ausrufezeichen für offen. Ist nichts zu buchen
(`nicht_noetig`), steht **nichts** — sonst trägt jede Zeile ein Zeichen
für „nichts zu tun".

Damit hat die Mitte Platz für den Kurztext, der heute nicht hineinpasst.

## Die Mitte: drei feste Plätze

- **Titel** oben, bündig mit der oberen Bildkante. Zwei Zeilen, dann
  abgeschnitten.
- **Kurztext** dazwischen, füllt den Rest und wird mit Auslassungszeichen
  abgeschnitten — zwei Zeilen bei 324 px, drei bei 366 px.
- **Wege** unten, bündig mit den Fakten unter dem Bild.

Der **Ort** steht vor dem Kurztext, halbfett abgesetzt mit „·":
*Bilbao · Gehrys Titanschiff am Nervión.* Er ist ein Stück Beschreibung
und braucht keine eigene Zeile.

**Dauer und Kosten entfallen aus der Zeile.** Sie bleiben im Formular beim
Anklicken des Titels. Die Dauer ist eine Planungsgrösse (Zeitstrahl), der
Preis steht beim Sammeln selten und kostet eine ganze Zeile.

## Die Wege: zwei statt drei

Nur noch **Webseite** und **Karte**. Der eigene Google-Suchlink entfällt.

**Fehlt die Webseite**, führt dasselbe Symbol zur Google-Suche: Es wechselt
zur Lupe und trägt einen kleinen Punkt, damit zu sehen ist, dass es die
Suche ist und nicht die echte Seite. Heute ist der „Webseite"-Link bei
fehlender Adresse still ein Suchlink (`poi-list.tsx:77`) — künftig ist es
sichtbar.

Die Symbole bleiben an derselben Stelle, gleich ob eine Webseite da ist:
Sonst springen sie bei jeder Zeile anderswohin.

## Rechts: Status und Gegend

**Der Status trägt seine Farbe selbst.** Das Farbband links entfällt — es
war dieselbe Information zweimal. Die Statuspille bekommt getönten Grund,
farbigen Rand und farbige Schrift in `POI_STATUS_COLOR`.

Die Farbe muss bleiben, weil **dieselbe Farbe die Nadel auf der Karte
trägt** (`poi-map.tsx:554`). Verschwände sie aus der Liste, wäre der
Zusammenhang zwischen Zeile und Nadel weg — das ist beim Planen das
Nützlichste an ihr.

Gemessener Kontrast auf `--card-alt`: 6,66:1 (Offen) bis 10,77:1
(Alternative) — `stack.md` verlangt 4,5:1.

**Die Gegend steht als Kürzel**: `BIO`, `SSE`, `RIO`. Ohne Gegend steht
„—". Einen Langnamen gibt es nicht — die Gegend *ist* das Kürzel
(req-101).

Damit ist die dritte Spalte **fest breit**. Vorher waren Status und Gegend
beide frei gewählter Text — zusammen über 200 px, und eine lange Gegend
sprengte die Spalte.

## Auswählen: kein Kästchen je Zeile

Das Ankreuzfeld hat heute 44 × 44 px in **jeder** Zeile, dauerhaft, für
eine Handlung, die selten vorkommt.

Künftig erscheint es erst auf **„Auswählen"**. Dann genügen 20 px, weil
die ganze Zeile das Tippziel ist. Die Aktionen (Status für mehrere,
Entfernen) stehen im Kopf, wo sonst die Filter liegen, dazu „Fertig".

Die Funktionen dahinter bleiben unverändert: Status für mehrere (req-069)
und mehrere aussortieren (req-057).

## Der Bildlaufbalken

Die Liste rollt in den Farben der App, nicht im Grau des Browsers. Dafür
gibt es das gemeinsame Blatt schon (`components/bildlauf.module.css`,
bug-041) — die POI-Liste nutzt es **nicht**. Sie bekommt es.

## Kein Löschen-Knopf in der Zeile

Es gibt ihn dort heute nicht, und er kommt nicht hinzu. Löschen läuft über
das Formular (`onDelete`) und über den Auswahlmodus (req-057). Ein
Papierkorb je Zeile wäre ein dauerhafter Knopf für etwas Endgültiges, der
sich versehentlich leicht trifft.

# GUI

- Entwurf: `delivery/design/poi-liste/poi-liste.mockup.html`
- Verbindlichkeit: eng folgen bei Aufbau und Massen. Die Farben sind die
  bestehenden (`POI_TYPE_COLOR`, `POI_STATUS_COLOR`) — es wird keine
  erfunden.
- Die vier Regeln aus `stack.md` gelten bei **1024, 1280 und 1920 px**.
  375 px ist ausgenommen: Dort zeigt der Planer seit req-088 nur den
  Hinweis, und das Telefon-Layout kommt später.
- Kontrast nach `lib/design/kontrast.ts` für die farbige Statusschrift und
  den weissen Text auf dem Typ-Band.
- Tippziele mindestens 44 × 44 px — ausgenommen das Ankreuzfeld im
  Auswahlmodus (20 px), weil dort die ganze Zeile trifft.

# Acceptance Criteria

- [x] Gegeben die POI-Liste bei 1280 px, wenn ich sie ansehe, dann ist die
      Spalte höchstens 330 px breit.
- [x] Gegeben ein Fenster von 3840 px, wenn ich die Liste ansehe, dann ist
      die Spalte nicht breiter als 380 px.
- [x] Gegeben ein POI mit Foto, wenn ich die Zeile ansehe, dann ist das
      Bild 104 × 78 px.
- [x] Gegeben ein POI ohne Foto, wenn ich die Zeile ansehe, dann stehen
      Nummer und Typ trotzdem da.
- [x] Gegeben ein POI vom Typ „Restaurant", wenn ich die Zeile ansehe,
      dann trägt das Typ-Band dessen Typfarbe.
- [x] Gegeben ein POI vom Typ „Weltkulturerbe", wenn ich die Zeile ansehe,
      dann hat das Bild einen Glow.
- [x] Gegeben ich habe Bewegung abgestellt, wenn ich einen
      Weltkulturerbe-POI ansehe, dann bewegt sich nichts — der Glow bleibt.
- [x] Gegeben ein POI mit Bewertung, wenn ich die Zeile ansehe, dann steht
      sie unter dem Bild.
- [x] Gegeben ein POI mit Buchung „nicht nötig", wenn ich die Zeile
      ansehe, dann steht dort KEIN Buchungszeichen.
- [x] Gegeben ein POI mit Kurztext, wenn ich die Zeile ansehe, dann steht
      der Ort davor und der Text dahinter.
- [x] Gegeben ein POI ohne Kurztext, wenn ich die Zeile ansehe, dann ist
      sie genauso hoch wie eine mit Kurztext.
- [x] Gegeben ein POI mit sehr langem Kurztext, wenn ich die Zeile ansehe,
      dann ist er abgeschnitten und die Zeile nicht höher.
- [x] Gegeben ein POI, wenn ich die Zeile ansehe, dann stehen genau zwei
      Wege da — Webseite und Karte.
- [x] Gegeben ein POI ohne hinterlegte Webseite, wenn ich das erste
      Symbol ansehe, dann ist es eine Lupe und führt zur Google-Suche.
- [x] Gegeben die Liste, wenn ich eine Zeile ansehe, dann gibt es KEIN
      Farbband am linken Rand.
- [x] Gegeben ein POI mit Status „Warteliste", wenn ich die Zeile ansehe,
      dann trägt die Statuspille die Farbe dieses Status.
- [x] Gegeben ein POI mit der Gegend „San Sebastián" und dem Kürzel
      „SSE", wenn ich die Zeile ansehe, dann steht „SSE" da und „San
      Sebastián" beim Überfahren.
- [x] Gegeben ein POI ohne Gegend, wenn ich die Zeile ansehe, dann steht
      dort „—".
- [x] Gegeben die Liste im Normalfall, wenn ich sie ansehe, dann gibt es
      KEIN Ankreuzfeld in den Zeilen.
- [x] Gegeben ich tippe „Auswählen", wenn ich die Liste ansehe, dann
      trägt jede Zeile ein Ankreuzfeld und im Kopf stehen „Status…",
      „Entfernen" und „Fertig".
- [x] Gegeben ich habe zwei POIs angekreuzt und setze den Status, dann
      gilt er für beide (req-069).
- [x] Gegeben die Liste rollt, wenn ich den Bildlaufbalken ansehe, dann
      trägt er die Farben der App und nicht das Grau des Browsers.
- [x] Gegeben die Liste bei 1024, 1280 und 1920 px, wenn die
      Bildschirmprüfung läuft, dann ist sie grün.

# Constraints

- Die Breite der Spalte steht als Token an **einer** Stelle.
  `MIN_LEFT_WIDTH_PX` in `split-view.tsx` ist anzupassen, nicht zu
  ergänzen.
- Die Typ- und Statusfarben kommen aus den bestehenden Konstanten. Es wird
  keine Farbe erfunden und keine geändert.
- Das Kürzel der Gegend wird **von Hand eingetragen** — keine Ableitung,
  kein Vorschlag aus den ersten Buchstaben. „San Sebastián" und
  „Santander" ergäben beide „SAN"; eine Kollision, die niemand kommen
  sieht. Ein zweites Feld braucht es dafür nicht: Die Gegend selbst wird
  zum Kürzel (req-101).
- Die POI-Liste nutzt `components/bildlauf.module.css`, statt eigene
  Regeln für den Bildlauf zu schreiben.
- Die Liste zeigt die **kurzen** Statusnamen. Dass sie überall gelten
  sollen, ist ein eigenes Requirement (siehe Out of Scope).
- Das Layout gilt ab 1024 px. Unter 768 px zeigt der Planer den Hinweis
  (req-088); zwischen 768 und 1024 px gilt die schmale Ordnung aus
  req-088, in der die Liste allein steht.
- Die bestehenden Tests zur Liste (req-010, req-060, bug-038, bug-040,
  req-069) sind **anzupassen, nicht zu löschen**: Was sie prüfen, gilt
  weiter.

# Out of Scope

- **Die Filter.** Sie kommen als eigenes Mockup und eigenes Requirement
  danach. Im Entwurf steht an ihrer Stelle ein Platzhalter.
- **Die Statusnamen überall umbenennen** (`Fix · Alternative · Warteliste
  · Nein · Offen` statt der heutigen). Entschieden, aber ein eigenes
  Requirement: Es berührt Formular, Bewertungsrunde, Karte, Glossar und
  die Begriffe der App.
- **Die Gegend auf ein Kürzel begrenzen.** Das ist req-101; dieses
  Requirement zeigt sie nur an.
- Den Bildlauf in den übrigen Ansichten des Planers nachziehen
  (Bewertungen, Kosten, Dokumente, Chat, Verwaltung nutzen das Blatt
  ebenfalls nicht).
- Das Telefon-Layout (375 px).
- Die Karte, die POI-Auswahl der Tagesplanung und das POI-Formular.
- Die Anlegezeile über der Liste (req-060).
