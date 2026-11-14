---
id: req-107
title: Vier Handgriffe in der POI-Sicht — Gegend in der Liste, Zuklappen nach dem Speichern, auf der Karte zeigen
app: wegfara
area: Planung
priority: normal
changes: req-097, req-101, req-035, req-070
created: 2026-11-14
---

# Goal (Why)

Vier Stellen in der Orte-Ansicht kosten beim täglichen Pflegen mehr
Handgriffe als nötig. Keine davon ist ein Fehler, alle vier sind Reibung:

**Die Gegend lässt sich nur im Detail ändern.** Der Status steht als
Auswahlfeld in der Zeile (req-097) und ist mit einem Griff gesetzt. Die
Gegend daneben ist ein reines `<span>` — wer sie ändern will, klappt das
Formular auf, tippt, speichert, klappt zu. Dabei ist sie ein Kürzel von
höchstens sechs Zeichen (req-101) und damit das kleinste Feld überhaupt.
Beim Zuordnen einer Reise setzt man sie an vielen POIs hintereinander.

**Nach dem Speichern bleibt das Formular offen.** Es schliesst nur über
„Abbrechen" oder einen zweiten Klick auf den Titel. Wer nacheinander
mehrere POIs pflegt, klappt jedes zweimal zu.

**Es gibt keinen Weg von der Liste zur Karte.** Von der Karte zur Liste
schon: Ein Klick auf einen Marker hebt die Zeile hervor
(`highlightedPoiId`). Umgekehrt nicht — wer wissen will, wo ein POI aus
der Liste liegt, sucht seine Nadel unter allen anderen. Bei einer Reise
mit 170 POIs ist das Suchen.

**Und wenn die Karte ihn zeigt, ist er nicht zu finden.** Ein zentrierter
POI sieht aus wie jeder andere. Es braucht ein Zeichen, das sagt: dieser.

# Scope (What)

## Die Gegend in der Zeile, wie der Status

Das `<span>` wird ein **Eingabefeld mit Vorschlagsliste**: Beim Tippen
schlägt es die Gegenden vor, die in dieser Reise schon vorkommen
(`gegendenAus`), eine neue lässt sich trotzdem eintippen — die Gegend
wird immer von Hand benannt und nie abgeleitet (req-101).

- Gespeichert wird beim Verlassen des Feldes und mit der Eingabetaste.
- Die Länge ist auf `GEGEND_MAX_LAENGE` begrenzt; eine zu lange Eingabe
  wird abgewiesen, nie gekürzt (`gegendZuLang`).
- Ein leeres Feld entfernt die Gegend (`normalisiereGegend` macht daraus
  `null`).
- Ohne Gegend steht wie bisher ein Platzhalter, aus dem ein Klick das
  Feld macht.
- Scheitert das Speichern, bleibt die Eingabe stehen und die Zeile sagt
  es — wie beim Status (bug-021).

Die Spalte behält ihre Breite (78 px): Sechs Zeichen passen hinein, die
Zeilenhöhe von 99 px bleibt.

## Nach dem Speichern klappt das Formular zu

Ein erfolgreiches Speichern im Detail schliesst die Zeile. Der POI steht
danach in der Liste mit seinen neuen Angaben.

Schlägt das Speichern fehl, bleibt es offen — sonst wäre die Eingabe
fort, und die Meldung stünde an einer Zeile, die nichts mehr zeigt.

## Ein Knopf, der den POI auf der Karte zeigt

In der Zeile, bei „Maps" und „Webseite" unter dem Bild, kommt ein
dritter Knopf dazu. Ein Klick darauf:

1. **zentriert die Karte auf den POI und behält den Zoom** — kein
   Hineinzoomen, der Blickwinkel bleibt, nur die Mitte wandert,
2. **lässt den Marker pulsieren**, damit er unter den anderen zu finden
   ist.

Steht bei schmaler Breite gerade die Liste allein (req-088), wechselt
die Ansicht zur Karte — sonst zeigte der Knopf auf etwas Unsichtbares.

## Das Pulsieren

Ein auf- und abschwellender Schein um die Nadel, in ihrer Statusfarbe.
Vorbild ist `welterbeAtmen` in der POI-Liste: ein langsames Atmen, keine
Zappelei.

- Es läuft **einige Sekunden und hört von selbst auf** — ein dauerhaft
  blinkender Marker zöge den Blick von allem anderen ab.
- Ein neuer Klick auf denselben Knopf lässt es von vorn beginnen.
- Es hängt an **einer** Nadel: Ein Klick auf einen anderen POI beendet
  das vorige Pulsieren.
- Bei `prefers-reduced-motion: reduce` pulsiert nichts; stattdessen
  bleibt ein ruhiger Ring um die Nadel stehen, solange sie gewählt ist.
  (So hält es die POI-Liste schon, `poi-list.module.css:238`.)

**Das Pulsieren darf das Neuzeichnen der Marker nicht überleben.**
`renderPois` baut bei jeder Änderung alle Marker neu auf; würde das
Pulsieren dort gesetzt, finge es bei jedem Statuswechsel von vorn an.
Es gehört an das vorhandene Markerelement, nicht in den Aufbau.

