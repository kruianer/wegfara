---
id: req-098
title: Filter, Sortierung und Massenaktionen der POI-Liste
app: wegfara
area: Planung
priority: normal
changes: req-010, req-054, req-060, req-069, req-095, req-097
created: 2026-10-28
---

# Goal (Why)

Der Kopf der POI-Liste trägt **neun Bedienelemente gleichzeitig**: Typ,
Status, Sortierung, Gegend (seit req-095), „Alle auswählen",
Status-für-Ausgewählte, Papierkorb, Bewertungsrunde starten/beenden und
den Hinweis auf eine laufende Runde.

Mit der schmalen Spalte aus req-097 (324 px) ist das nicht unterzubringen.
Und ein Teil davon wird selten gebraucht: Der Papierkorb steht dauerhaft
da für eine Handlung, die fast nie vorkommt.

Dazu fehlt die Frage, die beim Aussortieren einer Sammlung am häufigsten
ist: **„Zeig mir alles, was Fix *oder* Alternative ist."** Das geht heute
nicht — jeder Filter lässt „alle oder genau einen" Wert zu
(`PoiStatusFilter`, `lib/pois/types.ts:133`).

Entwurf: `delivery/design/poi-liste/filter.mockup.html`

**Nur iPad quer und grösser** (ab 1024 px), wie req-097.

# Function (What)

## Drei Zustände, von denen immer nur einer sichtbar ist

| Zustand | Was im Kopf steht |
|---|---|
| **Ruhe** | Suchfeld · Filter · Sortieren · Auswählen |
| **Filter offen** | dasselbe, darunter ein Blatt mit allen Filtern |
| **Auswahl** | Massenaktionen an der Stelle der Filter |

Im Ruhezustand ist der Kopf **eine Zeile** mit vier Griffen. Filter und
Sortieren sind **Symbolknöpfe**; die Beschriftungen „Typ", „Status",
„Sortieren" entfallen und sparen rund 90 px.

Alle vier Griffe sehen gleich aus — sie sind Werkzeuge der Liste. Ohne
Rahmen bleiben nur **„Fertig"** und **„Alle zurücksetzen"**: Sie verlassen
einen Zustand, statt einen zu öffnen.

## Mehrfachwahl je Filter

Das ist die eigentliche Änderung. Je Feld lassen sich **mehrere Werte**
wählen:

- **innerhalb** eines Feldes gilt **oder** — Status (Fix oder Alternative)
- **zwischen** den Feldern gilt **und** — Status (…) und Gegend (BIO)

Keine Wahl in einem Feld heisst: dieses Feld filtert nicht. Das ersetzt
den heutigen Wert „alle".

