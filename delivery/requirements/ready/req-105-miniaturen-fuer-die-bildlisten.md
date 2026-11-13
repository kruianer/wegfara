---
id: req-105
title: Miniaturen für die Bildlisten — das Original bleibt für die Vergrösserung
app: wegfara
area: Planung
priority: hoch
changes: req-026, req-068, req-072, req-079
created: 2026-11-13
---

# Goal (Why)

Beim Öffnen einer Reise bauen sich die POI-Bilder sichtbar als Streifen
auf. Das ist nicht der Server und nicht die Platte — beide antworten in
**3 Millisekunden**. Es ist die Datenmenge auf der Leitung.

**Das Teaser-Bild wird in 104 × 78 Pixeln gezeichnet**
(`app/plan/components/poi-list.module.css:123-124`). Ausgeliefert wird
die Originaldatei — im Schnitt **350 KB**, die grösste **3,6 MB**.

Die Ursache steht in `lib/google/places-client.ts:19`:

```
const PHOTO_MAX_WIDTH_PX = 1200;  // „Listenbild, kein Poster"
```

Der Kommentar beschreibt die Absicht richtig und verfehlt sie um eine
Grössenordnung: Das Listenbild ist 104 Pixel breit, abgeholt wird es mit
1200. Es gibt **kein `sharp`, kein `jimp`, kein `next/image`** im
Projekt — niemand verkleinert, das Original geht unverändert heraus.

**Gemessen auf prod (13.11.2026):**

| | |
|---|---|
| Bilddateien | 1212 |
| Belegt | 423 MB |
| Mittlere Grösse | ~350 KB |
| Platte lesen (3,6 MB) | 3 ms |
| Server antwortet | 3 ms |
| **Durchsatz durch den Tunnel** | **~2 MB/s** |

Bei 20 POIs auf dem Schirm sind das **7 MB**, also gut **3 Sekunden** —
und der Browser holt nur sechs gleichzeitig, der Rest wartet. Nach dem
ersten Mal greift `Cache-Control: private, max-age=86400`, deshalb ist es
nur „manchmal" langsam: beim ersten Öffnen, am nächsten Tag, nach einem
Deploy, auf einem anderen Gerät.

**Die Zahl der Bilder ist in Ordnung und bleibt es.** 1212 Dateien sind
rund 170–200 POIs mit je bis zu sieben Fotos (`MAX_PHOTOS = 7`, req-068).
Die Zeitstempel bestätigen es: minutengenau Vielfache von sieben. Diese
Fotos sind abgeholt und bezahlt; an der Sieben wird nicht gerührt.

**Verwaiste Dateien wurden keine gefunden.** Das Löschen eines POI
entfernt die Dateien mit (`lib/db/pois.ts:641`,
`app/api/pois/route.ts:307`), und die Wiederherstellung leert das
Verzeichnis zuerst (`lib/backup/store.ts:318`). Das ist aus dem Code und
den Zeitstempeln geschlossen, **nicht gemessen** — der Lesezugriff auf
die prod-Datenbank stand nicht zur Verfügung. Ein Abgleich der
Dateinamen gegen `poi_photo`, `document` und `trip_titelfoto` steht noch
aus und gehört nicht in dieses Requirement.

Dieses Requirement ändert nichts daran, **was** gezeigt wird — nur, in
welcher Grösse es über die Leitung geht.

# Scope (What)

## Zwei Grössen je Bild

Zu jedem Bild entsteht beim Speichern zusätzlich eine **Miniatur von 320
Pixeln Breite**. Das Original bleibt unverändert liegen.

320 statt der 104 aus dem Layout: Auf einem Bildschirm mit doppelter
Punktdichte wird das Bild mit 208 Punkten gezeichnet, und die POI-Auswahl
in der Planung zeigt es etwas breiter. 320 deckt beides ab und liegt bei
rund **15 KB** statt 350.

Die Miniatur liegt als eigene Datei im selben Bildverzeichnis, erkennbar
am Namen. Sie ist **abgeleitet, nicht eigenständig**: Es gibt keinen
eigenen Datensatz für sie, sie gehört zum selben Foto und verschwindet
mit ihm.

