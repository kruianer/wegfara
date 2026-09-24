---
titel: Fahrpläne für Bus, Bahn und Fähre aus offenen Daten
datum: 2026-09-24
---

## Problem/Nutzen

Seit req-059 rechnet wegfara echte Wege — aber nur für drei Profile. OSRM
hat nicht mehr zu bieten, und deshalb steht in req-059 eine Tabelle mit
einer leeren Spalte: für **Boot, Flug, Bahn und Fähre** gibt es „kein
Vorschlag", das Formular sagt „Dauer und Strecke bitte eintragen", und
„Fahrpläne von Bahn, Bus oder Fähre abrufen" ist dort ausdrücklich Out of
Scope. Bus wird zwar gerechnet — aber mit dem Auto, was die Fahrzeit
schätzt und die eigentliche Frage nicht berührt. Vier von acht
Verkehrsmitteln (`migrations/0042_transfer_fahrrad.sql`) sind damit
weiterhin eine Behauptung des Reiseleiters.

Der entscheidende Punkt ist aber nicht die fehlende Dauer, sondern dass
bei öffentlichem Verkehr die **falsche Zahl** fehlt. Eine Autofahrt hat
keine Abfahrtszeit — man fährt, wann man will, und die Dauer ist alles,
was man wissen muss. Ein Bus fährt vierzehn Mal am Tag. Die Fähre
Amalfi–Positano braucht 25 Minuten, aber sie fährt um 09:10, 11:40,
14:20 und 18:20, danach nie mehr. „25 Min Fähre" im Plan ist korrekt und
trotzdem nutzlos: Die Gruppe steht um 18:35 am Anleger und der Plan hatte
recht.

Das trifft genau zwei Stellen, und keine davon ist heute versorgt:

- **Der Planer** kann den Fehler nicht zeigen. Er prüft Lücken gegen
  Fahrzeiten, aber nichts prüft, ob zur geplanten Zeit überhaupt etwas
  fährt. Der Aussichtspunkt endet 19:15, die letzte Fähre ging 18:20 —
  das ist kein knapper Plan, das ist eine ungeplante Übernachtung.
  Dasselbe umgekehrt: Wer weiß, dass der Bus zurück bis 23:40 fährt,
  plant das Abendessen ohne Bauchgefühl.
- **Der Begleiter** beantwortet unterwegs die eine Frage nicht, die
  zählt: *wann fährt der nächste?* Der Live-Status (req-051) rechnet den
  Verzug als Fahrzeit von meiner Position zum geplanten Ort — bei einem
  Bus-Transfer ist das die falsche Rechnung. Zehn Minuten Verzug sind
  belanglos, wenn in 25 Minuten der nächste Bus kommt, und sie sind das
  Ende des Tagesplans, wenn es der letzte war. Beide Fälle sehen im
  Begleiter heute identisch aus.

Der Nutzen ist eine einzige Zahl, die alles entscheidet und die man sonst
im Netz sucht, während man mit dem Koffer an der Haltestelle steht: die
nächste und die letzte Abfahrt. Das ist Unterwegs-Tauglichkeit im
Wortsinn — und es trifft denselben Kernmoment wie der erste Satz der
Vision, nur mit der Tür, die nicht das Museum zumacht, sondern der
Fahrplan.

**Quelle, Lizenz, Kosten, Speicherbarkeit.** Die Daten sind GTFS —
das offene Fahrplanformat, in dem inzwischen die meisten europäischen
Verkehrsverbünde ihre Fahrpläne veröffentlichen (Deutschland DELFI,
Schweiz opentransportdata.swiss, Frankreich transport.data.gouv.fr,
Italien regional). Ausgewertet werden sie von **MOTIS** — Open Source
unter **MIT-Lizenz**, im Container betreibbar (Dockerfile im Repo,
REST-API mit OpenAPI-Spezifikation, Port 8080), frisst `osm.pbf` für den
Fußweg zur Haltestelle, GTFS für den Fahrplan und optional GTFS-RT für
Echtzeit-Verspätungen. Also genau die Betriebsform, die für OSRM schon
gilt: ein weiterer Container auf dem Beelink, keine fremden
Nutzungsbedingungen über unseren Daten, Kosten nur Rechenzeit und
Plattenplatz.

