---
project: wegfara
---

# Ideen-Richtung

Bindende Vorgabe fuer den Ideen-Task des autonomen Workers (req-011).
Er beruecksichtigt sie bei jedem Ideen-Vorschlag.

## Schwerpunkte

Ideen duerfen das ganze Produkt betreffen — Planer wie Begleiter, auch
Funktionen, die erst spaeter dran sind. Vier Richtungen sind gesetzt:

- **Unterwegs-Tauglichkeit:** Bedienung mit einer Hand, schlechtes oder
  fehlendes Netz, Sonnenlicht, Akku, wenig Zeit und Aufmerksamkeit.
  Alles, was die Realitaet unterwegs betrifft.
- **Qualitaet der KI-Vorschlaege:** Wie treffsicher plant und umplant
  die KI? Kontext, gelernte Vorlieben, nachvollziehbare Begruendungen,
  gute Vorschlaege bei duenner Informationslage.
- **Gruppen-Zusammenspiel:** Abstimmung ueber Vorschlaege, Ausgaben und
  Verrechnung, Belege, sich wiederfinden — alles, was mehrere Reisende
  betrifft.
- **Weniger Handgriffe:** Schritte einsparen, Dinge erkennen statt
  eingeben lassen (Beleg fotografieren statt Betrag tippen).
- **Datenquellen fuer POIs und Aktivitaeten:** Halte laufend Ausschau
  nach Quellen fuer Orte, Aktivitaeten, Oeffnungszeiten, Veranstaltungen
  und Wetter. Bevorzugt Open Data (OpenStreetMap, Wikidata, Wikivoyage,
  offene Behoerden- und Verkehrsdaten) oder Dienste mit grosszuegigem
  Freikontingent. Solche Vorschlaege sind ausdruecklich erwuenscht und
  duerfen sich wiederholen, solange es um eine andere Quelle geht.

  Pruefe bei jeder vorgeschlagenen Quelle zwingend mit, ob ihre
  Nutzungsbedingungen das dauerhafte Speichern der Daten in unserer
  Datenbank erlauben. Das ist kein Detail, sondern das
  Ausschlusskriterium: Google Places etwa untersagt das Vorhalten von
  Inhalten (nur die `place_id` darf gespeichert werden), aehnliche
  Klauseln haben andere kommerzielle Anbieter. Ein Reiseplan mit
  Programmpunkten ist genau solcher gespeicherter Inhalt — eine Quelle,
  die das nicht erlaubt, ist fuer uns unbrauchbar, egal wie gut ihre
  Daten sind. Nenne im Vorschlag Lizenz, Kosten-/Limitmodell und was
  gespeichert werden darf.

## Zielbild

wegfara soll die App sein, die man unterwegs tatsaechlich zueckt — weil
sie in dem Moment hilft, in dem der Plan nicht mehr aufgeht. Eine gute
Idee macht eine reale Reisesituation spuerbar leichter; sie erweitert
nicht den Funktionsumfang um seiner selbst willen.

Ungewoehnliche, kreative oder auf den ersten Blick verrueckte Ideen sind
ausdruecklich erwuenscht — solange der Nutzen konkret benennbar ist.
Der Massstab ist nicht "klingt vernuenftig", sondern "loest eine reale
Situation besser als das Naheliegende". Ein Vorschlag ohne klar
benannten Nutzen faellt durch, wie brav oder wie wild er auch ist.

Solange es noch keinen lauffaehigen Stand gibt, zaehlt zusaetzlich: eine
gute Idee bringt den ersten echten Reise-Durchlauf naeher.

## No-Gos

- **Nichts, was den Stack umbaut:** keine Vorschlaege zu anderen
  Frameworks, Datenbanken, Sprachen oder Architektur-Wechseln. Der Stack
  ist entschieden (siehe [stack.md](stack.md)).
- **Keine Monetarisierung:** keine Ideen zu Bezahlmodellen, Abos oder
  Preisen — auch wenn ein Verkauf spaeter nicht ausgeschlossen ist.
- **Keine Account-Verwaltung:** keine Ideen zu Registrierung,
  Mandanten-Umschaltung oder Nutzerverwaltung. Im Stack bewusst
  ausgeklammert, solange es genau einen Mandanten gibt.
- **Nichts, was die Non-Goals aufweicht:** keine Ideen Richtung Buchung,
  Bezahlung oder oeffentliche Feeds — die Vision schliesst das aus
  (siehe [vision.md](vision.md)).
- **Keine Wiederholungen:** Lies vor jedem Vorschlag alle vorhandenen
  Ideen in `delivery/idea/` und `delivery/idea/done/` sowie die
  Requirements in `delivery/requirements/` (inklusive `done/`). Schlage
  nichts vor, was dort schon steht oder bereits umgesetzt ist — auch
  nicht in anderen Worten. Bei einer echten Weiterentwicklung einer
  bestehenden Idee: benenne, worauf sie aufbaut und was neu daran ist.
  Faellt dir nichts Neues ein, schlage lieber nichts vor als eine
  Variante von gestern.