## Wer welche Grösse bekommt

**Die Miniatur** zeigt jede Liste und jede Kachel:

- die POI-Liste im Planer (`app/plan/components/poi-list.tsx`)
- die POI-Auswahl in der Planung (`unplanned-column.tsx`)
- das Flyout auf der Karte (`poi-map.tsx`)
- die Kachel im Begleiter (`app/go/components/activity-card.tsx`)
- die Vorschau im POI-Formular (`poi-form.tsx`)

**Das Original** zeigt allein die **Vergrösserung**: der Klick auf das
Bild, der heute schon die Grossansicht öffnet
(`poi-list.tsx:467`, `setGrossansichtVon`). Dort sind alle sieben Fotos
in voller Grösse zu sehen — dafür sind sie da.

## Die Bilder, die schon da sind

Für die 1212 vorhandenen Dateien entstehen die Miniaturen **nachträglich
in einem einmaligen Lauf**. Er ist von der „Verwaltung" auszulösen,
zeigt seinen Fortschritt und lässt sich gefahrlos wiederholen: Was schon
eine Miniatur hat, wird übersprungen.

Fehlt zu einem Bild die Miniatur — weil der Lauf noch nicht durch ist
oder fehlgeschlagen —, zeigt die Liste **das Original**. Langsam ist
besser als leer.

## Nur holen, was gebraucht wird

Die Listen bekommen `loading="lazy"`. Der Begleiter hat es schon
(`activity-card.tsx:89`), **die POI-Liste im Planer nicht** — sie holt
heute alle Bilder sofort, auch die dreissig ausserhalb des Bildschirms.

## Ein Bild, das sich nicht ändert, wird nicht neu geholt

Die drei Bild-Routen (`poi-fotos/[id]`, `reise-titelfoto/[tripId]`,
`dokumente/[id]`) senden `Cache-Control: private, max-age=86400`, aber
**keinen `ETag`**. Nach einem Tag wird jedes Bild voll neu geladen,
statt mit einem `304` bestätigt zu werden. Alle drei bekommen einen
`ETag` und beantworten `If-None-Match` mit `304`.

## Eine Datei, die über ihre Endung lügt

`49d541f8-971c-4aea-acd8-4a8b359c91e1.jpg` ist tatsächlich ein **PNG**,
1200 × 1697 — daher die 3,6 MB. Der `Content-Type` kommt aber aus der
Endung (`app/api/poi-fotos/[id]/route.ts:38`), sie geht also als JPEG
hinaus. Beim Erzeugen der Miniatur wird die Art am Inhalt erkannt, nicht
am Namen; die Miniatur ist dann richtig ausgezeichnet.

# Acceptance Criteria

- [ ] Gegeben ein POI mit Foto, wenn ich die POI-Liste öffne, dann wird
      die Miniatur geladen und nicht das Original.
- [ ] Gegeben die Miniatur, wenn ich ihre Grösse messe, dann ist sie 320
      Pixel breit.
- [ ] Gegeben eine Reise mit zwanzig bebilderten POIs, wenn ich sie zum
      ersten Mal öffne, dann sind alle Bilder in **unter einer Sekunde**
      da.
- [ ] Gegeben ein POI mit Foto, wenn ich **auf das Bild klicke**, dann
      zeigt die Vergrösserung das **Original** in voller Auflösung.
- [ ] Gegeben ein POI mit sieben Fotos, wenn ich die Vergrösserung
      öffne, dann sind alle sieben als Originale zu sehen.
- [ ] Gegeben ein neu angelegter POI mit Fotos von Google, wenn er
      gespeichert ist, dann liegt zu jedem Foto eine Miniatur im
      Bildverzeichnis.
- [ ] Gegeben ein selbst hochgeladenes Foto, wenn es gespeichert ist,
      dann liegt auch dazu eine Miniatur.
- [ ] Gegeben ein KI-Bild (req-072), wenn es erzeugt ist, dann liegt
      auch dazu eine Miniatur.
- [ ] Gegeben ein Foto **ohne** Miniatur, wenn ich die Liste öffne, dann
      wird das Original gezeigt — die Liste bleibt nicht leer.
