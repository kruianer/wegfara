---
id: req-058
title: Dauer am POI und Beschreibung per KI
app: wegfara
area: Planung
priority: normal
created: 2026-09-08
---

# Goal (Why)

Als Reiseleiter weiß ich beim Sammeln eines POI schon, wie lange wir
dort bleiben wollen — beim Verplanen bekommt jeder Programmpunkt aber
die geschätzte Dauer seines Typs, die oft danebenliegt. Und die
Beschreibung eines Ortes will ich nicht selbst tippen, wenn die KI sie
mir schreiben kann.

Dieses Requirement holt nach, was von req-045 offen blieb. Dessen
Hauptteil — die Ortssuche als erstes Feld — ist inzwischen durch req-048
erledigt; req-045 selbst entfällt deshalb ersatzlos.

# Function (What)

**Dauer am POI.** Das POI-Formular bekommt ein Feld „Dauer", eintragbar
in Schritten von 15 Minuten und freiwillig. Bleibt es leer, gilt
weiterhin die geschätzte Dauer des POI-Typs (req-011): Sehenswürdigkeit
2,5 h, Stadt & Dorf 3 h, Restaurant 2 h, Strand 3 h, Aktivität 2 h,
Hotel 1 h, Weltkulturerbe 2,5 h. Das Feld steht nach dem Status.

Beim Verplanen (req-039) bestimmt die eingetragene Dauer die Länge des
Programmpunkts. Auch die KI-Planung (req-056) rechnet mit ihr.

**Beschreibung per KI.** Neben Kurztext und Langtext steht ein Knopf
„Beschreibung vorschlagen". Auf Knopfdruck schreibt die KI beide Texte,
gestützt auf eine Websuche zum Namen des Ortes. Der Vorschlag erscheint
in den Feldern und ist dort änderbar. Ohne Knopfdruck läuft kein
KI-Aufruf. Ist für den Account kein Zugangsschlüssel für die KI
hinterlegt (req-028), erscheint der Knopf nicht.

Nach der Umsetzung wird [datenbank.md](../../datenbank.md) auf den
neuen Stand gebracht.

# Acceptance Criteria

- [ ] Gegeben ich öffne ein POI-Formular, wenn ich es von oben lese,
      dann steht das Feld „Dauer" nach dem Status.
- [ ] Gegeben ich trage als Dauer 1,5 h ein, wenn ich den POI speichere
      und wieder öffne, dann steht dort weiterhin 1,5 h.
- [ ] Gegeben ein POI vom Typ Restaurant mit eingetragener Dauer 1,5 h,
      wenn ich ihn auf den Zeitstrahl auf 12:00 ziehe, dann endet der
      Programmpunkt um 13:30.
- [ ] Gegeben ein POI vom Typ Restaurant ohne eingetragene Dauer, wenn
      ich ihn auf den Zeitstrahl auf 12:00 ziehe, dann endet der
      Programmpunkt um 14:00.
- [ ] Gegeben ich trage als Dauer 1 Stunde 7 Minuten ein, wenn ich das
      Feld verlasse, dann wird die Eingabe abgelehnt — nur Schritte von
      15 Minuten sind zulässig.
- [ ] Gegeben Kurztext und Langtext sind leer, wenn ich „Beschreibung
      vorschlagen" wähle, dann stehen danach Texte in beiden Feldern.
- [ ] Gegeben ich habe eine vorgeschlagene Beschreibung erhalten, wenn
      ich sie überschreibe und speichere, dann steht mein Text im POI.
- [ ] Gegeben für meinen Account ist kein Zugangsschlüssel für die KI
      hinterlegt, wenn ich das POI-Formular öffne, dann ist der Knopf
      „Beschreibung vorschlagen" NICHT vorhanden.
- [ ] Gegeben ich fülle das Formular aus, ohne den Knopf zu drücken,
      wenn ich speichere, dann wurde KEINE KI-Anfrage ausgelöst.
- [ ] Gegeben die Umsetzung ist fertig, wenn ich
      [datenbank.md](../../datenbank.md) öffne, dann ist die Dauer des
      POI dort beschrieben.

# Constraints

- Die Dauer folgt dem 15-Minuten-Raster des Zeitstrahls (req-039).
- Die KI-Beschreibung läuft über den Zugangsschlüssel des Accounts
  (req-028) und kostet je Aufruf — deshalb nur auf Knopfdruck.
- Der Zugriff auf die KI bleibt hinter der austauschbaren Schnittstelle
  in `lib/ai/` (siehe [stack.md](../../stack.md)); die Websuche wird
  Teil dieser Schnittstelle, kein Aufruf daran vorbei.

# Out of Scope

- Die Ortssuche als erstes Feld — durch req-048 erledigt.
- Beschreibungen für bestehende POIs nachträglich erzeugen.
- Beschreibungen bei der KI-Suche (req-057) automatisch erzeugen.
- Die Dauer beim Verplanen von Hand nachträglich erzwingen.

# Umgesetzt (2026-09-08)

Nicht vom Worker, sondern in einer Sitzung mit dem Nutzer -- der Worker war
zu dieser Zeit unzuverlaessig.

**Dauer am POI.** Neue Spalte `poi.duration_min` (Migration 0041), Feld im
Formular nach dem Status. Welche Dauer gilt, entscheidet
`poiDurationMinutes()` in `lib/pois/estimated-duration.ts` als einzige
Stelle -- alle fuenf Aufrufer (Verplanen, Vorschau, KI-Planung, Tagesplan,
Liste) fragen dort. Das Raster prueft `lib/pois/validate.ts`; die Datenbank
sichert nur, dass der Wert positiv ist, weil die Test-Datenbank weder `%`
noch `mod()` kennt.

**Beschreibung per KI.** Die Schnittstelle in `lib/ai/` bekam
`completeWithWebSearch`; kennt ein Modell das Werkzeug nicht, wird ohne
Suche gefragt, statt die Funktion stillschweigend abzuschalten. Die Logik
liegt in `lib/pois/beschreibung.ts`, die Route unter
`/api/poi-beschreibung`. Ohne Zugangsschluessel des Accounts erscheint der
Knopf nicht; ein Fehlschlag wird gemeldet, nicht verschluckt (bug-021).

20 neue Tests. `delivery/datenbank.md` ist nachgezogen.