Vier Felder: **Status**, **Gegend** (mit „ohne"), **Typ** und — in der
Tagesplanung — **Verplanungsstand** (req-083).

## Die Farbkodierung ist durchgängig

Status und Typ tragen beide ihren **Farbpunkt**, immer sichtbar, nicht nur
im gewählten Zustand. Es sind dieselben Farben wie in der Zeile
(`POI_STATUS_COLOR`, `POI_TYPE_COLOR`) und auf der Karte.

Eine Liste von sieben Typen mit Punkt überfliegt man; sieben graue Wörter
muss man lesen.

## Was gefiltert ist, steht da

**Der Filter-Knopf nennt die Zahl** der gesetzten Filter („2"). Heute muss
man vier Auswahlfelder durchsehen, um zu erkennen, warum die Liste kurz
ist.

**Zugeklappt stehen die gesetzten Filter als Chips** unter dem Titel, jeder
einzeln wegklickbar, dazu „zurücksetzen" für alle.

**Im Titel steht „7 von 32"** statt nur der Zahl. Das ist nicht nur
Kosmetik: Die Karte hat **ihre eigene Statusauswahl** (req-013,
`poi-map.tsx`), und die Filter der Liste wirken dort nicht. Ohne den
Hinweis wundert man sich, warum die Karte mehr Nadeln zeigt als die Liste
Zeilen.

## Die leere Liste erklärt sich

Passt kein POI, nennt die Meldung **warum** — „Status *Nein* und Gegend
*RIO* kommen zusammen nicht vor" — und bietet das Zurücksetzen an.

Mit Mehrfachwahl widersprechen sich Filter leichter, also wird das
häufiger als heute.

## Das Suchfeld

Links im Kopf, sucht in **Name und Ort**. Bei 30 POIs ist Tippen schneller
als Filtern, und es gibt es heute nicht.

Es wirkt **zusätzlich** zu den Filtern, nicht statt ihrer.

## Sortieren

Dieselben vier Ordnungen wie heute (`POI_SORTIERUNG_LABEL`): Nummer,
Name, Status, Bewertung. Neu ist nur, dass jede ihre **Richtung** nennt —
„1 → 32", „A → Z", „Fix zuerst", „beste zuerst". Das stand nirgends.

**Kein Umschalten der Richtung.** Aufsteigend/absteigend je Ordnung wären
acht Zustände für einen seltenen Wunsch; jede Ordnung hat die Richtung,
die man meint, wenn man sie wählt.

## Massenaktionen

Im Auswahlmodus treten sie an die Stelle der Filter — beides wird nie
gleichzeitig gebraucht.

- **Status…** für alle Angekreuzten (req-069, unverändert)
- **Gegend…** für alle Angekreuzten (**neu**, zu req-095) — „diese sechs
  sind alle Bilbao" ist die häufigste Zuordnung
- **Entfernen** mit der **Zahl** im Knopf („3"), nicht nur dem Symbol. Bei
  einer endgültigen Handlung muss dastehen, wie viele es trifft; die
  Rückfrage danach bleibt (req-057).

Dazu **„Fertig"** zum Verlassen. Das Ankreuzfeld je Zeile erscheint nur in
diesem Zustand (req-097).

## Die Bewertungsrunde verlässt den Kopf

Heute stehen „Runde starten", „Runde beenden" und der Hinweis auf eine
laufende Runde im Kopf der POI-Liste (`poi-list.tsx:458`) — drei der neun
Elemente.

Sie ist aber **keine Ansicht-Einstellung**, sondern ein Vorgang über die
ganze Reise, und es gibt genau eine (req-054). Sie wandert in den Bereich
**„Bewertungen"**, wo ihr Stand ohnehin steht (req-063).

Das befreit die Plätze, die der Rest braucht.

# GUI

- Entwurf: `delivery/design/poi-liste/filter.mockup.html`
- Verbindlichkeit: eng folgen bei Aufbau und Zuständen. Die Farben sind
  die bestehenden — es wird keine erfunden.
- Die vier Regeln aus `stack.md` gelten bei **1024, 1280 und 1920 px**.
- Tippziele mindestens 44 × 44 px. Die Pillen im Filterblatt sind 26 px
  hoch — sie liegen in einem Blatt, das sich nur mit Absicht öffnet, und
  ihre Zeile ist mit dem Abstand dazwischen 44 px hoch. **Das ist beim
  Umsetzen zu prüfen**; hält es nicht, werden die Pillen höher und das
  Blatt rollt.
- Kontrast nach `lib/design/kontrast.ts` für die farbigen Pillen und
  Chips.

# Acceptance Criteria

- [ ] Gegeben die POI-Liste im Ruhezustand, wenn ich den Kopf ansehe,
      dann stehen dort genau vier Griffe: Suchen, Filter, Sortieren,
      Auswählen.
- [ ] Gegeben der Ruhezustand, wenn ich den Kopf ansehe, dann steht dort
      KEIN Auswahlfeld für Typ, Status oder Sortierung.
- [ ] Gegeben ich tippe auf Filter, wenn das Blatt aufgeht, dann sehe ich
      die Felder Status, Gegend und Typ.
- [ ] Gegeben ich wähle im Status „Fix" UND „Alternative", wenn ich die
      Liste ansehe, dann stehen die POIs beider Status da.
- [ ] Gegeben ich wähle Status „Fix" und Gegend „BIO", wenn ich die Liste
      ansehe, dann stehen nur POIs da, die beides erfüllen.
- [ ] Gegeben ich wähle in einem Feld nichts, wenn ich die Liste ansehe,
      dann filtert dieses Feld nicht.
- [ ] Gegeben zwei Filter sind gesetzt, wenn ich den Filter-Knopf ansehe,
      dann steht dort „2".
- [ ] Gegeben Filter sind gesetzt und das Blatt ist zu, wenn ich den Kopf
      ansehe, dann stehen sie als Chips da.
- [ ] Gegeben ein Chip, wenn ich sein Kreuz antippe, dann ist dieser
      Filter weg und die übrigen bleiben.
- [ ] Gegeben 7 von 32 POIs passen, wenn ich den Titel ansehe, dann steht
      dort „7 von 32".
- [ ] Gegeben kein POI passt, wenn ich die Liste ansehe, dann nennt die
      Meldung die gesetzten Filter und bietet das Zurücksetzen an.
- [ ] Gegeben das Filterblatt, wenn ich die Typen ansehe, dann trägt jeder
      seinen Farbpunkt — auch die nicht gewählten.
- [ ] Gegeben ich tippe „Gugg" in das Suchfeld, wenn ich die Liste ansehe,
      dann steht das Guggenheim-Museum da.
- [ ] Gegeben ich tippe „Bilbao" in das Suchfeld, wenn ich die Liste
      ansehe, dann stehen die POIs dieses Orts da.
- [ ] Gegeben ich suche und habe einen Filter gesetzt, wenn ich die Liste
      ansehe, dann wirken beide.
- [ ] Gegeben das Sortierblatt, wenn ich es ansehe, dann nennt jede
      Ordnung ihre Richtung.
- [ ] Gegeben ich tippe „Auswählen", wenn ich den Kopf ansehe, dann stehen
      dort „Status…", „Gegend…", „Entfernen" und „Fertig" — und KEIN
      Filter.
- [ ] Gegeben ich habe drei POIs angekreuzt, wenn ich den Entfernen-Knopf
      ansehe, dann steht dort die Zahl 3.
- [ ] Gegeben ich habe sechs POIs angekreuzt und wähle „Gegend… BIO",
      dann tragen alle sechs danach diese Gegend.
- [ ] Gegeben ich tippe „Fertig", wenn ich den Kopf ansehe, dann stehen
      wieder die vier Griffe da und die Auswahl ist leer.
- [ ] Gegeben der Kopf der POI-Liste, wenn ich ihn ansehe, dann gibt es
      dort KEINE Bewertungsrunde.
- [ ] Gegeben der Bereich „Bewertungen", wenn ich ihn ansehe, dann lässt
      sich dort eine Runde starten und beenden.
- [ ] Gegeben eine laufende Runde, wenn ich den Bereich „Bewertungen"
      ansehe, dann steht dort, dass sie läuft und über wie viele POIs.
- [ ] Gegeben die Liste bei 1024, 1280 und 1920 px, wenn die
      Bildschirmprüfung läuft, dann ist sie grün — auch mit offenem
      Filterblatt und im Auswahlmodus.

# Constraints

- Die Filtertypen werden von „alle oder genau einer" auf **Mengen**
  umgestellt: `PoiStatusFilter`, `PoiTypeFilter` und `PoiGegendFilter`
  (`lib/pois/types.ts`). Der Wert „alle" entfällt — die leere Menge sagt
  dasselbe und ist eindeutiger.
- Das Filtern bleibt an **einer** Stelle (`gefiltertePois` in
  `lib/pois/listenansicht.ts`). Es entsteht keine zweite Filterlogik
  (vgl. req-082).
- Die Filter wirken weiter **allein auf die Liste**. Die Statusauswahl
  der Karte (req-013) bleibt getrennt — so steht es in
  `listenansicht.ts:11`, und es ist richtig: Man will auf der Karte mehr
  sehen als in der Liste.
- Die gemerkten Filter je Reise (bug-052) bleiben, **der Suchbegriff
  nicht**. Kommt man nach einer Woche zurück und die Liste zeigt 7 von 32
  wegen eines vergessenen Suchworts, ist das unangenehm; bei Filtern sagen
  es die Chips.
- Die gespeicherten Einstellungen tragen heute einzelne Werte. Beim Lesen
  eines alten Stands wird ein einzelner Wert zur Menge mit einem Element,
  „alle" zur leeren Menge — niemand verliert seine Ansicht.
- Die Massenaktionen nutzen die vorhandenen Wege: `setPoiStatuses`
  (req-069) und `deletePois` (req-057). „Gegend…" braucht einen neuen,
  gebaut nach demselben Muster.
- Die Tests zu req-060 (Filter), req-069 (Massenstatus) und req-054
  (Bewertungsrunde im Kopf) sind **anzupassen, nicht zu löschen**.

# Out of Scope

- Das Aussehen der Zeile selbst — das ist req-097.
- Das Telefon-Layout (375 px).
- Die Statusnamen umbenennen (`Fix · Alternative · Warteliste · Nein ·
  Offen`) — entschieden, aber ein eigenes Requirement.
- Das zweite Feld „Kürzel" an der Gegend — gehört zu req-095.
- Die Statusauswahl der Karte (req-013) ändern oder mit der Liste
  zusammenlegen.
- Filter in der POI-Auswahl der Tagesplanung neu ordnen. Sie bekommt die
  Mehrfachwahl, aber ihre Zeile bleibt, wie req-083 und req-095 sie
  gelassen haben.
- Gespeicherte Filtersätze („meine Ansicht Bilbao").
- Nach Bewertung, Kosten oder Dauer filtern.
