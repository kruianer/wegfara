---
titel: Echte Wegzeiten aus einem offenen Routing-Dienst
datum: 2026-09-03
---

## Problem/Nutzen

Der Weg zwischen zwei Programmpunkten ist heute eine Behauptung.
req-006 legt es ausdrücklich fest: „Dauer und Distanz sind am Transfer
hinterlegt und werden nicht berechnet" — in der Datenbank stehen
`duration_min` und `distance_km` als von Hand eingetragene Zahlen
(`migrations/0008_transfers.sql`). Woher sie kommen, weiß niemand: aus
einer Schätzung, aus einem alten Blick in eine Kartenanwendung, oder
gar nicht. Wer im Planer einen Punkt verschiebt oder einen neuen
dazwischenschiebt, bekommt keinen Widerspruch, egal wie unrealistisch
die Reihenfolge wird.

Das trifft genau den zweiten Satz der Vision: „der Stau frisst zwei
Stunden". Ein Tagesplan steht und fällt mit den Wegen dazwischen — die
halbe Stunde Fahrt entscheidet, ob sich der nächste Punkt überhaupt
ausgeht (so begründet req-006 sich selbst). Solange diese halbe Stunde
geraten ist, ist der Plan auf dem Papier stimmig und in der Realität
falsch, und zwar reihenweise: drei zu knappe Übergänge am Vormittag
summieren sich zu einem gestrichenen Abendessen.

Zwei Stellen brauchen die Zahl dringend, und beide bekommen sie heute
nicht:

- **Der Planer** kann nicht sagen „das geht sich nicht aus". Er kennt
  Anfangs- und Endzeit der Programmpunkte und die Positionen der POIs
  (req-010, req-013) — ihm fehlt nur die Fahrzeit dazwischen, um die
  Lücke gegen den Weg zu rechnen.
- **Die KI** plant und plant um ohne jedes Gefühl für Entfernung. Bei
  der POI-Suche (req-014) und erst recht bei einem späteren
  Anpassungsvorschlag unterwegs muss sie wissen, was in der
  verbleibenden Zeit überhaupt erreichbar ist. Ein Vorschlag, der 40
  Minuten Fahrt in eine 15-Minuten-Lücke legt, ist kein Vorschlag,
  sondern ein neuer Fehler (Qualität der KI-Vorschläge).

**Quelle, Lizenz, Speicherbarkeit.** Routing auf OpenStreetMap-Daten
mit einer selbst gehosteten Routing-Maschine — OSRM (BSD-2-Lizenz) oder
Valhalla (MIT-Lizenz), beide Open Source, beide auf dem Beelink im
Container zu betreiben, dort wo schon PostgreSQL läuft. Die Kartendaten
sind OSM (ODbL 1.0), dieselbe Quelle, die über Nominatim und Overpass
ohnehin schon im Haus ist.

Das ist der entscheidende Punkt gegenüber kommerziellen
Routing-Anbietern: Bei selbst gehostetem OSRM/Valhalla gibt es
überhaupt keine fremden Nutzungsbedingungen, die das Speichern
einschränken könnten. Die berechnete Fahrzeit ist unser eigenes
Ergebnis auf ODbL-Daten und darf dauerhaft am Transfer stehen bleiben —
die ODbL verlangt Namensnennung von OpenStreetMap und greift mit ihrer
Share-Alike-Pflicht auf abgeleitete *Datenbanken*, nicht auf einzelne,
in der eigenen Planung verwendete Werte. Kosten: keine, nur Rechenzeit
und Plattenplatz. Grenzen ehrlich benannt: Eine vorbereitete
OSRM-Region kostet je nach Ausschnitt einige GB RAM und Plattenplatz,
und der Ausschnitt muss zum Reiseziel passen — pro Reise das Land oder
die Region einspielen ist der realistische Betrieb, nicht „die Welt".

Ausdrücklich **nicht** geeignet und deshalb nicht vorgeschlagen: die
öffentlichen Demo-Server (`router.project-osrm.org`,
`valhalla1.openstreetmap.de`) — sie sind laut ihren eigenen Hinweisen
für Entwicklung und Demonstration gedacht, nicht für den Betrieb einer
App. Wer sie im Alltag benutzt, baut auf einer Zusage, die niemand
gegeben hat. Für die Bauphase, bevor der Container steht, ist
OpenRouteService mit seinem kostenlosen Kontingent (Anmeldung, ~2.000
Anfragen/Tag) eine vertretbare Brücke; die dauerhafte Lösung ist der
eigene Dienst — im Sinne des Leitprinzips „Open Source und selbst
gehostet statt proprietärer Dienst".

