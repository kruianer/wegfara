---
id: req-088
title: Planer auf dem iPad hochkant (768 px)
app: wegfara
area: Planung
priority: normal
created: 2026-10-26
---

# Goal (Why)

Als Reiseleiter will ich den Planer auch auf dem iPad hochkant benutzen.
Heute kommt dort statt des Planers der Hinweis „Bildschirm zu schmal" —
das iPad muss gedreht werden, und im Querformat bleibt für die Tastatur
kaum Platz.

Das iPad ist das Gerät, das beim Planen am Tisch liegt. Dass es die eine
Ansicht nicht zeigt, für die es gedacht ist, ist der störende Teil.

Die Mindestbreite von 1180 px stammt aus req-009 und war richtig, solange
der Planer aus drei festen Spalten nebeneinander bestand. Sie wird mit
diesem Requirement auf **768 px** gesenkt — die Breite, gegen die
`stack.md` ohnehin jede Oberfläche prüft.

# Function (What)

Der Planer erscheint ab **768 px** statt ab 1180 px. Der Hinweis
„Bildschirm zu schmal" bleibt für alles darunter (Telefon) bestehen und
verweist weiter auf den Begleiter.

## Warum das mehr ist als eine Zahl

Die festen Breiten passen bei 768 px nicht nebeneinander. Gemessen am
Bereich **Planung**, der die drei Spalten trägt:

| Teil | Breite |
|---|---|
| Seitenleiste eingeklappt | 66 px |
| POI-Spalte (`unplanned-column`) | 294 px |
| Zeitstrahl (`timeline-column`) | 412 px |
| **zusammen** | **772 px** |

Schon ohne die Karte sind das 4 px mehr als die ganze Breite. Die Karte
(`day-route-map`, `flex: 1`) bekäme nichts. Es braucht also eine Ordnung
für schmale Breite, nicht nur eine gesenkte Schwelle.

## Die Ordnung bei schmaler Breite

**Ab 1180 px bleibt alles, wie es ist** — drei Spalten nebeneinander, am
Trenner verschiebbar. Daran wird nichts geändert.

**Unter 1180 px** zeigt der Bereich Planung **zwei** der drei Spalten
gleichzeitig: den Zeitstrahl, und daneben entweder die POI-Spalte **oder**
die Karte. Welche von beiden, entscheidet ein Umschalter über der Spalte.

Der Zeitstrahl bleibt immer stehen, denn er ist das Ziel jeder Handlung:
POIs werden auf ihn gezogen, und die Karte zeigt, was auf ihm liegt.
Verschwände er, wäre das Planen am iPad keines mehr.

Die gewählte Seite bleibt beim Wechsel des Reisetags und des Bereichs
erhalten — wer die Karte offen hat, will sie nach dem Tageswechsel wieder
sehen.

## Die Seitenleiste

Sie bleibt, wie req-077 sie gebaut hat: eingeklappt 66 px mit Symbolen,
aufgeklappt 320 px **mit Text** — Name, Slogan, gewählte Reise und die
Namen der Bereiche. Das Auf- und Zuklappen über die Kompassrose, der
Schleier daneben zum Schließen, die 44×44-Tippziele: alles unverändert.

Nur eines kommt hinzu: Bei schmaler Breite deckt die aufgeklappte Leiste
mit 320 px fast die halbe Fläche. Sie klappt deshalb nach der Wahl eines
Bereichs zu — das tut sie heute schon (`mitZugeklappterLeiste`), und bei
768 px ist es keine Feinheit mehr, sondern notwendig.

## Die übrigen Bereiche

Die Bereiche **POIs** und **Chat** nutzen die `SplitView` mit
verschiebbarem Trenner und einer linken Spalte von mindestens 410 px.
Mit der eingeklappten Leiste bleiben bei 768 px noch 284 px für die
rechte Seite. Hier gilt dasselbe Mittel: unter 1180 px eine Seite
zeigen, mit Umschalter; die linke Spalte darf dann die ganze Breite
nutzen.

**Bewertungen, Kosten, Dokumente und Reisedetails** sind einspaltig und
brauchen nur die Prüfung gegen die vier Regeln aus `stack.md`.

# GUI

- Vorlage: `delivery/design/planer/Reiseplaner v4.dc.html`
- Verbindlichkeit: eng folgen, soweit die Vorlage trägt. Sie zeigt den
  Planer nur breit; für die schmale Ordnung gibt es keine Vorlage.
- Der Umschalter zwischen POI-Spalte und Karte folgt den Mustern, die es
  schon gibt (Tagesreiter, Bereichsliste): Text, nicht nur Symbol, und
  44×44 px Tippziel. Kein neues Gestaltungsmittel.
