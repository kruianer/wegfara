---
id: req-051
title: Live-Status mit Verzug im Begleiter
app: wegfara
area: Reise
priority: normal
created: 2026-09-06
---

# Goal (Why)

Als Teilnehmer will ich unterwegs auf einen Blick sehen, ob wir im
Zeitplan sind: wo ich laut Plan gerade sein müsste, wo ich tatsächlich
bin, und wie viel Verzug daraus folgt. Ohne das merke ich erst am
verpassten Tischreservierung, dass wir zu spät dran sind.

# Function (What)

Im Begleiter erscheint über dem Plan ein Live-Status:

- die Zeile „LIVE-STATUS · HH:MM UHR" mit der aktuellen Uhrzeit
- eine Status-Pille: „Im Zeitplan" oder „N Min zu spät"
- zweispaltig „Laut Plan" gegen „Laut GPS"

**Laut Plan** ist der Programmpunkt, der zur aktuellen Uhrzeit läuft.
**Laut GPS** ist der Ort, an dem ich mich befinde.

Der **Verzug** ist die Fahrzeit von meiner Position zum Ort des
geplanten Programmpunkts, auf ganze Minuten gerundet. Bin ich dort oder
weniger als 5 Minuten entfernt, steht „Im Zeitplan".

Als Position gilt **meine eigene**, sofern ich sie teile (req-050).
Teile ich nicht, gilt die des Reiseleiters — die Gruppe reist zusammen.
Teilt auch er nicht, zeigt der Status nur „Laut Plan" und keinen Verzug.

Der Live-Status erscheint nur, solange das heutige Datum im Zeitraum der
Reise liegt und sie im Zustand „Freigegeben" steht. Sonst ist er nicht
vorhanden — kein leerer Platzhalter.

Läuft zur aktuellen Uhrzeit kein Programmpunkt, steht unter „Laut Plan"
der nächste anstehende mit seiner Uhrzeit, und es wird kein Verzug
berechnet.

# GUI

- Mockup: `delivery/design/design 1.0/Reise Companion.dc.html`,
  Abschnitt Live-Status
- Bindend: eng folgen. Beschriftungen, Aufbau und Farben wie dort —
  Status-Pille in „warn" bei Verzug, in „good" bei „Im Zeitplan", der
  GPS-Wert mit blauem Punkt (#4a90d9).

# Acceptance Criteria

- [ ] Gegeben eine Reise im Zustand „Freigegeben", deren Zeitraum heute
      einschließt, wenn ich den Begleiter öffne, dann sehe ich über dem
      Plan die Zeile „LIVE-STATUS" mit der aktuellen Uhrzeit.
- [ ] Gegeben um 14:10 läuft der Programmpunkt „Mittagessen Positano",
      wenn ich den Live-Status ansehe, dann steht unter „Laut Plan"
      „Mittagessen Positano".
- [ ] Gegeben ich teile meine Position und bin in Praiano, wenn ich den
      Live-Status ansehe, dann steht unter „Laut GPS" „Praiano".
- [ ] Gegeben ich bin 25 Fahrminuten vom geplanten Programmpunkt
      entfernt, wenn ich den Live-Status ansehe, dann zeigt die
      Status-Pille „25 Min zu spät".
- [ ] Gegeben ich bin am Ort des geplanten Programmpunkts, wenn ich den
      Live-Status ansehe, dann zeigt die Status-Pille „Im Zeitplan".
- [ ] Gegeben ich bin 3 Fahrminuten entfernt, wenn ich den Live-Status
      ansehe, dann zeigt die Status-Pille „Im Zeitplan".
- [ ] Gegeben ich teile meine Position nicht, der Reiseleiter aber
      schon, wenn ich den Live-Status ansehe, dann beruht der Verzug auf
      seiner Position.
- [ ] Gegeben weder ich noch der Reiseleiter teilen die Position, wenn
      ich den Live-Status ansehe, dann steht dort „Laut Plan" und KEIN
      Verzug.
- [ ] Gegeben die Reise steht im Zustand „In Planung", wenn ich den
      Begleiter öffne, dann ist der Live-Status NICHT vorhanden.
- [ ] Gegeben der Zeitraum der Reise endete gestern, wenn ich den
      Begleiter öffne, dann ist der Live-Status NICHT vorhanden.
- [ ] Gegeben um 07:00 läuft kein Programmpunkt und der nächste beginnt
      um 09:00, wenn ich den Live-Status ansehe, dann steht unter „Laut
      Plan" dieser nächste Programmpunkt mit „09:00".
- [ ] Gegeben um 07:00 läuft kein Programmpunkt, wenn ich den
      Live-Status ansehe, dann wird KEIN Verzug angezeigt.
- [ ] Gegeben der Routing-Dienst ist nicht erreichbar, wenn ich den
      Live-Status ansehe, dann sehe ich „Laut Plan" und „Laut GPS" — und
      an Stelle des Verzugs einen Hinweis, dass er sich gerade nicht
      ermitteln lässt.

# Constraints

- Die Fahrzeit kommt von OSRM auf OpenStreetMap-Daten — Open Source,
  ohne Zugangsschlüssel, passend zum übrigen Kartenstack (siehe
  [stack.md](../../stack.md)). An Google gehen dabei keine Positionen.
- Der Zugriff auf den Routing-Dienst liegt hinter einer austauschbaren
  Schnittstelle, damit er später auf dem Beelink selbst gehostet werden
  kann, ohne die aufrufende Logik zu ändern.
- Ohne geteilte Position (req-050) gibt es keinen Verzug — er lässt sich
  ohne Standort nicht berechnen.

# Out of Scope

- Positionen teilen und auf der Karte anzeigen — das ist req-050.
- Anpassungsvorschläge bei Verzug („Museum streichen") — eigenes
  Requirement.
- Meldungen und Hinweise (Stau, Fähre verschoben) aus dem Mockup.
- Verkehrslage in die Fahrzeit einrechnen.
- Verzug in den Plan zurückschreiben oder Programmpunkte verschieben.
