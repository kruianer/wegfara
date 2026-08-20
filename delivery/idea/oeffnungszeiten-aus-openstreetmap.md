---
titel: Öffnungszeiten aus OpenStreetMap
datum: 2026-08-20
---

## Problem/Nutzen

Der erste Satz der Vision beschreibt den Kernmoment von wegfara mit
„das Museum ist zu". Genau diese Angabe fehlt bisher überall: Ein POI
trägt Name, Ort, Typ, Position, Status und optional eine Webadresse
(req-010, req-013), ein Programmpunkt eine Uhrzeit — aber nirgends
steht, wann der Ort überhaupt offen hat. Der Reiseleiter plant das
Museum auf Montagvormittag, ohne dass irgendetwas widerspricht, und die
Gruppe steht drei Wochen später vor verschlossener Tür.

Auch die KI plant heute blind: Bei der POI-Suche (req-014) und erst
recht bei einem späteren Anpassungsvorschlag hat sie keine Information
darüber, ob ein Ort zur vorgesehenen Zeit erreichbar ist — sie kann
nur raten (Qualität der KI-Vorschläge). Ein Hinweis beim Verplanen
kostet null zusätzliche Handgriffe und verhindert genau den Fehler, den
die App unterwegs sonst mühsam reparieren muss.

Die Quelle ist bereits im Haus: Der Overpass-Abruf in
`lib/osm/overpass-client.ts` liest heute schon die Tags eines Ortes und
verwendet daraus Name, Adresse, Typ und Website — das Feld
`opening_hours` wird dabei verworfen. Es ist eines der am besten
gepflegten OSM-Felder für Museen, Läden, Restaurants und
Sehenswürdigkeiten und deckt auch Saisonzeiten und Feiertage ab.

**Lizenz:** ODbL 1.0. Dauerhaftes Speichern in unserer Datenbank ist
ausdrücklich erlaubt — das ist der Zweck der Lizenz. Auflagen:
Namensnennung „© OpenStreetMap-Mitwirkende" dort, wo die Daten
erscheinen, und Share-Alike für abgeleitete Datenbanken, falls wir
selbst eine solche veröffentlichen (tun wir nicht — die Vision schließt
öffentliche Feeds aus). **Kosten/Limit:** kostenlos über die
öffentliche Overpass-Instanz, ohne Kontingent, bei Einhaltung der
Fair-Use-Etikette (eigener User-Agent, moderates Anfragetempo) — also
dasselbe Regime wie heute schon. **Gespeichert werden darf:** der
Tag-Wert im Original plus Abrufdatum und OSM-Objekt-ID als
Quellennachweis.

## Skizze

**Beim Anlegen mitnehmen.** Der bestehende Overpass-Abruf übernimmt
zusätzlich `opening_hours` (ersatzweise `service_times`) unverändert als
Zeichenkette an den POI, dazu Abrufdatum und OSM-Objekt-ID. Fehlt das
Tag, bleibt das Feld leer — der POI entsteht wie bisher, nichts
blockiert und nichts wird nachgefragt.

**Auswerten statt anzeigen.** Die rohe OSM-Syntax
(`Tu-Su 10:00-18:00; Mo off`) ist für Menschen unlesbar. Eine kleine
Auswertung in `lib/` beantwortet die einzige Frage, auf die es ankommt:
Ist dieser Ort an diesem Datum zu dieser Uhrzeit offen — ja, nein oder
unbekannt. Alles, was sie nicht sicher versteht, ergibt „unbekannt";
raten ist hier schlimmer als schweigen.

**Im Planer, wo der Fehler entsteht.** Bekommt ein POI beim Verplanen
(req-011) eine Zeit, an der er laut Auswertung geschlossen ist,
erscheint am Programmpunkt ein zurückhaltender Hinweis: „Montags
geschlossen (laut OpenStreetMap, Stand 12.08.2026)". Er blockiert
nicht und verschiebt nichts — wegfara ändert einen Plan nie von selbst
(Leitprinzip). In der POI-Liste steht die Öffnungszeit in lesbarer Form
unter dem Ort, mit Quellenangabe und Link zum OSM-Objekt, damit ein
falscher Wert dort korrigiert werden kann.

**Für die KI als Kontext.** Bei der POI-Suche und bei jedem späteren
Planungs- oder Anpassungsvorschlag bekommt die KI die Öffnungszeiten der
betroffenen Orte mitgeliefert. Damit kann sie den Vormittag mit einem
Ort füllen, der vormittags offen hat, und ihre Wahl nachvollziehbar
begründen — statt eine Zeit zu erfinden.

**Unterwegs eine Zeile.** Im Begleiter trägt der laufende oder nächste
Programmpunkt eine Zeile „heute geöffnet bis 18:00" bzw. „laut Karte
heute geschlossen". Kein neuer Bedienschritt, nur eine Information an
der Stelle, an der sie zählt.

**Ehrlich bleiben.** OSM-Öffnungszeiten sind oft veraltet oder fehlen
ganz. Deshalb erscheint die Angabe nie als Zusicherung, sondern immer
mit Quelle und Stand; „unbekannt" wird als „keine Angabe" gezeigt und
nicht als „offen" gedeutet.

Baut auf keiner vorhandenen Idee auf und ist keine Variante davon: Die
Ein-Tipp-Störungsmeldung setzt ein, *nachdem* man vor der geschlossenen
Tür steht, diese Idee verhindert den Fall vorher; die
Wikivoyage-Kurzbeschreibung betrifft eine andere Quelle und ein
beschreibendes, kein zeitliches Feld. Kein umgesetztes Requirement
deckt es ab — req-014 übernimmt aus den Kartendaten ausdrücklich nur
Name, Ort, Typ und Position, req-010/req-013 zeigen nur vorhandene
POI-Felder, und req-003/req-006 kennen am Programmpunkt keine
Öffnungszeit.
