---
id: req-052
title: Transfer zwischen zwei Programmpunkten planen
app: wegfara
area: Planung
priority: normal
created: 2026-09-06
changes: req-011
---

# Goal (Why)

Als Reiseleiter plane ich einen Tag und will festhalten, wie wir von
einem Programmpunkt zum nächsten kommen — zu Fuß, mit dem Auto, mit der
Fähre. Heute zeigt der Zeitstrahl Transfers zwar an, aber ich kann
keinen anlegen; die vorhandenen stammen aus der Anfangszeit. Und wie
lange eine Strecke dauert, weiß die App besser als ich.

# Function (What)

Zwischen zwei aufeinanderfolgenden Programmpunkten desselben Reisetages
lässt sich ein Transfer anlegen: In der Lücke zwischen zwei Blöcken
erscheint beim Draufzeigen ein „+".

Ein Klick öffnet ein Formular, das bereits einen **Vorschlag** enthält:

- **Verkehrsmittel** — bis 1,5 km Strecke „zu Fuß", darüber „Auto"
- **Dauer** und **Strecke** — aus der tatsächlichen Route zwischen den
  beiden Orten

Alle drei Angaben sind änderbar, dazu ein Titel. Zur Wahl stehen die
sieben vorhandenen Verkehrsmittel: zu Fuß, Auto, Bus, Boot, Flug, Bahn,
Fähre. Ändere ich das Verkehrsmittel, werden Dauer und Strecke dafür neu
vorgeschlagen.

Der gespeicherte Transfer erscheint als gestrichelter Block zwischen den
beiden Programmpunkten, mit Bezeichnung, Strecke und Dauer (req-006). Er
lässt sich später ändern und entfernen.

**Ist die Fahrzeit länger als die Lücke** zwischen den beiden
Programmpunkten, wird der Transfer trotzdem angelegt — mit dem sichtbaren
Hinweis, dass die Zeit nicht reicht. Umgeplant wird nichts von selbst.

**Fehlt einem der beiden Programmpunkte die Position**, gibt es keinen
Vorschlag; Verkehrsmittel, Dauer und Strecke trägt man selbst ein. Ein
Hinweis nennt den Grund.

Zwischen zwei Programmpunkten gibt es **genau einen** Transfer. Wo schon
einer liegt, öffnet das „+" den vorhandenen zum Ändern.

Wird ein Programmpunkt verschoben, bleibt sein Transfer bestehen und
wird neu berechnet. Wird er entfernt, verschwindet auch der Transfer.

Damit bekommt der Knopf „Transfers" aus req-011 seine Funktion: Er zeigt
alle Transfers des gewählten Tages.

# Änderung gegenüber heute (req-011)

- Transfers lassen sich heute nicht anlegen, ändern oder entfernen; die
  vorhandenen stammen aus der Anfangszeit.
- Der Knopf „Transfers" ist heute ohne Funktion.

# Acceptance Criteria

- [x] Gegeben zwei Programmpunkte am selben Tag ohne Transfer
      dazwischen, wenn ich auf die Lücke zwischen ihnen zeige, dann
      erscheint ein „+".
- [x] Gegeben ich klicke auf dieses „+", wenn das Formular erscheint,
      dann ist ein Verkehrsmittel bereits vorgeschlagen.
- [x] Gegeben zwei Programmpunkte 800 m voneinander entfernt, wenn ich
      den Transfer anlege, dann lautet der Vorschlag „zu Fuß".
- [x] Gegeben zwei Programmpunkte 12 km voneinander entfernt, wenn ich
      den Transfer anlege, dann lautet der Vorschlag „Auto".
- [x] Gegeben das Formular schlägt „Auto" vor, wenn ich auf „Fähre"
      wechsle, dann werden Dauer und Strecke für die Fähre neu
      vorgeschlagen.
- [x] Gegeben ein vorgeschlagener Transfer, wenn ich die Dauer auf 45
      Minuten ändere und speichere, dann steht am Block „45 Min".
- [x] Gegeben ich habe einen Transfer gespeichert, wenn ich den
      Zeitstrahl ansehe, dann liegt zwischen den beiden Programmpunkten
      ein gestrichelter Block.
- [x] Gegeben ein gespeicherter Transfer, wenn ich die Seite neu lade,
      dann ist er weiterhin da.
- [x] Gegeben zwischen zwei Programmpunkten liegen 20 Minuten und die
      Fahrzeit beträgt 40 Minuten, wenn ich den Transfer speichere, dann
      sehe ich einen Hinweis, dass die Zeit nicht reicht.
- [x] Gegeben zwischen zwei Programmpunkten liegen 20 Minuten und die
      Fahrzeit beträgt 40 Minuten, wenn ich den Transfer speichere, dann
      wird der nächste Programmpunkt NICHT verschoben.
- [x] Gegeben einem der beiden Programmpunkte fehlt die Position, wenn
      ich einen Transfer anlege, dann sehe ich einen Hinweis und KEINEN
      Vorschlag.
- [x] Gegeben einem der beiden Programmpunkte fehlt die Position, wenn
      ich Verkehrsmittel, Dauer und Strecke selbst eintrage, dann lässt
      sich der Transfer speichern.
- [x] Gegeben zwischen zwei Programmpunkten liegt bereits ein Transfer,
      wenn ich dort auf „+" klicke, dann öffnet sich der vorhandene zum
      Ändern — es entsteht KEIN zweiter.
- [x] Gegeben ein Transfer zwischen zwei Programmpunkten, wenn ich einen
      der beiden entferne, dann ist auch der Transfer verschwunden.
- [x] Gegeben ein Transfer zwischen zwei Programmpunkten, wenn ich einen
      der beiden auf eine andere Uhrzeit ziehe, dann liegt der Transfer
      weiterhin zwischen ihnen.
- [x] Gegeben ein gespeicherter Transfer, wenn ich ihn entferne, dann
      ist der gestrichelte Block verschwunden.
- [x] Gegeben ein Reisetag mit zwei Transfers, wenn ich „Transfers"
      wähle, dann sehe ich beide.
- [x] Gegeben der Routing-Dienst ist nicht erreichbar, wenn ich einen
      Transfer anlege, dann sehe ich einen Hinweis und kann die Angaben
      selbst eintragen.

# Constraints

- Strecke und Fahrzeit kommen von OSRM auf OpenStreetMap-Daten — Open
  Source, ohne Zugangsschlüssel (siehe [stack.md](../../stack.md)),
  hinter derselben austauschbaren Schnittstelle wie in req-051.
- Ein Transfer verbindet zwei Programmpunkte desselben Reisetages
  (req-006).
- Im Zweifel vorschlagen statt selbst umbauen — der Plan wird nie ohne
  Bestätigung geändert ([vision.md](../../vision.md)).

# Out of Scope

- Transfers zwischen POIs, die noch nicht verplant sind.
- Mehrere Etappen zwischen denselben zwei Programmpunkten.
- Automatisches Anlegen von Transfers für alle Lücken eines Tages.
- Abfahrtszeiten von Bahn, Bus oder Fähre aus einem Fahrplan.
- Kosten eines Transfers erfassen.
- Verkehrslage in die Fahrzeit einrechnen.
