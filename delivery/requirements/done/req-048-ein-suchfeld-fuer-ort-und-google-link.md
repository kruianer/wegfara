---
id: req-048
title: Ein Suchfeld am Anfang für Ortssuche und Google-Link
app: wegfara
area: Planung
priority: high
created: 2026-09-06
changes: req-045, req-026
---

# Goal (Why)

Als Reiseleiter starte ich das Anlegen eines POI fast immer mit einer
Suche — entweder tippe ich den Namen, oder ich habe einen
Google-Maps-Link in der Zwischenablage. Heute sind das zwei getrennte
Funktionen an zwei Stellen, und das Formular beginnt trotz req-045
weiterhin mit dem Namensfeld. Ich will ein Feld am Anfang, das beides
annimmt und mir die Arbeit abnimmt.

# Function (What)

Das POI-Formular beginnt mit **einem** Feld: „Ort suchen oder
Google-Maps-Link einfügen". Es steht vor allen anderen Feldern — auch
vor dem Namen.

Das Feld erkennt am Inhalt, was gemeint ist:

- **Suchbegriff** — es erscheinen Vorschläge zum Anklicken, wie bisher.
- **Google-Maps-Link** — kein Vorschlag, die Felder füllen sich direkt.

In beiden Fällen werden **alle** übrigen Felder gefüllt und dabei
überschrieben: Name, Typ, Adresse, Position, Dauer sowie Kurz- und
Langtext, soweit die Quelle sie kennt. Jedes Feld bleibt danach von
Hand änderbar. Wer gar nicht sucht, füllt das Formular wie bisher selbst
aus.

Was das Suchfeld gefüllt hat, gilt **nicht** als von Hand geändert — ein
späteres Auffrischen aus Google darf es ersetzen (req-035). Nur was ich
selbst tippe, bleibt dabei stehen.

Beim Ändern eines bestehenden POI verhält sich das Feld genauso.

**Ohne Google-Zugangsschlüssel** (req-028) wird ein eingefügter Link
nicht abgerufen; das Feld weist darauf hin. Die Suche nach einem
Begriff funktioniert weiterhin.

**Schlägt ein Abruf fehl** — ungültiger Link, Dienst nicht erreichbar —
erscheint die Meldung am Suchfeld. Die übrigen Felder bleiben
unverändert, und das Formular bleibt zum Weiterarbeiten offen.

Der bisherige eigene Google-Link-Import über der POI-Liste entfällt.

# Änderung gegenüber heute (req-045, req-026)

- Das Formular beginnt heute mit dem Namensfeld; die Ortssuche steht
  weiter unten. Sie wandert an den Anfang — was req-045 bereits
  vorsah, aber so nicht umgesetzt ist.
- Das Suchfeld nimmt künftig auch Google-Maps-Links an.
- Der eigene Bereich zum Einfügen eines Google-Links über der POI-Liste
  wird entfernt; POIs aus Google entstehen künftig über das Formular.

# Acceptance Criteria

- [ ] Gegeben ich öffne das Formular zum Anlegen eines POI, wenn ich es
      von oben lese, dann ist das Suchfeld das erste Feld — vor dem
      Namen.
- [ ] Gegeben ich tippe „Villa Rufolo Ravello" in das Suchfeld, wenn
      Vorschläge erscheinen und ich einen wähle, dann steht im
      Namensfeld „Villa Rufolo".
- [ ] Gegeben ich füge einen Google-Maps-Link in das Suchfeld ein, wenn
      der Abruf fertig ist, dann sind Name, Adresse und Position
      gefüllt.
- [ ] Gegeben ich füge einen Google-Maps-Link ein, wenn ich das Feld
      ansehe, dann erscheint KEINE Vorschlagsliste.
- [ ] Gegeben ich habe den Namen bereits auf „Mein Lieblingsort"
      geändert, wenn ich danach über das Suchfeld „Villa Rufolo Ravello"
      wähle, dann steht im Namensfeld „Villa Rufolo".
- [ ] Gegeben das Suchfeld hat den Namen gefüllt, wenn ich ihn danach in
      „Gärten der Villa Rufolo" ändere und speichere, dann steht mein
      Text im POI.
- [ ] Gegeben für meinen Account ist kein Zugangsschlüssel für Google
      hinterlegt, wenn ich einen Google-Maps-Link einfüge, dann erscheint
      ein Hinweis am Feld.
- [ ] Gegeben für meinen Account ist kein Zugangsschlüssel für Google
      hinterlegt, wenn ich einen Google-Maps-Link einfüge, dann wird
      KEINE Anfrage an Google gestellt.
- [ ] Gegeben ich füge einen ungültigen Google-Maps-Link ein, wenn der
      Abruf scheitert, dann erscheint eine Meldung am Suchfeld.
- [ ] Gegeben ich füge einen ungültigen Google-Maps-Link ein und habe
      den Typ auf „Restaurant" gesetzt, wenn der Abruf scheitert, dann
      steht als Typ weiterhin „Restaurant".
- [ ] Gegeben ich öffne einen bestehenden POI zum Ändern, wenn ich über
      das Suchfeld einen anderen Ort wähle, dann sind seine Felder mit
      dem neuen Ort gefüllt.
- [ ] Gegeben ich habe einen POI über einen Google-Link angelegt und
      seinen Kurztext nicht angefasst, wenn ich ihn aus demselben Link
      auffrische, dann wird der Kurztext neu übernommen.
- [ ] Gegeben ich öffne den Bereich POIs, wenn ich über der Liste
      nachsehe, dann gibt es dort KEIN eigenes Feld mehr zum Einfügen
      eines Google-Maps-Links.
- [ ] Gegeben ich fülle das Formular ganz von Hand aus, ohne das
      Suchfeld zu benutzen, wenn ich speichere, dann wird der POI
      angelegt.

# Constraints

- Ortsdaten kommen von OpenStreetMap, POI-Daten aus einem Google-Link
  von Google Places (siehe [stack.md](../../stack.md)) — was eine
  Quelle nicht kennt, kann nicht gefüllt werden.
- Der Google-Abruf läuft über den Zugangsschlüssel des Accounts
  (req-028) und kostet je Aufruf; ohne Schlüssel wird nicht abgerufen.

# Out of Scope

- Google-Links in der KI-Suche (req-014).
- Weitere Quellen im selben Feld (Apple Maps, Koordinaten als Text).
- Mehrere POIs aus einer Eingabe auf einmal anlegen.
- Die Bedienung des Zeitstrahls — siehe bug-022 und bug-023.
