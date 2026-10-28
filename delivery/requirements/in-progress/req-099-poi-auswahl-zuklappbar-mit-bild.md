---
id: req-099
title: POI-Auswahl der Planung zuklappbar, mit Bild und Filtern
app: wegfara
area: Planung
priority: normal
changes: req-083, req-088, req-098
created: 2026-10-28
---

# Goal (Why)

Beim Planen eines Tages brauche ich die Karte gross — dort sehe ich, ob
zwei Orte beieinander liegen und ob die Route einen Umweg macht. Die
POI-Auswahl links nimmt dauerhaft Platz weg, obwohl ich sie nur brauche,
wenn ich einen POI auf den Zeitstrahl ziehe.

Gemessen am 28.10.2026 bei 1280 px: Seitenleiste 60 + POI-Auswahl 294 +
Zeitstrahl 412 = 766 px fest, der Karte bleiben **514 px**.

Dazu zeigt eine Karte in der Auswahl heute **nur den Namen** mit einer
Zahl — kein Bild, keine Bewertung, keinen Buchungszustand. Beim Suchen in
32 POIs ist ein Bild schneller als eine Textzeile.

Entwurf: `delivery/design/planung/poi-auswahl.mockup.html`

**Nur iPad quer und grösser** (ab 1024 px), wie req-097 und req-098.

# Function (What)

## Die Auswahl lässt sich zuklappen

Ein Griff im Kopf klappt sie zu. Übrig bleibt ein **Streifen von 40 px**
mit dem Griff zum Aufklappen, der Zahl der gefilterten POIs und der
Beschriftung senkrecht.

Sie verschwindet **nicht** ganz: Sonst wüsste niemand, wie sie
zurückkommt.

**Weil sie zuklappbar ist, darf sie offen breiter sein:** 340 px statt
294. Gerechnet bei 1280 px:

| | Karte bekommt |
|---|---|
| heute, 294 px | 514 px |
| neu offen, 340 px | 468 px |
| **neu zugeklappt** | **808 px** |

Das Zuklappen bringt 340 px — weit mehr, als eine schmalere Spalte je
bringen könnte.

**Zugeklappt lässt sich nicht ziehen.** Die Auswahl springt dabei
**nicht** von selbst auf — ein Blatt, das beim Anfassen aufklappt,
überrascht, und der zugeklappte Zustand dient dem Ansehen der Route, nicht
dem Planen. Wer ziehen will, klappt vorher auf.

Der Zustand wird **je Reise gemerkt**, wie die Filter (bug-052): Beim
Wechsel des Reisetags und beim Sprung in einen anderen Bereich und zurück
bleibt die Auswahl, wie man sie verlassen hat.

## Die Karten zeigen ein Bild

Dasselbe Muster wie die POI-Liste (req-097), nur kleiner:

- **Bild 78 × 58 px**, darauf die **Nummer** oben links und der **Typ**
  unten in seiner Typfarbe (`POI_TYPE_COLOR`), beide leicht
  durchscheinend. **Weltkulturerbe** mit Glow und leisem Atmen.
- **Darunter** Bewertung (`★ 4,7`) und der Buchungszustand als Symbol.
  Ist nichts zu buchen, steht nichts.
- **In der Mitte** Titel, Ort und die **Dauer**.
- **Rechts** der Status als farbige Pille und der Verplanungsstand.

**Die Dauer bleibt** — anders als in der POI-Liste, wo sie entfällt
(req-097). Hier ist sie die wichtigste Zahl: Sie entscheidet, wie hoch der
Block auf dem Zeitstrahl wird.

**Der Verplanungsstand steht immer.** Heute fehlt die Zahl bei
unverplanten POIs ganz (req-083); künftig steht dort ein gestrichelter
Rahmen mit „0". Dieselbe Aussage, aber an derselben Stelle — so bleiben
die Karten gleich hoch.

Hat ein POI kein Bild, stehen Nummer und Typ trotzdem auf der leeren
Fläche.

## Filter und Sortierung wie in der POI-Liste

