---
titel: Feiertage und Ferien im Reisezeitraum
datum: 2026-09-17
---

## Problem/Nutzen

wegfara weiß heute nicht, was für ein Tag der 15. August am Reiseziel
ist. Ein Reisetag ist ein Datum zwischen `start_date` und `end_date`
(`migrations/0001_init.sql`) und sonst nichts — im ganzen Repo gibt es
keine Zeile zu Feiertagen oder Ferien. Der Reiseleiter legt den
Museumsbesuch auf Ostermontag, den Einkauf auf Mariä Himmelfahrt, die
Anreise auf den ersten Ferientag, und nichts widerspricht.

Ein gesetzlicher Feiertag ist dabei nicht ein Detail unter vielen,
sondern der Schalter, der einen halben Reisetag umlegt: Museen und
Behörden zu, Läden zu, öffentlicher Verkehr nach Sonntagsfahrplan,
Restaurants entweder geschlossen oder voll, dafür Umzüge und
Straßenfeste, die es sonst nicht gäbe. Schulferien wiederum entscheiden
über genau das, was die Vision im dritten Satz nennt — „die Schlange
dauert noch dreißig Minuten": Strandparkplätze, Seilbahnen und
Familienziele sind in den Ferien des jeweiligen Landes ein anderes
Erlebnis als zwei Wochen später, und der Ferienbeginn ist der Tag, an
dem der Stau aus dem ersten Satz der Vision entsteht.

Das trifft alle drei Stellen, an denen wegfara arbeitet:

- **Der Planer** kann den Fehler nicht zeigen. Beim Verplanen eines POI
  (req-039) und beim Umplanen (req-040) sieht der Nutzer eine Uhrzeit,
  aber nicht, dass der gewählte Tag am Reiseziel ein Feiertag ist.
- **Die KI plant blind.** In den Kontext von „KI planen lassen"
  (req-056) und der POI-Suche (req-014, req-057) geht heute kein Kalender
  ein. Sie kann nicht wissen, dass der Dienstag in Spanien ein Feiertag
  ist, und verteilt Programmpunkte auf Tage, die sie nicht beurteilen
  kann (Ideen-Richtung: Qualität der KI-Vorschläge bei dünner
  Informationslage).
- **Der Begleiter** kann morgens nicht sagen, warum heute alles anders
  ist — und der Nutzer merkt es erst vor der verschlossenen Tür.

Der Nutzen ist ein Hinweis zur richtigen Zeit, der null zusätzliche
Handgriffe kostet: Der Fehler wird drei Wochen vorher am Schreibtisch
sichtbar, wo er zehn Sekunden kostet, statt unterwegs, wo er einen
Vormittag kostet.

**Abgrenzung zur Idee „Öffnungszeiten aus OpenStreetMap":** Die baut
auf, diese hier ist die fehlende zweite Hälfte. `opening_hours` in OSM
kennt die Regel `PH off` — „an Feiertagen geschlossen" — und viele
Museen und Läden sind genau so getaggt. Ohne einen Feiertagskalender
lässt sich diese Regel gar nicht auswerten: Man weiß, dass der Ort an
Feiertagen zu hat, aber nicht, ob der 15. August einer ist. Neu ist
außerdem die Blickrichtung: Öffnungszeiten sind eine Eigenschaft eines
einzelnen POI, Feiertage und Ferien eine Eigenschaft eines ganzen Tages
und einer ganzen Region — sie wirken auch auf Verkehr, Andrang und
Anreise, also auf Dinge, die an keinem POI hängen. Beide Ideen sind
unabhängig voneinander nutzbar und verstärken sich, wenn beide da sind.

**Quelle:** die OpenHolidaysAPI (`openholidaysapi.org`), ein offenes
Datenprojekt, das gesetzliche Feiertage **und Schulferien** für die
meisten europäischen Länder liefert, jeweils mit regionaler Gliederung
(ISO 3166-2) — wichtig, weil Feiertage in Spanien, Deutschland oder der
Schweiz von der Region abhängen und Schulferien fast überall.

- **Lizenz:** CC BY 4.0. Dauerhaftes Speichern in unserer Datenbank ist
  ausdrücklich erlaubt, auch kommerziell, solange die Quelle genannt
  wird. Damit erfüllt sie das Ausschlusskriterium der Ideen-Richtung —
  anders als Google Places darf der Inhalt selbst vorgehalten werden,
  und ein Reiseplan mit dem Vermerk „Feiertag" ist genau solcher
  gespeicherter Inhalt.
