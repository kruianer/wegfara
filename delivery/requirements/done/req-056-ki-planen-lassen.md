---
id: req-056
title: KI planen lassen — POIs auf die Reisetage verteilen
app: wegfara
area: Planung
priority: normal
created: 2026-09-06
changes: req-011
---

# Goal (Why)

Als Reiseleiter habe ich 20 POIs gesammelt und fünf Reisetage — sie von
Hand sinnvoll zu verteilen kostet einen Abend. Die KI kann das: was nah
beieinanderliegt, gehört auf denselben Tag, und drei Museen
hintereinander will niemand. Den Vorschlag sehe ich mir an und
entscheide dann.

# Function (What)

**Reisetempo.** In den Reisedetails (req-033) wird ein Reisetempo
gewählt. Es steuert, wie voll ein Tag geplant wird und wie viel
Gleichartiges an einem Tag erlaubt ist:

| Tempo | Tageslänge | Höchstens gleiche POI-Typen je Tag |
|---|---|---|
| Entspannt | 6 Stunden | 2 |
| Ausgewogen (Vorgabe) | 10 Stunden | 3 |
| Dicht | 12 Stunden | 4 |

Restaurant und Hotel zählen nicht mit — sie gehören zum Tagesablauf. Das
Reisetempo wirkt ausschließlich auf die KI-Planung; von Hand plant man
weiterhin, wie man will.

**Planen.** Im Planer öffnet „KI planen lassen" ein Fenster mit dem
Häkchen „Bestehendes neu ordnen" (nicht vorausgewählt) und dem Hinweis,
dass ein Lauf über den Zugangsschlüssel des Accounts abgerechnet wird.

Die KI verteilt die POIs mit Status **Gesetzt** und **Wahrscheinlich**
auf die Reisetage — „Gesetzt" hat Vorrang:

- POIs, die nah beieinanderliegen, kommen auf denselben Tag; innerhalb
  des Tages werden sie in der Reihenfolge geplant, die die kürzesten
  Wege ergibt.
- Der Tag beginnt um 08:00 und dauert höchstens so lange, wie das
  Reisetempo erlaubt.
- Gibt es einen POI vom Typ Restaurant, wird er zwischen 12:00 und 14:00
  eingeplant. Sonst bleibt dort eine Stunde frei — es entsteht kein
  leerer Programmpunkt.
- Die Dauer eines Programmpunkts ist die am POI hinterlegte, sonst die
  geschätzte des Typs (req-045).

**Wege in zwei Stufen.** Zuerst wird nach Luftlinie gruppiert. Für die
so entstandenen Tagesgruppen werden die echten Fahrzeiten geholt. Ist
eine echte Fahrzeit mehr als 20 Minuten länger als die geschätzte, wird
neu verteilt — höchstens fünfmal. Danach kommt der beste gefundene Plan,
mit einem Hinweis, wo es eng bleibt.

**Ohne Häkchen** bleiben bereits verplante Programmpunkte unangetastet;
die KI füllt nur die Lücken. **Mit Häkchen** ordnet sie auch die
bestehenden neu.

**Passen nicht alle POIs** in die verfügbaren Tage, werden so viele wie
möglich verplant; der Rest bleibt in „Noch unverplant", mit dem Hinweis,
wie viele keinen Platz fanden.

**Vorschlag statt Umbau.** Der Zeitstrahl zeigt das Ergebnis zur
Ansicht, erkennbar als Vorschlag, mit „Übernehmen" und „Verwerfen".
Gespeichert wird erst beim Übernehmen — dabei entstehen auch die
Transfers zwischen den Programmpunkten (req-052). „Verwerfen" lässt den
Plan unverändert.

Während des Laufs erscheint ein Fortschritt mit „Abbrechen".

Der Knopf „KI planen lassen" aus req-011 bekommt damit seine Funktion.

# Änderung gegenüber heute (req-011)

- Der Knopf „KI planen lassen" ist heute ohne Funktion.
- Ein Reisetempo gibt es in den Reisedetails heute nicht.

# Acceptance Criteria

- [x] Gegeben ich öffne die Reisedetails einer neuen Reise, wenn ich das
      Reisetempo ansehe, dann steht dort „Ausgewogen".
- [x] Gegeben ich stelle das Reisetempo auf „Entspannt" und speichere,
      wenn ich die Reisedetails neu lade, dann steht dort weiterhin
      „Entspannt".
- [x] Gegeben eine Reise mit 6 POIs im Status „Gesetzt" und 3
      Reisetagen, wenn ich „KI planen lassen" wähle, dann sehe ich einen
      Vorschlag mit Programmpunkten an allen drei Tagen.