Kein Widerspruch zum Stack: Navigation wird weiterhin per Link an
Google Maps übergeben (req-006), ohne Nutzerdaten. Hier geht es nicht
um Navigation, sondern um die *Zahl* — wie lange der Weg dauert,
bevor jemand losgeht.

## Skizze

**Die Zahl entsteht beim Planen, nicht beim Nachschlagen.** Haben
Ausgangs- und Zielpunkt eines Transfers eine Position, holt der Planer
Dauer und Distanz für das gewählte Verkehrsmittel (zu Fuß, Auto) vom
Routing-Dienst und trägt sie in die vorhandenen Felder `duration_min`
und `distance_km` ein — kein neues Datenmodell, nur endlich gefüllte
Felder. Dazu kommen zwei kleine Spalten: woher der Wert stammt
(berechnet oder von Hand) und wann er geholt wurde.

**Von Hand schlägt berechnet.** Trägt der Nutzer eine Dauer selbst ein,
bleibt sie stehen und wird nicht überschrieben — wer weiß, dass die
Fähre nur zweimal täglich fährt, weiß es besser als ein Straßenrouter.
Das Neuberechnen ist ein Angebot („neu berechnen"), kein Automatismus,
und ändert nie stillschweigend etwas am bestehenden Plan (Leitprinzip
„vorschlagen statt selbst umbauen"). Für Bus, Boot, Bahn, Fähre und Flug
(req-006, erweitert durch req-018) rechnet der Dienst gar nicht erst — ein
Straßenrouter kennt keine Fahrpläne, und eine erfundene Zahl wäre
schlechter als gar keine. Dort bleibt der Wert von Hand, sichtbar als
solcher.

**„Geht sich das aus?"** Der eigentliche Nutzen ist nicht die Zahl,
sondern der Widerspruch: Ist die Lücke zwischen dem Ende eines
Programmpunkts und dem Beginn des nächsten kleiner als die berechnete
Fahrzeit, zeigt der Planer das an der betroffenen Stelle im Zeitstrahl
an — zurückhaltend, im Sinne von „14 Min Fahrt, aber nur 5 Min Zeit",
ohne zu blockieren und ohne den Plan anzufassen. Der Reiseleiter darf
knapp planen; er soll es nur wissen. Dieser Hinweis ist das Gegenstück
zum Öffnungszeiten-Hinweis: der eine sagt, ob der Ort offen hat, dieser
sagt, ob man rechtzeitig da ist.

**Die KI bekommt die Entfernung mitgeliefert.** Bei der POI-Suche und
bei jedem späteren Umplanungs-Vorschlag steht die Fahrzeit vom aktuell
geplanten Ort im Kontext — so entstehen Vorschläge, die in die Lücke
passen, statt Vorschläge, die man erst nachmessen muss.

**Sparsam mit Anfragen.** Berechnet wird nur bei Bedarf: wenn ein
Transfer entsteht, wenn sich eine der beiden Positionen ändert oder
wenn der Nutzer es anstößt. Der Zugriff liegt hinter einer eigenen
Schnittstelle in `lib/routing/`, analog zu `lib/osm/` und zur
KI-Kapselung aus [stack.md](../stack.md) — der Wechsel von
OpenRouteService auf das selbst gehostete OSRM darf später keine
Änderung an der aufrufenden Logik kosten. In Tests wird der Dienst
gemockt, wie Nominatim und Overpass auch.

**Abgrenzung.** Keine Variante einer vorhandenen Idee: Die
Öffnungszeiten aus OpenStreetMap beantworten, *ob* ein Ort offen hat,
die Wikivoyage-Kurzbeschreibung, *warum* er lohnt, das Tagespaket,
*ob überhaupt etwas angezeigt wird* ohne Netz, und die
Ein-Tipp-Störungsmeldung, *wie* der Nutzer eine Störung meldet. Diese
Idee beantwortet die bisher offene vierte Frage: *wie lange der Weg
dorthin wirklich dauert*. Kein Requirement deckt sie ab — req-006
schließt die Berechnung ausdrücklich aus, req-018 fügt nur weitere
Verkehrsmittel hinzu. Der Stack wird nicht umgebaut: OSM bleibt die
Kartenquelle, Google Maps bleibt das Ziel des Navigations-Links,
PostgreSQL und Next.js bleiben unangetastet.
