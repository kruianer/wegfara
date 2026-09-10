---
id: req-060
title: POI-Liste umbauen — Boxen, Filter, eigene Anlegezeile
app: wegfara
area: Planung
priority: normal
created: 2026-09-10
changes: req-010, req-048
---

# Goal (Why)

Als Reiseleiter arbeite ich in der POI-Liste am meisten, und sie kostet
mich zu viel: Die Überschrift nimmt Platz, die POIs laufen ineinander,
zum Löschen muss ich das Formular öffnen, und bei zwanzig POIs finde ich
den gesuchten nur durch Scrollen. Das Anlegen steckt außerdem in der
Liste, obwohl es nicht dazugehört.

# Function (What)

**Die Überschrift „Points of Interest" entfällt** — der Platz gehört der
Liste.

**Anlegen bekommt eine eigene Zeile**, oberhalb des Filters und außerhalb
der Liste: ein Eingabefeld, das dreierlei annimmt —

- ein **Google-Maps-Link** wird erkannt und abgerufen (req-048)
- ein **Suchbegriff** bringt Vorschläge aus der Ortssuche
- daneben **„Mit KI suchen"**: derselbe Text, aber als Wunsch verstanden
  (req-014). Ohne Knopfdruck läuft keine KI-Suche.

**Darunter Filtern und Sortieren:**

- **Typ** als Auswahlliste, Vorwahl „alle"
- **Status** als Auswahlliste, Vorwahl „alle"
- **Sortieren** nach Nummer (Vorwahl), Name, Status oder Bewertung

Bei „Bewertung" stehen POIs ohne Bewertung am Ende.

**Jeder POI steht in einer eigenen Box** mit abgerundeten Ecken, deutlich
voneinander abgesetzt. **Rechts in der Box ein Löschen-Symbol**, das den
POI direkt entfernt — mit der Rückfrage aus req-035, die auch warnt, wenn
er bereits verplant ist.

Filter und Sortierung wirken nur auf die Liste; die Karte behält ihre
eigene Statusauswahl (req-013).

# Änderung gegenüber heute (req-010, req-048)

- Die Überschrift „Points of Interest" steht heute über der Liste.
- Das Anlegen sitzt heute als Zeile **in** der Liste; es wandert darüber.
- Es gibt heute nur einen Typfilter als Leiste, keinen Statusfilter und
  keine Sortierung.
- Die POIs stehen heute als Zeilen ohne Box; gelöscht wird nur aus dem
  geöffneten Formular.
- Die KI-Suche hat heute ein eigenes Feld; sie teilt sich künftig das
  Feld der Neuanlage.

# Acceptance Criteria

- [x] Gegeben ich öffne den Bereich POIs, wenn ich nach oben sehe, dann
      steht dort KEINE Überschrift „Points of Interest".
- [x] Gegeben ich öffne den Bereich POIs, wenn ich die Reihenfolge von
      oben lese, dann kommt zuerst die Anlegezeile, dann der Filter, dann
      die Liste.
- [x] Gegeben ich füge einen Google-Maps-Link in die Anlegezeile ein,
      wenn der Abruf fertig ist, dann öffnet sich das Formular mit den
      Angaben des Ortes.
- [x] Gegeben ich tippe „Villa Rufolo" in die Anlegezeile, wenn
      Vorschläge erscheinen und ich einen wähle, dann öffnet sich das
      Formular mit diesem Ort.
- [x] Gegeben ich tippe „ruhige Strände" in die Anlegezeile, wenn ich
      „Mit KI suchen" wähle, dann werden POIs aus der KI-Suche angelegt.
- [x] Gegeben ich tippe einen Text in die Anlegezeile, wenn ich keinen
      Knopf drücke, dann wird KEINE KI-Suche ausgelöst.
- [x] Gegeben eine Reise mit POIs verschiedener Typen, wenn ich im
      Typfilter „Restaurant" wähle, dann stehen in der Liste nur POIs
      dieses Typs.
- [x] Gegeben ich habe im Typfilter „Restaurant" gewählt, wenn ich auf
      „alle" zurückstelle, dann stehen wieder alle POIs in der Liste.
- [x] Gegeben POIs mit verschiedenen Status, wenn ich im Statusfilter
      „Gesetzt" wähle, dann stehen in der Liste nur POIs mit diesem
      Status.
- [x] Gegeben ich öffne den Bereich POIs, wenn ich die Sortierung
      ansehe, dann steht sie auf „Nummer".
- [x] Gegeben ich sortiere nach „Name", wenn ich die Liste ansehe, dann
      steht „Ausgrabungsstätte Pompeji" vor „Villa Rufolo".
- [x] Gegeben ich sortiere nach „Bewertung", wenn ich die Liste ansehe,
      dann stehen POIs ohne Bewertung am Ende.
- [x] Gegeben ich sehe die Liste an, wenn ich zwei POIs vergleiche, dann
      steht jeder in einer eigenen Box mit abgerundeten Ecken.
- [x] Gegeben ein POI in der Liste, wenn ich rechts das Löschen-Symbol
      wähle, dann erscheint die Rückfrage vor dem Entfernen.
- [x] Gegeben ich bestätige die Rückfrage, wenn ich die Liste ansehe,
      dann ist der POI verschwunden.
- [x] Gegeben ich breche die Rückfrage ab, wenn ich die Liste ansehe,
      dann steht der POI weiterhin da.
- [x] Gegeben ich habe den Typfilter auf „Restaurant" gestellt, wenn ich
      die Karte ansehe, dann hat sich deren eigene Statusauswahl NICHT
      geändert.

# Constraints

- Die Nummer eines POI bleibt fest, unabhängig von der Sortierung
  (req-013) — über sie wird in der Gruppe und auf der Karte gesprochen.
- Die KI-Suche läuft über den Zugangsschlüssel des Accounts (req-028) und
  kostet je Lauf; ohne Schlüssel ist sie gesperrt.
- Die Bildschirmregeln aus [stack.md](../../stack.md) gelten: Tippziele
  erreichen 44×44 px über ihre Trefferfläche, nicht über ihre sichtbare
  Größe (vgl. bug-025, bug-028).

# Out of Scope

- Kosten und Buchungsstatus am POI sowie der Knopf „Aus Google
  vervollständigen" — das ist req-061.
- Mehrere Status gleichzeitig filtern.
- Die Sortierung merken, bis zum nächsten Öffnen.
- Suchen innerhalb der POI-Liste über ein Textfeld.
- Änderungen an der Statusauswahl der Karte (req-013).