- **Kosten-/Limitmodell:** kostenlos, ohne Zugangsschlüssel, offene
  REST-Schnittstelle. Keine Kontingentpflicht; übliche Etikette
  (eigener User-Agent, moderates Tempo) genügt, zumal wir je Reise nur
  einmal ein paar Wochen abfragen. Kein Account, kein Schlüssel je
  Mandant — anders als bei Google Places (req-028) gibt es hier nichts
  zu hinterlegen.
- **Gespeichert werden darf:** Datum, Name des Feiertags bzw. der
  Ferien, Art (gesetzlich/Schule), Land und Region, dazu der
  Quellennachweis.
- **Geltungsbereich und Notausgang:** Die Abdeckung ist europäisch. Für
  Reiseziele außerhalb liefert die Quelle nichts — dann bleibt der
  Reisetag schlicht ohne Abzeichen, wie heute. Eine weltweite
  Ergänzung (etwa Nager.Date, quelloffen und selbst hostbar, was zum
  Leitprinzip „selbst gehostet" passt) ist denkbar, ihre Nutzungs- und
  Lizenzbedingungen sind dann aber vor Verwendung erneut zu prüfen;
  Schulferien liefert sie ohnehin nicht. Für den ersten Schritt ist
  Europa genug.

## Skizze

**Land und Region ermitteln.** Eine Reise hat mit `main_place_lat` /
`main_place_lng` bereits eine Position. Daraus wird per
Nominatim-Rückwärtssuche — im Haus, seit req-041 für „Ort aus Adresse
ableiten" genutzt — der Ländercode und, wo vorhanden, die Region
bestimmt. Kein neues Eingabefeld, keine Länderauswahl: die Reise weiß
schon genug.

**Einmal holen, dann liegen lassen.** Beim Anlegen einer Reise und bei
jeder Änderung des Zeitraums oder des Hauptorts werden die Feiertage und
Ferientage für genau diesen Zeitraum geholt und an der Reise gespeichert
(neue Tabelle mit `trip_id`, Datum, Name, Art, Region, Quelle,
Abrufzeitpunkt). An der Reise und nicht als globale Stammdaten, damit
die Mandantentrennung aus [stack.md](../stack.md) ohne Sonderfall gilt —
es sind eine Handvoll Zeilen je Reise. Kein Abruf bei jeder Anzeige,
dieselbe Regel wie bei den Wechselkursen (req-029).

**Im Planer sichtbar, wo der Tag gewählt wird.** Der betroffene Reisetag
trägt in der Tagesauswahl und in der Planungsansicht ein kleines,
unaufdringliches Abzeichen. Tippen zeigt Name, Art („gesetzlicher
Feiertag", „Schulferien") und die Region, dazu den Quellenhinweis. Ein
Feiertag ist ein Hinweis, keine Sperre: Wer bewusst zum Stadtfest will,
plant weiter wie bisher — Leitprinzip „vorschlagen statt selbst
umbauen", nichts wird verschoben, nichts verboten.

**In den Kontext der KI.** Beim KI-Planen (req-056), bei der POI-Suche
mit Präferenzen (req-057) und bei einem späteren Umplanungsvorschlag
gehen die betroffenen Tage als eine Zeile je Tag in die Anfrage („2027-08-15:
gesetzlicher Feiertag (Mariä Himmelfahrt), Katalonien"). Das ist die
billigste denkbare Verbesserung der Vorschlagsqualität: ein paar Zeichen
mehr im Prompt, dafür verteilt die KI Museen und Einkäufe nicht mehr auf
Tage, an denen beides zu ist, und kann einen Feiertag sogar bewusst
nutzen statt ihn zu erleiden.

**Im Begleiter eine Zeile, mehr nicht.** Ist der heutige Tag ein
Feiertag oder liegt er in den Ferien der Region, steht das als kurzer
Hinweis im Kopfbereich des Zeitstrahls, neben dem Wetter (req-002) — die
gleiche Art Information: eine Rahmenbedingung des Tages, die man in zwei
Sekunden im Vorbeigehen liest, mit einer Hand, ohne zu tippen.

**Robust und austauschbar.** Der Abruf liegt hinter einer eigenen
Schnittstelle in `lib/holidays/`, mit der Adresse des Dienstes an genau
einer Stelle und über eine Umgebungsvariable übersteuerbar — dieselbe
Regel, die [stack.md](../stack.md) für `lib/routing/` und OSRM
aufstellt, damit die Quelle später getauscht oder selbst gehostet werden
kann. Antwortet der Dienst nicht, bleibt die Reise ohne
Feiertagsangaben benutzbar: kein Abzeichen, keine Fehlermeldung, kein
blockiertes Formular. Und weil die Daten in der Datenbank an der Reise
hängen, sind sie unterwegs auch ohne Netz da, sobald es ein Tagespaket
gibt.