- [ ] Gegeben ich lösche einen POI, wenn ich ins Bildverzeichnis sehe,
      dann sind **Original und Miniatur** fort.
- [ ] Gegeben der nachträgliche Lauf, wenn ich ihn in der „Verwaltung"
      auslöse, dann entstehen die fehlenden Miniaturen und der
      Fortschritt ist sichtbar.
- [ ] Gegeben der Lauf ist einmal durch, wenn ich ihn erneut auslöse,
      dann wird kein Bild zweimal verkleinert.
- [ ] Gegeben die POI-Liste, wenn dreissig POIs ausserhalb des
      Bildschirms stehen, dann werden deren Bilder **nicht** geholt.
- [ ] Gegeben ein Bild, das ich schon habe, wenn ich die Seite nach
      einem Tag neu lade, dann antwortet die Route mit **304** und
      schickt die Daten nicht noch einmal.
- [ ] Gegeben die Datei, die als `.jpg` ein PNG ist, wenn ihre Miniatur
      entsteht, dann ist sie richtig ausgezeichnet.
- [ ] Gegeben eine Reise mit Titelfoto, wenn ich die Reiseliste öffne,
      dann wird auch dort die Miniatur geladen.
- [ ] Gegeben der Begleiter, wenn ich eine Kachel mit Foto sehe, dann
      ist es die Miniatur.
- [ ] Gegeben ein Backup, wenn ich es wiederherstelle, dann sind
      Originale **und** Miniaturen wieder da.

# Constraints

- **Die Originale bleiben.** Sie sind die Vergrösserung. Die 423 MB
  bleiben belegt; gespart wird auf der Leitung, nicht auf der Platte.
- **`MAX_PHOTOS = 7` wird nicht angetastet** (req-068). Die Zahl ist
  bewusst gesetzt, die Fotos sind abgeholt und bezahlt.
- Die Miniatur ist **abgeleitet**: kein eigener Datensatz, kein eigener
  Lebenslauf. Sie entsteht aus dem Original und geht mit ihm.
- Fehlt die Miniatur, wird das Original gezeigt — **nie ein leeres
  Bild**. Ein Datensatz ohne Datei bleibt ein Fehlerzustand und darf
  weiter als 404 sichtbar werden (stack.md).
- Die Bildart wird **am Inhalt** erkannt, nicht an der Endung.
- Das Bildverzeichnis kommt weiter ausschliesslich aus `IMAGE_DIR`
  (bug-032) — nie ein fest verdrahteter Pfad.
- Die Bilder gehen weiter **nur über die eigene Schnittstelle** heraus
  und nur an eine angemeldete Person des Accounts (req-024). Die
  Miniatur ist nicht öffentlicher als das Original.
- Der nachträgliche Lauf fasst **nur das Bildverzeichnis** an, nie die
  Datensätze. Er muss abbrechbar und wiederholbar sein.
- Ein neues Paket zum Verkleinern (`sharp` o. ä.) kommt hinzu. Es läuft
  **nur auf dem Server**, nie im Browser.

# Out of Scope

- **`PHOTO_MAX_WIDTH_PX` von 1200 herunterzusetzen.** Mit der Miniatur
  daneben sind 1200 für die Vergrösserung vertretbar. Ob 1200 die
  richtige Zahl für das Original ist, ist eine eigene Frage.
- **Die vorhandenen Originale nachträglich zu verkleinern.** Sie bleiben,
  wie sie sind.
- Den Abgleich der Dateinamen gegen `poi_photo`, `document` und
  `trip_titelfoto` auf verwaiste Dateien. Gehört gemessen, sobald ein
  Lesezugriff auf die prod-Datenbank da ist — und dann als eigener Lauf.
- Eine dritte Grösse zwischen Miniatur und Original.
- Die Dokumente (PDF). Sie werden nicht als Kachel gezeigt und haben das
  Problem nicht; sie bekommen nur den `ETag`.
- Das Bild über einen eigenen Dienst oder ein CDN auszuliefern.
- `next/image`. Die Bilder liegen ausserhalb des öffentlich
  ausgelieferten Teils und gehen bewusst über die eigene Schnittstelle
  (`lib/pois/foto-url.ts`).
