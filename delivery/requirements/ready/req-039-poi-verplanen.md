---
id: req-039
title: POI verplanen und wieder freigeben
app: wegfara
area: Planung
priority: high
created: 2026-09-04
changes: req-011
---

# Goal (Why)

Als Reiseleiter will ich aus den gesammelten POIs den Plan bauen. Heute
kann ich POIs sammeln und einen Plan ansehen, aber ich komme vom einen
nicht zum anderen — die Planungsansicht aus req-011 zeigt nur an. Der
eigentliche Planungsschritt fehlt.

# Function (What)

Aus der Spalte „Noch unverplant" lässt sich ein POI auf den Zeitstrahl
des gewählten Reisetages ziehen. Wo er losgelassen wird, beginnt der
Programmpunkt; seine Dauer ist die geschätzte Dauer des POI-Typs
(req-011). Die Startzeit rastet auf 15 Minuten ein.

Der Programmpunkt übernimmt Name, Position und Typ des POI. Kurz- und
Langtext bleiben leer. Der POI-Typ „Strand" wird dabei zur
Sehenswürdigkeit — die übrigen Typen heißen beim Programmpunkt gleich
wie beim POI.

Der verplante POI verschwindet aus „Noch unverplant". Sein Status
(„Gesetzt", „Wahrscheinlich") bleibt unverändert — verplant und
bewertet sind zwei verschiedene Dinge.

Ein Programmpunkt lässt sich wieder entfernen. Stammt er aus einem POI,
erscheint dieser danach wieder unter „Noch unverplant".

Überlappende Programmpunkte sind erlaubt und teilen sich die Breite des
Zeitstrahls, wie es req-004 für zeitgleiche Programmpunkte vorsieht.

Das Verplanen und das Entfernen sind sofort gespeichert und ohne
Neuladen sichtbar.

# GUI

- Mockup: `delivery/design/planer/Reiseplaner v4.dc.html`, Abschnitt
  „2. Planung" (Vorlage aus req-011).
- Bindend: nur Orientierung. Die Vorlage zeigt die Ansicht, nicht das
  Ziehen — Spaltenbreiten und Stundenraster aus req-011 bleiben
  unverändert, die Gestaltung des Ziehens entscheidet der Worker.

# Acceptance Criteria

- [ ] Gegeben die Reise „Süditalien Rundreise" mit dem unverplanten POI
      „Ausgrabungsstätte Pompeji", wenn ich ihn auf den Zeitstrahl bei
      10:00 ziehe, dann liegt dort ein Programmpunkt „Ausgrabungsstätte
      Pompeji".
- [ ] Gegeben ich ziehe einen POI vom Typ Sehenswürdigkeit auf 10:00,
      wenn ich ihn loslasse, dann endet der Programmpunkt um 12:30
      (2,5 h geschätzte Dauer).
- [ ] Gegeben ich lasse einen POI zwischen 10:00 und 10:15 los, wenn
      der Programmpunkt entsteht, dann beginnt er um 10:00.
- [ ] Gegeben ich habe den POI „Villa Rufolo" verplant, wenn ich die
      Spalte „Noch unverplant" ansehe, dann steht er dort NICHT mehr.
- [ ] Gegeben der POI „Villa Rufolo" hat den Status „Wahrscheinlich",
      wenn ich ihn verplane, dann hat er weiterhin den Status
      „Wahrscheinlich".
- [ ] Gegeben ein POI vom Typ „Strand", wenn ich ihn verplane, dann ist
      der Programmpunkt vom Typ Sehenswürdigkeit.
- [ ] Gegeben ein verplanter POI, wenn ich seinen Programmpunkt
      entferne, dann steht der POI wieder unter „Noch unverplant".
- [ ] Gegeben ein Programmpunkt liegt von 10:00 bis 12:30, wenn ich
      einen zweiten POI auf 11:00 ziehe, dann liegen beide nebeneinander
      im Zeitstrahl.
- [ ] Gegeben ich habe einen POI verplant, wenn ich die Seite neu lade,
      dann liegt der Programmpunkt weiterhin im Zeitstrahl.
- [ ] Gegeben ein Reisetag ohne Programmpunkte, wenn ich ihn wähle,
      dann sehe ich das leere Stundenraster und KEINE Fehlermeldung.
- [ ] Gegeben eine Reise ohne unverplante POIs, wenn ich die
      Planungsansicht öffne, dann ist die Spalte „Noch unverplant" leer
      und das Ziehen wird NICHT angeboten.
- [ ] Gegeben ich entferne einen Programmpunkt, der aus keinem POI
      stammt, wenn ich die Spalte „Noch unverplant" ansehe, dann ist
      dort KEIN neuer Eintrag erschienen.

# Constraints

- Ein Programmpunkt gehört immer zu genau einem Reisetag der Reise —
  außerhalb ihres Zeitraums kann keiner entstehen.
- Der Planer ist für breite Bildschirme. Auf schmalen Bildschirmen
  bleibt es beim heutigen Hinweis; das Verplanen wird dort nicht
  angeboten.

# Out of Scope

- Verschieben, Tageswechsel und Ändern der Dauer eines liegenden
  Programmpunkts — das ist req-040.
- „KI planen lassen" — der Knopf bleibt vorerst ohne Funktion.
- „Transfers" — der Knopf bleibt vorerst ohne Funktion; Transfers
  werden beim Verplanen nicht automatisch erzeugt oder angepasst.
- Bearbeiten von Titel, Kurz- und Langtext, Buchungszustand und
  Kontaktwegen eines Programmpunkts.
- Verplanen von POIs mit Status „Weiß noch nicht" oder „Verworfen".
