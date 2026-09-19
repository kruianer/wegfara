---
id: req-069
title: Status für mehrere POIs auf einmal setzen
app: wegfara
area: Planung
priority: normal
created: 2026-09-19
---

# Goal (Why)

Als Reiseleiter gehe ich nach einer KI-Suche dreißig Treffer durch und
verwerfe zwei Drittel davon. Heute muss ich jeden einzeln öffnen und
seinen Status setzen. Mehrere POIs ankreuzen und gemeinsam entfernen kann
ich längst (req-035) — dasselbe fehlt für den Status.

# Function (What)

Sind in der POI-Liste **mehrere POIs angekreuzt**, lässt sich für alle
zugleich ein Status setzen. Der Weg dorthin sitzt dort, wo auch das
gemeinsame Entfernen sitzt: in der Leiste über der Liste, neben der
Anzeige „n ausgewählt".

Gesetzt werden kann jeder Status, den ein einzelner POI auch annehmen
kann. Der neue Status ersetzt den bisherigen — gleich welcher es war und
ob die angekreuzten POIs untereinander verschiedene hatten.

Danach steht die Auswahl weiterhin, damit sich gleich eine zweite Aktion
anschließen lässt.

Wie beim gemeinsamen Entfernen wirkt die Aktion nur auf die **angekreuzten**
POIs, nicht auf die übrigen sichtbaren.

# Acceptance Criteria

- [x] Gegeben ich habe drei POIs angekreuzt, wenn ich einen Status
      auswähle, dann tragen danach alle drei diesen Status.
- [x] Gegeben die drei POIs hatten vorher verschiedene Status, wenn ich
      einen gemeinsamen Status setze, dann tragen danach alle drei
      denselben.
- [x] Gegeben ich habe drei von zehn sichtbaren POIs angekreuzt, wenn ich
      einen Status setze, dann sind die übrigen sieben unverändert.
- [x] Gegeben kein POI ist angekreuzt, wenn ich die Leiste ansehe, dann ist
      das gemeinsame Setzen nicht auslösbar.
- [x] Gegeben ich habe einen Status für mehrere gesetzt, wenn ich danach
      die Liste ansehe, dann sind dieselben POIs weiterhin angekreuzt.
- [x] Gegeben ich setze einen Status für mehrere POIs, wenn das
      Speichern fehlschlägt, dann sagt die Oberfläche das — und zeigt
      nicht fälschlich den neuen Status an.
- [x] Gegeben ich setze einen Status für mehrere POIs, wenn ich die Karte
      ansehe, dann ist der Kartenausschnitt unverändert (bug-048).
- [x] Gegeben die Liste ist auf 375 px, 768 px und 1280 px zu sehen, wenn
      POIs angekreuzt sind, dann ist das gemeinsame Setzen auf allen
      dreien bedienbar (siehe [stack.md](../../stack.md)).

# Constraints

- Die vorhandene Mehrfachauswahl aus req-035 wird genutzt, nicht eine
  zweite daneben gestellt.
- Es gilt dieselbe Statusliste wie für den einzelnen POI (req-013); es
  kommt kein Status hinzu und keiner fällt weg.
- Das Setzen darf nicht stillschweigend fehlschlagen: Ein Fehler wird
  benannt (vgl. bug-021, bug-026, bug-027, bug-032).
- Wer den Status eines einzelnen POI setzen darf, darf es auch für
  mehrere; es entsteht kein neues Recht.

# Out of Scope

- Rückgängig machen einer gemeinsamen Änderung.
- Weitere Eigenschaften gemeinsam ändern (Dauer, Beschreibung, Tag).
- POIs gemeinsam einem Reisetag zuordnen.
- Eine Rückfrage vor dem Setzen — anders als beim Entfernen (req-035) ist
  ein Status jederzeit wieder änderbar.