Welche Feeds es je Region gibt und unter welcher Lizenz, muss man nicht
selbst zusammensuchen: Das **Transitous**-Projekt pflegt genau diese
Liste, je Feed mit SPDX-Kennung der Lizenz und Link zur Quelle. Das ist
der eigentliche Gewinn dieser Quelle — die Lizenzprüfung ist maschinell
lesbar statt im Kleingedruckten versteckt.

Der öffentliche Transitous-Dienst selbst ist ausdrücklich **nicht** die
Grundlage, sondern höchstens der Blick zum Ausprobieren: Er ist
kostenlos und ohne Schlüssel nutzbar, verlangt aber laut eigener
Nutzungsregel, dass das nutzende Projekt Open Source ist, **untersagt
kommerzielle Nutzung** und bittet darum, vor regelmäßigen
Routing-Anfragen Kontakt aufzunehmen (User-Agent mit Kontaktangabe ist
Pflicht). wegfara ist nicht Open Source und ein späterer Verkauf ist laut
Vision nicht ausgeschlossen — auf eine solche Zusage darf der Betrieb
nicht gebaut werden. Dauerhaft also eigenes MOTIS mit den Feeds der
Reiseregion, im Sinne des Leitprinzips „Open Source und selbst gehostet".

Gespeichert werden darf, was die Lizenz des jeweiligen Feeds erlaubt —
und das ist hier das Ausschlusskriterium, nicht ein Detail. Bei den
verbreiteten offenen Feeds (CC0, CC-BY 4.0 und Verwandte) ist das
dauerhafte Speichern der **abgeleiteten Verbindung** am Transfer erlaubt,
solange die Quelle genannt wird: Abfahrt, Ankunft, Linie, Umstiege,
Dauer, dazu Feedname und Lizenz als Nachweis. Trägt der Feed einer Region
eine restriktive Klausel (kein abgeleitetes Produkt, keine
Weitergabe, keine kommerzielle Nutzung), wird **nichts** gespeichert —
dann zeigt wegfara die Verbindung nur im Moment der Abfrage an und das
Feld bleibt von Hand gefüllt. Nicht gespeichert wird in keinem Fall ein
Feed als Ganzes in unserer Datenbank; der Feed lebt im MOTIS-Container.

**Grenzen ehrlich benannt.** Die Abdeckung ist ungleich: Stadtverkehr in
Mitteleuropa ist sehr gut versorgt, kleine Fährbetriebe und
Regionalbusse in Süditalien oder Griechenland haben oft gar kein GTFS.
Für **Flug** gibt es keine offene Fahrplanquelle — das bleibt von Hand.
Und wo kein Feed ist, gibt es keine Zahl: Es gilt dieselbe Regel wie in
req-059, eine erfundene Zahl wäre schlechter als gar keine.

## Skizze

**Ein eigener Zugang, austauschbar.** Der Fahrplan-Abruf liegt in
`lib/transit/` hinter einer Schnittstelle, genau wie `lib/routing/`
(OSRM) und `lib/osm/` (Nominatim, Overpass). In Tests wird er gemockt
wie die anderen auch. Ob dahinter das eigene MOTIS oder für die Bauphase
etwas anderes steckt, darf die aufrufende Logik nicht sehen.