Der Kopf übernimmt den Aufbau aus req-098: **Suchfeld**, **Filter** als
Symbolknopf mit Zähler, **Sortieren** als Symbolknopf. Gesetzte Filter
stehen zugeklappt als Chips darunter, einzeln wegklickbar. Im Titel steht
„9 von 32".

**Mehrfachwahl je Feld**, wie req-098: innerhalb eines Feldes *oder*,
zwischen den Feldern *und*.

Zwei Unterschiede zur POI-Liste:

**„Verplanung" steht als erstes Feld** — „Was habe ich noch nicht
eingeplant?" ist beim Planen die häufigste Frage. Das Feld gilt nur hier
(req-083); die POI-Liste im Bereich „Orte" hat es nicht.

**Beim Sortieren kommt „Dauer" dazu** — fünf Ordnungen statt vier. Wer
eine Lücke von 45 Minuten füllen will, sucht den kurzen POI. In der
POI-Liste wäre sie Ballast, weil dort die Dauer nicht steht.

## Die Geistbox beim Ziehen trägt kein Bild

Beim Ziehen entsteht eine Geistbox (bug-066). Sie zeigt **Nummer, Titel
und Dauer**, nicht das Bild: Mit Bild wird sie grösser als der Block, den
sie ankündigt, und träger beim Bewegen.

# GUI

- Entwurf: `delivery/design/planung/poi-auswahl.mockup.html`
- Verbindlichkeit: eng folgen bei Aufbau und Massen. Die Farben sind die
  bestehenden (`POI_TYPE_COLOR`, `POI_STATUS_COLOR`) — keine wird
  erfunden.
- Das Zuklappen folgt dem Muster, das die `SplitView` schon hat
  (`collapseToggle`, `split-view.tsx:184`): Symbol statt Text, der Zustand
  am `aria-pressed`, der Name im `title` und `aria-label`.
- Der Griff im Streifen ist mindestens 44 × 44 px — er ist der einzige Weg
  zurück.
- Der Bildlaufbalken nutzt `components/bildlauf.module.css` (bug-041); die
  Spalte tut das heute schon.
- Bei 1024, 1280 und 1920 px gelten die vier Regeln aus `stack.md`, offen
  **und** zugeklappt, mit und ohne Filterblatt.
- Kontrast nach `lib/design/kontrast.ts` für die farbigen Pillen und den
  weissen Text auf dem Typ-Band.

# Acceptance Criteria

- [x] Gegeben die Planung bei 1280 px, wenn ich sie öffne, dann ist die
      POI-Auswahl 340 px breit.
- [x] Gegeben die POI-Auswahl, wenn ich den Griff im Kopf antippe, dann
      klappt sie zu und es bleibt ein Streifen von etwa 40 px.
- [x] Gegeben die Auswahl ist zugeklappt, wenn ich die Karte ansehe, dann
      ist sie rund 340 px breiter als vorher.
- [x] Gegeben die Auswahl ist zugeklappt, wenn ich den Streifen ansehe,
      dann trägt er einen Griff zum Aufklappen von mindestens 44 × 44 px.
- [x] Gegeben die Auswahl ist zugeklappt, wenn ich den Griff antippe,
      dann steht sie wieder offen.
- [x] Gegeben die Auswahl ist zugeklappt und ich wechsle den Reisetag,
      dann ist sie weiterhin zugeklappt.
- [x] Gegeben die Auswahl ist zugeklappt und ich wechsle in den Bereich
      „Orte" und zurück, dann ist sie weiterhin zugeklappt.
- [x] Gegeben ein POI mit Foto, wenn ich seine Karte ansehe, dann sehe ich
      das Bild mit der Nummer oben links und dem Typ unten.
- [x] Gegeben ein POI ohne Foto, wenn ich seine Karte ansehe, dann stehen
      Nummer und Typ trotzdem da.
- [x] Gegeben ein POI vom Typ „Hotel", wenn ich seine Karte ansehe, dann
      trägt das Typ-Band die Farbe dieses Typs.
- [x] Gegeben ein POI mit Bewertung, wenn ich seine Karte ansehe, dann
      steht sie unter dem Bild.