- [x] Gegeben ein Vorschlag liegt vor, wenn ich „Verwerfen" wähle, dann
      ist der Plan unverändert wie vorher.
- [x] Gegeben ein Vorschlag liegt vor, wenn ich „Übernehmen" wähle, dann
      liegen die Programmpunkte nach dem Neuladen im Plan.
- [x] Gegeben ein Vorschlag liegt vor und ich habe ihn noch nicht
      übernommen, wenn ich die Seite neu lade, dann ist der Plan
      unverändert — der Vorschlag wurde NICHT gespeichert.
- [x] Gegeben ein Programmpunkt „Hotel-Checkin" liegt bereits im Plan,
      wenn ich ohne das Häkchen „Bestehendes neu ordnen" planen lasse,
      dann liegt er im Vorschlag unverändert an derselben Stelle.
- [x] Gegeben ein Programmpunkt liegt bereits im Plan, wenn ich mit dem
      Häkchen „Bestehendes neu ordnen" plane, dann darf er im Vorschlag
      an einer anderen Stelle liegen.
- [x] Gegeben das Reisetempo ist „Entspannt" und ein Tag im Vorschlag,
      wenn ich seine Programmpunkte zusammenrechne, dann umfassen sie
      höchstens 6 Stunden.
- [x] Gegeben das Reisetempo ist „Entspannt", wenn ich einen Tag des
      Vorschlags ansehe, dann liegen dort höchstens 2 POIs vom Typ
      Sehenswürdigkeit.
- [x] Gegeben das Reisetempo ist „Dicht", wenn ich einen Tag des
      Vorschlags ansehe, dann liegen dort höchstens 4 POIs vom Typ
      Sehenswürdigkeit.
- [x] Gegeben eine Reise mit einem POI vom Typ Restaurant, wenn ich
      planen lasse, dann liegt er im Vorschlag zwischen 12:00 und 14:00.
- [x] Gegeben eine Reise ohne POI vom Typ Restaurant, wenn ich einen Tag
      des Vorschlags ansehe, dann steht dort zwischen 12:00 und 14:00
      KEIN erfundener Programmpunkt „Mittagspause".
- [x] Gegeben 20 POIs und 2 Reisetage bei Tempo „Entspannt", wenn ich
      planen lasse, dann sehe ich einen Hinweis, wie viele POIs keinen
      Platz fanden.
- [x] Gegeben 20 POIs und 2 Reisetage, wenn ich den Vorschlag übernehme,
      dann stehen die nicht verplanten POIs weiterhin in „Noch
      unverplant".
- [x] Gegeben POIs mit Status „Weiß noch nicht", wenn ich planen lasse,
      dann kommen sie im Vorschlag NICHT vor.
- [x] Gegeben ich übernehme einen Vorschlag, wenn ich den Zeitstrahl
      ansehe, dann liegen zwischen den Programmpunkten eines Tages
      Transfers.
- [x] Gegeben für meinen Account ist kein Zugangsschlüssel für die KI
      hinterlegt, wenn ich den Planer öffne, dann ist „KI planen lassen"
      nicht auslösbar.
- [x] Gegeben ein laufender Planungsvorgang, wenn ich „Abbrechen" wähle,
      dann ist der Plan unverändert.
- [x] Gegeben eine Reise ohne POIs im Status „Gesetzt" oder
      „Wahrscheinlich", wenn ich planen lasse, dann sehe ich einen
      Hinweis, dass es nichts zu verplanen gibt.

# Constraints

- Im Zweifel vorschlagen statt selbst umbauen — der Plan wird nie ohne
  Bestätigung geändert ([vision.md](../../vision.md)).
- Der Zugriff auf das Sprachmodell liegt hinter der austauschbaren
  Schnittstelle in `lib/ai/`; der Schlüssel kommt vom Account (req-028),
  nie aus der Umgebung.
- Echte Fahrzeiten kommen von OSRM, hinter derselben Schnittstelle wie
  in req-051 und req-052.
- Die Dauer eines Programmpunkts folgt dem 15-Minuten-Raster des
  Zeitstrahls (req-039).

# Out of Scope

- Anpassungsvorschläge unterwegs bei Verzug — eigenes Requirement.
- Öffnungszeiten von POIs beim Planen berücksichtigen.
- Wetter beim Planen berücksichtigen.
- Die Stimmen der Bewertungsrunde (req-054) in die Planung einbeziehen.
- Einzelne Tage getrennt neu planen lassen.
- Das Reisetempo beim Verplanen von Hand durchsetzen.