**Im Planer: Verbindung wählen statt Dauer raten.** Bei den
Verkehrsmitteln Bus, Bahn, Fähre und Boot bietet das Transfer-Formular
„Verbindungen suchen" an. Gesucht wird von der Position des Ausgangs- zur
Position des Ziel-Programmpunkts, zur geplanten Zeit; es kommen bis zu
drei Verbindungen zurück — Abfahrt, Ankunft, Umstiege, Linie. Eine
Auswahl füllt die vorhandenen Felder `duration_min` und `distance_km` und
merkt sich zusätzlich Abfahrtszeit, Linienbezeichnung, Herkunft und
Abrufzeitpunkt (dieselbe Art kleiner Spalten, wie req-059 sie für die
gerechnete Route eingeführt hat). Von Hand schlägt weiterhin berechnet:
Ein selbst eingetragener Wert wird nie überschrieben, Neusuchen ist ein
Angebot, kein Automatismus (Leitprinzip „vorschlagen statt umbauen").

**Der Hinweis „letzte Verbindung".** Der eigentliche Nutzen im Planer ist
wieder nicht die Zahl, sondern der Widerspruch. Liegt das Ende des
vorangehenden Programmpunkts nach der letzten Abfahrt des Tages, zeigt
der Zeitstrahl das an der betroffenen Stelle an — zurückhaltend, im Sinne
von „Letzte Fähre 18:20, Aussichtspunkt endet 19:15", ohne zu blockieren
und ohne den Plan anzufassen. Das ist das dritte Geschwister der beiden
vorhandenen Hinweise: Öffnungszeiten sagen, *ob offen ist*, die Fahrzeit
sagt, *ob man rechtzeitig da wäre*, dieser sagt, *ob überhaupt noch etwas
fährt*.

**Im Begleiter: eine Zeile, kein Bildschirm.** Am laufenden oder nächsten
Transfer mit Fahrplan-Verkehrsmittel steht eine Zeile: „Nächste Abfahrt
17:42 · in 12 Min · danach 18:12 · letzte 21:40". Keine Interaktion,
keine Liste, keine Tastatur — lesbar mit einer Hand und in der Sonne. Wo
der Feed GTFS-RT liefert, trägt die Abfahrt die Echtzeit-Verspätung; wo
nicht, ist es die Sollzeit und sichtbar als solche gekennzeichnet.

**Der Verzug wird richtig gerechnet.** Ist der nächste Transfer ein
Fahrplan-Verkehrsmittel, misst der Live-Status (req-051) nicht mehr die
Fahrzeit zum Ort, sondern die Abfahrt, die ich noch erreiche: „10 Min
Verzug — nächste Abfahrt in 25 Min, passt" gegen „letzte Abfahrt
verpasst". Derselbe Bildschirm, dieselbe Pille, nur die Rechnung passt
zum Verkehrsmittel. Das ist eine Erweiterung von req-051, kein Umbau.

**Die KI bekommt etwas Konkretes.** Bei einem Umplanungs-Vorschlag steht
die nächste erreichbare Abfahrt im Kontext. Erst damit ist die
Ein-Tipp-Störungsmeldung („Bus verpasst") mehr als eine Meldung: Die KI
weiß, dass der nächste um 18:12 fährt, und kann zwei Punkte tauschen
statt zu raten (Qualität der KI-Vorschläge).

**Passt ins Tagespaket.** Die gewählten Verbindungen und die restlichen
Abfahrten des Tages sind wenige Kilobyte und genau die Art Daten, die in
das Offline-Tagespaket gehört — der Fahrplan des heutigen Tages ist
ohnehin schon geschrieben, bevor man losfährt. Eine Fahrplanauskunft ist
im Ausland ohne Datenroaming sonst das Erste, was fehlt.

**Abgrenzung.** Keine Variante einer vorhandenen Idee und keine
Wiederholung eines Requirements: req-059 liefert Straßenrouten und
schließt Fahrpläne ausdrücklich aus, die Idee „Echte Wegzeiten aus
offenem Routing" lässt Bus, Boot, Bahn, Fähre und Flug bewusst bei
handgetragenen Werten stehen („ein Straßenrouter kennt keine
Fahrpläne"), die Öffnungszeiten aus OpenStreetMap beantworten, *ob ein
Ort offen hat*, Wikivoyage, *warum er lohnt*, das Tagespaket, *ob ohne
Netz überhaupt etwas angezeigt wird*. Am nächsten liegt „Feiertage und
Ferien im Reisezeitraum" — aber die sagt, *was für ein Tag* es ist,
während der GTFS-Kalender sagt, *was an diesem Tag tatsächlich fährt*:
Der Sonntagsfahrplan am Feiertag ist dort eine Warnung, hier eine
Abfahrtszeit. Beides ergänzt sich, keines ersetzt das andere.

Keine Non-Goals berührt: wegfara kauft keine Tickets und bucht keine
Fahrt — es liest Fahrpläne. Navigiert und gebucht wird wie bisher
außerhalb, per Link ohne Nutzerdaten. Kein Stack-Umbau: ein weiterer
Container neben OSRM, PostgreSQL und Next.js bleiben unangetastet.
