---
titel: Das Nötigste in der Nähe — Toilette, Trinkwasser, Apotheke aus OpenStreetMap
datum: 2026-10-29
---

## Problem/Nutzen

Die dringendsten Fragen unterwegs kommen in keinem Reiseplan vor: Das
Kind muss jetzt aufs Klo, die Wasserflaschen sind leer, jemand braucht
ein Pflaster oder Bargeld, weil die Bodega keine Karte nimmt. Heute heißt
das im Begleiter (`/go`): App wechseln, in Google Maps „Toilette“ tippen,
sich durch Cafés und Werbung wühlen — einhändig, in der Sonne, mit
quengelnder Gruppe. Genau der Moment, in dem wegfara helfen soll, und
genau der, in dem es heute nichts beiträgt.

Im Repo gibt es dafür nichts: Der Begleiter kennt nur die Programmpunkte
und Transfers des Tages (req-003, req-006), die Karte (req-008) zeigt nur
POIs der Reise. Keine vorhandene Idee und kein Requirement behandelt
Infrastruktur rund um die aktuelle Position — die Öffnungszeiten-Idee
(`oeffnungszeiten-aus-openstreetmap.md`) reichert gesammelte POIs an,
die Regentag-Idee sucht Alternativen *für den Plan*. Hier geht es um das
Gegenteil: Dinge, die man nie planen würde, aber garantiert braucht.

Nutzen: ein Tipp statt App-Wechsel und Suche; funktioniert auch dann,
wenn der Plan längst nicht mehr aufgeht.

## Skizze

**Datenquelle: OpenStreetMap über die Overpass API**

- Lizenz: ODbL 1.0. Dauerhaftes Speichern ist ausdrücklich erlaubt;
  Pflicht ist die Namensnennung („© OpenStreetMap-Mitwirkende“, steht
  bei der Karte ohnehin) und Share-Alike nur für eine *weitergegebene*
  abgeleitete Datenbank — wegfara gibt keine weiter. Damit ist die Quelle
  für uns uneingeschränkt nutzbar.
- Kosten/Limit: kostenlos, kein Schlüssel. Die öffentliche Instanz
  (overpass-api.de) bittet um unter ~10 000 Abfragen pro Tag und
  kurze Abfragen; bei unserem privaten Kreis fällt eine Handvoll pro
  Reisetag an. Adresse wie bei OSRM an einer Stelle, per
  `OVERPASS_BASE_URL` übersteuerbar (später auf dem Beelink).
- Gute Abdeckung gerade in Europa: `amenity=toilets` (mit `fee`,
  `wheelchair`, `changing_table`), `amenity=drinking_water`,
  `amenity=pharmacy`, `amenity=atm`, ggf. `amenity=bench`/`shelter`.

**Im Begleiter**

- Eine Schaltfläche „In der Nähe“ in der unteren Leiste bzw. im
  Kopfbereich, daneben vier große Kacheln: 🚻 Toilette · 💧 Wasser ·
  ⚕️ Apotheke · 💶 Geldautomat. Ein Tipp, keine Texteingabe.
- Ergebnis: die nächsten drei Treffer als Liste mit Luftlinie in Metern
  und Gehrichtung, kleine Kennzeichen „kostenlos“, „barrierefrei“,
  „Wickeltisch“. Tipp auf einen Treffer öffnet die Navigation wie bei
  Programmpunkten (Link an Google Maps, ohne Nutzerdaten).
- Position aus dem vorhandenen GPS (req-050/req-051); ohne GPS um den
  aktuellen bzw. nächsten Programmpunkt.

**Vorab laden statt unterwegs suchen**

- Beim Öffnen eines Reisetags holt der Server einmal pro Programmpunkt
  die Treffer im Umkreis von ~800 m und legt sie in einer eigenen
  Tabelle ab (OSM-Typ/-ID, Kategorie, Position, wenige Tags, Abrufdatum).
  Nach 30 Tagen wird neu abgerufen.
- So steht die Antwort auch bei schlechtem Netz sofort da und lässt sich
  später ins Tagespaket (`tagespaket-offline-im-begleiter.md`) aufnehmen;
  eine Live-Abfrage um die tatsächliche Position ergänzt nur, wenn Netz
  da ist.

**Abgrenzung**

- Keine neuen POIs in der Sammlung, kein Eintrag im Plan — die Treffer
  sind Hilfsdaten, keine Reiseziele.
- Kein Planer-Bestandteil; ausschließlich Begleiter.
- In Tests wird Overpass gemockt (stack.md).
