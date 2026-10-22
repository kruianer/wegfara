---
titel: Regentag — der Begleiter zeigt, was bei Regen drinnen geht
datum: 2026-10-22
---

## Problem/Nutzen

Der Begleiter zeigt im Kopfbereich Temperatur und Regenwahrscheinlichkeit
(req-002) — und lässt es dabei. Die Vision nennt Wetter als Anlass für
„der Plan geht nicht mehr auf", aber zwischen der Zahl „80 %" und einem
besseren Tag liegt heute alles beim Nutzer: Er steht mit der Gruppe im
Regen vor dem Strand-Programmpunkt und muss selbst in der POI-Sammlung
suchen, was drinnen geht, offen hat und in der Nähe liegt.

Dabei liegt die Antwort meist schon in der Reise. Die POI-Sammlung
enthält Orte mit Typ (`sehenswuerdigkeit`, `restaurant`, `strand`,
`aktivitaet` …), Position und Status (`wenn_zeit` oder `wahrscheinlich`
sind genau die Kandidaten für „wenn das Wetter schlecht ist"). Nichts
davon wird mit dem Wetter verknüpft. Auch die Bewertungsrunde (req-054)
fragt nie nach „Schlechtwetter-tauglich".

Nutzen: Ein regnerischer Tag wird zur Zwei-Tipp-Situation statt zur
Suchaktion. Das trifft den Kern von „die App, die man zückt, wenn der
Plan nicht mehr aufgeht" und ist ein Fall, der auf jeder Reise vorkommt.

## Skizze

- **Auslöser:** Liegt die Regenwahrscheinlichkeit des gewählten Tages
  (Open-Meteo-Abruf aus req-002, derselbe Tageswert) über einer
  Schwelle, z. B. 60 %, erscheint im Zeitstrahl ein dezenter Hinweis
  „Regen wahrscheinlich — Alternativen drinnen ansehen". Kein Eingriff
  in den Plan.
- **Draußen/drinnen:** Eine Eigenschaft je POI-Typ als feste Tabelle im
  Code (Strand und Aktivität = draußen, Restaurant und Hotel = drinnen,
  Sehenswürdigkeit = unbestimmt). Kein neues Pflichtfeld; optional kann
  der Nutzer am POI „drinnen" von Hand setzen (ein Eintrag in
  `manual_fields`-Logik, eine nullable Spalte).
- **Vorschlagsliste:** Ein Blatt zeigt die draußen liegenden
  Programmpunkte des Tages und dazu bis zu drei Indoor-Kandidaten aus
  der Sammlung derselben Reise, sortiert nach Entfernung zum
  betroffenen Punkt (Luftlinie reicht) und bevorzugt mit Status
  `wenn_zeit`/`wahrscheinlich`; geöffnete Orte zuerst, sofern
  `opening_hours` vorhanden ist.
- **Übernahme:** Ein Tipp auf „Tauschen" stellt den bestehenden
  Umplanen-Weg (req-040) mit vorbelegtem Ziel bereit; bestätigt der
  Nutzer, wird getauscht — nie automatisch (Prinzip: vorschlagen statt
  umbauen).
- **Datenquelle:** nur vorhandene Daten (POI-Sammlung, bestehender
  Wetterabruf). Keine neue externe Quelle, daher keine
  Lizenzfragen; das Speichern bleibt wie bisher.
- **Nicht Teil:** KI-Neuplanung des ganzen Tages, Niederschlags-Radar
  zur Stunde, Benachrichtigungen.
