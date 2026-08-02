---
id: req-014
title: POIs per KI-Suche befüllen
app: wegfara
area: Planung
priority: high
created: 2026-08-02
---

# Ziel (Warum)

Als Reiseleiter will ich eine leere POI-Sammlung nicht von Hand
befüllen müssen. Ich habe ein Gebiet abgesteckt — die App soll mir
sagen, was dort lohnt, damit ich einen Ausgangspunkt habe, den ich
danach zurechtstutze.

# Funktion (Was)

Im Bereich „POIs" gibt es eine Schaltfläche, die eine Suche nach
Orten innerhalb des Suchgebiets auslöst. Daneben liegt ein Textfeld,
in das ein kurzer Wunsch eingetragen werden kann („ruhige Strände",
„mit Kindern", „höchstens 20 Treffer"). Das Feld darf leer bleiben.

Die Suche läuft in vier Schritten:

1. Aus dem Suchgebiet wird eine Beschreibung gewonnen: der Name der
   Region, in der es liegt, und seine ungefähre Ausdehnung.
2. Die KI wird nach passenden Orten gefragt — begrenzt auf die Typen,
   die der Typfilter der Liste gerade zulässt. Steht der Filter auf
   „Alle", gilt keine Einschränkung.
3. Jeder vorgeschlagene Ort wird in den Kartendaten nachgeschlagen.
   Wird er dort nicht gefunden, entfällt er.
4. Von den gefundenen Orten wird geprüft, ob sie innerhalb des
   Suchgebiets liegen. Nur diese werden als POI angelegt, mit den
   Angaben aus den Kartendaten und dem Status „Weiß noch nicht".

Die KI liefert höchstens zehn Vorschläge je Lauf. Nennt der eingegebene
Text eine andere Anzahl, gilt diese.

Wird die Schaltfläche erneut gedrückt, sucht die KI **weitere** Orte:
Ihr werden die bereits gesammelten POIs der Reise genannt, damit sie
andere vorschlägt. Orte, die bereits als POI vorhanden sind, werden
nicht ein zweites Mal angelegt.

Ohne gezeichnetes Suchgebiet ist die Schaltfläche nicht bedienbar; ein
Hinweis nennt den Grund.

Während der Suche ist die Schaltfläche gesperrt und zeigt, dass
gearbeitet wird. Danach erscheint eine Zeile mit der Anzahl der neu
angelegten POIs und der Anzahl der verworfenen Vorschläge.

Schlägt die Suche fehl, bleibt die POI-Liste unverändert und es
erscheint ein Hinweis darauf.

# GUI

- Schaltfläche und Textfeld liegen über der POI-Liste, im Bereich des
  vorhandenen Banners aus req-010.
- Die Schaltfläche folgt dem Stil der gefüllten Schaltflächen des
  Planer-Designs (Akzentfarbe, Pillenform).
- Die Ergebniszeile erscheint unterhalb, im Stil der Hinweisfelder des
  Designs (`hintBg`, `hintBd`).

# Akzeptanzkriterien

- [ ] Gegeben eine Reise ohne gezeichnetes Suchgebiet, wenn ich den
      Bereich „POIs" öffne, dann ist die Schaltfläche zur Suche nicht
      bedienbar.
- [ ] Gegeben ein gezeichnetes Suchgebiet um Alberobello und der
      Typfilter steht auf „Alle", wenn ich die Suche auslöse, dann
      erscheinen neue POIs in der Liste.
- [ ] Gegeben derselbe Zustand, wenn die Suche abgeschlossen ist, dann
      haben alle neu angelegten POIs den Status „Weiß noch nicht".
- [ ] Gegeben derselbe Zustand, wenn die Suche abgeschlossen ist, dann
      liegen alle neu angelegten POIs innerhalb des Suchgebiets.
- [ ] Gegeben der Typfilter steht auf „Restaurant", wenn ich die Suche
      auslöse, dann sind alle neu angelegten POIs vom Typ Restaurant.
- [ ] Gegeben ein leeres Textfeld, wenn die Suche abgeschlossen ist,
      dann wurden höchstens zehn POIs angelegt.
- [ ] Gegeben ich habe „höchstens 20 Treffer" eingetragen, wenn die
      Suche abgeschlossen ist, dann wurden höchstens zwanzig POIs
      angelegt.
- [ ] Gegeben eine Reise mit bereits gefundenen POIs, wenn ich die
      Suche erneut auslöse, dann sind die neu angelegten POIs andere
      als die vorhandenen.
- [ ] Gegeben die Suche ist abgeschlossen, wenn ich die Ergebniszeile
      betrachte, dann nennt sie die Anzahl der neu angelegten POIs.
- [ ] Gegeben die Suche läuft, wenn ich die Schaltfläche erneut
      anklicke, dann wird KEINE zweite Suche ausgelöst.
- [ ] Gegeben die KI ist nicht erreichbar, wenn ich die Suche auslöse,
      dann werden KEINE POIs angelegt.

# Constraints

- Die Angaben eines angelegten POI stammen aus den Kartendaten von
  OpenStreetMap, nicht aus der Antwort der KI. Die KI liefert nur die
  Namen der Vorschläge; Position, Ort und weitere Angaben werden
  nachgeschlagen. Grund: Sprachmodelle geben Koordinaten unzuverlässig
  an und nennen gelegentlich Orte, die es nicht gibt — das
  Nachschlagen prüft beides zugleich.
- Ein Vorschlag, der sich in den Kartendaten nicht auffinden lässt,
  wird verworfen und nicht angelegt.
- Der Zugriff auf die KI erfolgt über die austauschbare Schnittstelle
  aus [stack.md](../../stack.md).

# Nicht Teil dieses Requirements

- Übernahme der Reise-Eckdaten (Reiseart, Budget, Zeitraum) als
  Suchkriterium
- Bearbeiten von POIs über den KI-Chat
- Auswahl vor der Übernahme: alle geprüften Treffer werden angelegt
- Bilder oder Beschreibungstexte zu den gefundenen POIs
- Suche außerhalb des Suchgebiets
- Rückgängigmachen eines Suchlaufs