# Acceptance Criteria

- [x] Gegeben ein POI in der Liste, wenn ich in der Gegend-Spalte tippe
      und das Feld verlasse, dann ist die Gegend gespeichert.
- [x] Gegeben ich tippe eine Gegend und drücke die Eingabetaste, dann
      ist sie gespeichert, ohne dass ich das Feld verlassen muss.
- [x] Gegeben die Reise kennt „BIO" und „SSE", wenn ich in das Feld
      tippe, dann werden beide vorgeschlagen.
- [x] Gegeben ich tippe eine Gegend, die es noch nicht gibt, dann wird
      sie angelegt — die Vorschläge sind kein Zwang.
- [x] Gegeben ich tippe sieben Zeichen, dann wird die Eingabe abgewiesen
      und die Gegend nicht gekürzt.
- [x] Gegeben ein POI mit Gegend, wenn ich das Feld leere, dann hat er
      keine mehr.
- [x] Gegeben das Speichern der Gegend scheitert, dann bleibt meine
      Eingabe stehen und die Liste sagt, dass es nicht ging.
- [x] Gegeben die Gegend-Spalte, wenn ich sie ansehe, dann ist die Zeile
      weiterhin 99 px hoch und die Spalte 78 px breit.
- [x] Gegeben ein aufgeklapptes Detail, wenn ich speichere, dann klappt
      es zu und die Zeile zeigt die neuen Angaben.
- [x] Gegeben das Speichern im Detail scheitert, dann bleibt es offen
      und meine Eingaben stehen.
- [ ] Gegeben ein POI in der Liste, wenn ich auf „auf der Karte zeigen"
      klicke, dann ist die Karte auf ihn zentriert.
- [ ] Gegeben die Karte steht auf Zoomstufe 11, wenn ich den Knopf
      klicke, dann ist sie danach **immer noch** auf 11.
- [ ] Gegeben ich klicke den Knopf, dann pulsiert die Nadel dieses POI
      und keine andere.
- [ ] Gegeben die Nadel pulsiert, wenn ich einige Sekunden warte, dann
      hört es von selbst auf.
- [ ] Gegeben eine Nadel pulsiert, wenn ich den Knopf eines anderen POI
      klicke, dann pulsiert nur noch dessen Nadel.
- [ ] Gegeben eine Nadel pulsiert, wenn ich den Status eines POI ändere
      (die Marker werden neu gezeichnet), dann fängt das Pulsieren
      **nicht** von vorn an.
- [ ] Gegeben ich habe „weniger Bewegung" eingestellt, dann pulsiert
      nichts und die gewählte Nadel trägt einen ruhigen Ring.
- [ ] Gegeben eine schmale Breite, auf der die Liste allein steht, wenn
      ich den Knopf klicke, dann wechselt die Ansicht zur Karte.
- [ ] Gegeben die Bildschirmprüfung bei 1024, 1280 und 1920 px, dann ist
      sie mit dem neuen Knopf grün und sein Tippziel mindestens
      44 × 44 px (stack.md).

# Constraints

- Die Gegend wird **von Hand benannt**, nie abgeleitet oder
  vorgeschlagen-und-gesetzt (req-101). Die Vorschläge sind eine
  Erleichterung, keine Vorauswahl.
- `GEGEND_MAX_LAENGE` und `normalisiereGegend` gelten unverändert und
  bleiben die einzige Stelle, die darüber entscheidet
  (`lib/pois/gegenden.ts`).
- Die Zeilenhöhe von 99 px und die Spaltenbreiten der dreispaltigen
  Zeile bleiben (req-097). Der Knopf sitzt in der Spalte unter dem Bild,
  bei „Maps" und „Webseite".
- Der Zoom wird beim Zentrieren **nicht** verändert — `setCenter` oder
  `easeTo` ohne `zoom`, nie `flyTo` mit eigener Zoomstufe.
- Das Pulsieren gehört an das Markerelement und nicht in `renderPois`,
  damit es ein Neuzeichnen übersteht.
- `prefers-reduced-motion` wird beachtet, wie überall sonst.
- Der Status in der Zeile bleibt, wie er ist. Dieses Requirement nimmt
  ihn nur zum Vorbild.
- Das Mehrfach-Setzen der Gegend im Auswahlmodus (`onGegendFuerMehrere`,
  req-098) bleibt unberührt und ist der Weg für viele POIs auf einmal.

# Out of Scope

- Den Titel oder andere Felder in der Zeile editierbar zu machen. Erst
  die Gegend, die klein genug dafür ist.
- Eine Gegend umzubenennen und alle POIs mitzuziehen. Eine Gegend
  existiert nur, solange ein POI sie trägt (req-095).
- Das Flyout am Marker (req-070) zu ändern.
- Die Karte auf mehrere POIs einzupassen (ein Rahmen um eine Gegend oder
  eine Auswahl). Hier geht es um einen POI.
- Von der Karte zur Liste zu springen — den Weg gibt es schon
  (`highlightedPoiId`).
- Das Pulsieren in der POI-Auswahl der Planung oder im Begleiter.