- Bei 768 px gelten die vier Regeln aus `stack.md` ohne Ausnahme: nichts
  über den Rand, nichts überlappt, alles Bedienbare erreichbar, Tippziele
  mindestens 44×44 px.

# Acceptance Criteria

- [x] Gegeben ein Fenster von 768 px Breite, wenn ich den Planer öffne,
      dann sehe ich ihn — und NICHT den Hinweis „Bildschirm zu schmal".
- [x] Gegeben ein Fenster von 767 px Breite, wenn ich den Planer öffne,
      dann sehe ich weiterhin den Hinweis mit dem Verweis auf den
      Begleiter.
- [x] Gegeben 768 px und der Bereich Planung, wenn ich ihn ansehe, dann
      sehe ich den Zeitstrahl und daneben eine zweite Spalte — nicht drei
      nebeneinander.
- [x] Gegeben 768 px im Bereich Planung, wenn ich auf „Karte" umschalte,
      dann steht die Karte neben dem Zeitstrahl und die POI-Spalte ist
      verborgen.
- [x] Gegeben 768 px mit offener Karte, wenn ich den Reisetag wechsle,
      dann ist die Karte weiterhin offen.
- [x] Gegeben 1280 px, wenn ich den Bereich Planung ansehe, dann stehen
      POI-Spalte, Zeitstrahl und Karte nebeneinander wie bisher UND es
      gibt keinen Umschalter.
- [x] Gegeben 768 px, wenn ich die Seitenleiste aufklappe, dann stehen
      dort Name, Slogan, gewählte Reise und die Namen der Bereiche als
      Text.
- [x] Gegeben 768 px mit aufgeklappter Seitenleiste, wenn ich einen
      Bereich wähle, dann klappt die Leiste zu und der Bereich erscheint.
- [x] Gegeben 768 px, wenn ich die Seitenleiste eingeklappt lasse, dann
      ist sie 66 px breit und zeigt nur Symbole.
- [x] Gegeben 768 px im Bereich POIs, wenn ich ihn ansehe, dann sehe ich
      eine der beiden Seiten vollflächig mit einem Umschalter zur
      anderen.
- [ ] Gegeben 768 px, wenn ich die Bereiche Bewertungen, Kosten,
      Dokumente und Reisedetails ansehe, dann ragt in keinem etwas über
      den Rand und die Seite lässt sich nicht seitlich scrollen.
- [ ] Gegeben 768 px, wenn ich einen POI aus der Spalte auf den
      Zeitstrahl ziehe, dann wird er eingeplant wie bei grosser Breite.
- [ ] Gegeben 768 px, wenn ich eine eingeplante Aktivität auf dem
      Zeitstrahl verschiebe, dann liegt die Geistbox deckungsgleich auf
      der angefassten Box (bug-066 gilt auch hier).

# Constraints

- Die Schwelle steht an genau einer Stelle
  (`PLANNER_MIN_WIDTH_PX` in `lib/plan/viewport.ts`). Sie bleibt dort;
  es kommt keine zweite Zahl daneben.
- Die Breite, ab der von drei auf zwei Spalten gewechselt wird, ist
  ebenfalls eine benannte Konstante an einer Stelle — nicht als Zahl in
  mehreren CSS-Dateien verteilt (vgl. req-082, wo dasselbe Raster
  dreimal stand).
- Die Umschaltung gehört in die Komponente, die die Spalten anordnet.
  Welche Seite gewählt ist, ist Zustand der Ansicht, nicht der Daten —
  er wird nicht gespeichert.
- Am Verhalten ab 1180 px wird nichts geändert. Die bestehenden Tests zu
  Trenner, Zeitstrahl und Karte müssen unverändert grün bleiben.
- Die Mindestbreite von 1180 px in req-009 (Abschnitt GUI, „Die
  Mindestbreite beträgt 1180 Pixel") wird durch dieses Requirement
  ersetzt. req-009 ist entsprechend zu ergänzen.
- Keine Erkennung des Geräts, nur der Breite. Ein schmales Fenster auf
  dem Laptop verhält sich wie ein iPad hochkant.

# Out of Scope

- Der Planer auf dem Telefon (375 px). Dort bleibt der Hinweis; dafür
  gibt es den Begleiter.
- Den Begleiter auf breiten Bildschirmen ändern.
- Wischgesten zum Umschalten zwischen den Spalten. Der Umschalter
  genügt; eine Geste wäre ein eigenes Thema und kollidiert mit dem
  Ziehen auf dem Zeitstrahl.
- Die Spaltenbreiten bei grosser Breite neu abstimmen.
- Den gedruckten Reiseplan (req-080).