- [x] Gegeben ein POI mit Buchung „nicht nötig", wenn ich seine Karte
      ansehe, dann steht dort KEIN Buchungszeichen.
- [x] Gegeben ein POI mit hinterlegter Dauer, wenn ich seine Karte
      ansehe, dann steht sie da.
- [x] Gegeben ein noch nicht verplanter POI, wenn ich seine Karte ansehe,
      dann steht rechts ein gestrichelter Rahmen mit „0".
- [x] Gegeben ein POI, der an diesem Tag zweimal vorkommt, wenn ich seine
      Karte ansehe, dann steht dort „2".
- [x] Gegeben die Auswahl, wenn ich den Kopf ansehe, dann stehen dort
      Suchfeld, Filter, Sortieren und der Griff zum Zuklappen.
- [x] Gegeben ich öffne das Filterblatt, wenn ich es ansehe, dann steht
      „Verplanung" als erstes Feld.
- [x] Gegeben ich wähle „Noch unverplant" und die Gegend „SSE", wenn ich
      die Liste ansehe, dann stehen nur POIs da, die beides erfüllen.
- [x] Gegeben ich öffne das Sortierblatt, wenn ich es ansehe, dann steht
      „Dauer" als fünfte Ordnung da.
- [x] Gegeben ich ziehe einen POI auf den Zeitstrahl, wenn die Geistbox
      erscheint, dann trägt sie KEIN Bild.
- [x] Gegeben ich ziehe einen POI auf den Zeitstrahl, wenn ich ihn
      ablege, dann wird er eingeplant wie bisher.
- [ ] Gegeben die Planung bei 1024, 1280 und 1920 px, wenn die
      Bildschirmprüfung läuft, dann ist sie grün — offen und zugeklappt.

# Constraints

- Die Breiten stehen als Token an **einer** Stelle. Die 294 px in
  `unplanned-column.module.css` werden ersetzt, nicht ergänzt.
- Das Zuklappen nutzt das Muster der `SplitView`, statt ein zweites zu
  erfinden. Was dort „Liste ausblenden" heisst, heisst hier „Auswahl
  zuklappen" — dieselbe Art Knopf.
- Der gemerkte Zustand liegt bei den übrigen Ansicht-Einstellungen
  (`lib/pois/ansicht-einstellungen.ts`), je Reise, wie Filter und
  Sortierung (bug-052).
- Die Filterlogik bleibt an **einer** Stelle. Was req-098 für die
  POI-Liste baut, gilt hier mit einem Feld mehr — es entsteht keine zweite
  Filterlogik (vgl. req-082).
- Das Ziehen bleibt unverändert: `onDragStart` und `usePointerDrag`
  (req-046, bug-017, bug-023) wirken wie bisher. Nur die Geistbox zeigt
  weniger.
- Die Karte darf nicht höher werden als nötig. Sie wächst von etwa 54 auf
  etwa 75 px; mehr soll sie nicht werden, sonst scrollt man bei 32 POIs
  zu viel.
- Die Tests zu req-083 (Verplanungsfilter, Zahl am POI) und req-046
  (Ziehen) sind **anzupassen, nicht zu löschen**.
- Setzt req-098 voraus: Suchfeld, Mehrfachwahl, Chips und die
  Symbolknöpfe entstehen dort. Wird dieses Requirement zuerst umgesetzt,
  entsteht die Hälfte zweimal.

# Out of Scope

- Der Zeitstrahl selbst und die Tagesroute.
- Die POI-Liste im Bereich „Orte" — das sind req-097 und req-098.
- Das Telefon-Layout (375 px) und die schmale Ordnung zwischen 768 und
  1180 px (req-088). Dort steht die Auswahl allein, und das Zuklappen
  hätte keinen Sinn.
- Massenaktionen in der POI-Auswahl. Hier wird gezogen, nicht verwaltet.
- Den Zeitstrahl zuklappen.
- Die Statusnamen umbenennen — eigenes Requirement.
- Die Geistbox sonst ändern (bug-066 bleibt, wie es ist).
