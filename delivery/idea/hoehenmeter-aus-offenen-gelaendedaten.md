---
titel: Höhenmeter am Weg — aus offenen Geländedaten
datum: 2026-10-08
---

## Problem/Nutzen

wegfara rechnet seit req-059 echte Wege, aber auf einer flachen Erde. Die
Schnittstelle in `lib/routing/` kennt Distanz, Dauer und Straßenverlauf
(`Fahrstrecke`, `Wegabschnitt`, `verlauf()`) — nirgendwo im Repo steht
eine Höhe; die einzigen Treffer für „Steigung" sind Demo-Daten. Für die
Profile `fuss` und `rad` liefert OSRM eine Fahrzeit aus einer konstanten
Gehgeschwindigkeit: 12 km zu Fuß sind dort immer dieselben rund zweieinhalb
Stunden, ob über die Promenade oder 900 Meter hinauf auf den Pass.

Das ist genau der Fall, in dem die Zahl nicht ungenau, sondern **falsch**
ist. Bei 900 Höhenmetern Aufstieg dauert derselbe Weg nach der
gebräuchlichen Wanderzeit-Regel (300 Höhenmeter Aufstieg bzw. 500 Meter
Abstieg je Stunde, mit der horizontalen Zeit verrechnet) etwa fünf
Stunden — doppelt so lang. Alles, was wegfara daraus ableitet, erbt den
Fehler:

- Der **Zeitpuffer** am Transfer (req-073) steht grün auf `+40 Min`,
  obwohl real zwei Stunden fehlen. Die eine Anzeige, die beim Planen
  Vertrauen schaffen soll, ist dort am zuversichtlichsten, wo es am
  gefährlichsten wird.
- Die **KI** (req-056) legt Programmpunkte auf eine Kette aus
  Fuß-Transfers, deren Dauer sie der App glaubt. Sie kann die Steigung
  nicht kennen — es gibt sie in den Daten nicht (Qualität der
  KI-Vorschläge).
- Der Weg zurück fällt in die Dämmerung, und zwar unbemerkt: nicht die
  Dauer verschiebt sich, sondern die Annahme darunter (siehe die offene
  Idee [tageslicht-reicht-bis.md](tageslicht-reicht-bis.md) — beide
  Rechnungen stützen sich auf dieselbe falsche Fahrzeit).

Dazu kommt eine Frage, die heute gar nicht gestellt werden kann und in
einer Gruppe aus Familie und Freunden (Vision, Audience) jede Planung
entscheidet: **Schaffen das alle?** 12 km flach gehen Großeltern,
Kleinkind und Kinderwagen mit; 900 Höhenmeter nicht. Zwei Zahlen am
Transfer — „↑ 620 m ↓ 180 m" — beantworten das vor der Reise statt auf
halber Strecke, und sie kosten keinen einzigen zusätzlichen Handgriff:
der Straßenverlauf, an dem sie gemessen werden, wird für die Tageskarte
ohnehin schon abgerufen.

Die Quelle gibt es als offene Daten, und sie ist eine andere als alle
bisher vorgeschlagenen (Ideen-Richtung, Datenquellen):

- **Open-Meteo Elevation API** (`/v1/elevation`) auf dem **Copernicus DEM
  GLO-90** — 90-Meter-Raster, weltweit, bis zu 100 Koordinaten je Anfrage,
  ohne Zugangsschlüssel. Dieselbe Hausnummer wie der Wetterabruf
  (`lib/weather/open-meteo-client.ts`), freies Kontingent im Bereich
  10.000 Abrufen am Tag.
- **Lizenz und Speichern:** Die Copernicus-DEM-Daten stehen unter einer
  freien Lizenz mit Namensnennung, Open-Meteo gibt seine APIs unter
  CC BY 4.0 weiter. Das dauerhafte Speichern ist damit erlaubt —
  entscheidend, weil ein Reiseplan gespeicherter Inhalt ist und eine
  Quelle, die das untersagt (Google Places darf nur als `place_id`
  liegen), für wegfara unbrauchbar wäre. Gespeichert werden ohnehin nur
  zwei abgeleitete Summen je Transfer, kein Kartenmaterial. Die
  Namensnennung gehört zu den Quellenangaben, wo Nominatim und OSRM schon
  stehen.
- **Selbst gehostet als Ausweg:** `open-topo-data` ist Open Source und
  liest dieselben freien Höhenmodelle. Damit gilt hier dasselbe Muster wie
  bei OSRM (stack.md): eine austauschbare Schnittstelle, die Adresse an
  genau einer Stelle, später auf dem Beelink — im Zweifel selbst gehostet
  statt fremder Dienst (Vision).

Die Abgrenzung zu den vorhandenen Ideen: [Wegzeiten aus offenem
Routing](wegzeiten-aus-offenem-routing.md) ist mit req-059 umgesetzt und
beschafft den Weg; diese Idee beschafft die **dritte Dimension** desselben
Weges und korrigiert damit eine Zahl, die req-059 ausdrücklich flach
liefert. [Fahrpläne](fahrplaene-fuer-bus-bahn-und-faehre.md) betrifft die
vier Verkehrsmittel **ohne** Vorschlag; hier geht es um die zwei, deren
Vorschlag systematisch zu optimistisch ist.

## Skizze

**Woher die Höhen kommen.** Eine neue austauschbare Schnittstelle
`lib/gelaende/` nach dem Vorbild von `lib/routing/`: ein
`GelaendeClient.hoehenprofil(wegpunkte)` gibt je Punkt die Höhe in Metern
oder `null` zurück, die Adresse des Dienstes steht an einer Stelle und ist
über `GELAENDE_BASE_URL` übersteuerbar. Eingabe ist der Verlauf, den
`verlauf()` für die Tageskarte schon liefert — auf höchstens 100
gleichmäßig verteilte Punkte ausgedünnt, damit eine Anfrage reicht.

**Wie daraus zwei Zahlen werden.** Aufstieg ist die Summe der positiven,
Abstieg die der negativen Höhenunterschiede entlang der Punktfolge. Weil
ein 90-Meter-Raster rauscht und über Brücken und Tunnel hinwegliest, wird
vorher geglättet und erst ab einem Schwellwert (Größenordnung 10 Meter je
Schritt) gezählt — sonst sammelt eine flache Küstenstraße scheinbare
Höhenmeter. Ergebnis: `ascent_m` und `descent_m`, gerundet auf 10 Meter.

**Wo es steht.** Am Transfer-Formular eine Zeile unter der
Wegbeschreibung, nicht darüber:

> ↑ 620 m ↓ 180 m — zu Fuß etwa 4 h 10 statt 2 h 30

Kein Diagramm, kein Höhenprofil-Chart: eine Zeile, zwei Zahlen, ein Satz
(wenige Schritte statt viele Optionen). Der korrigierte Wert ist ein
**Vorschlag** für `duration_min` wie bisher — wegfara ändert einen
bestehenden Transfer nie ohne Bestätigung (Vision), und ein von Hand
eingetragener Wert bleibt stehen.

**Wofür die Zahl gilt.** Nur `fuss` und `rad`: beim Auto steckt die
Steigung bereits in der OSRM-Fahrzeit, beim Bus erst recht. Die Korrektur
folgt der Wanderzeit-Regel für `fuss` (Höhenmeter-Zeit und
Horizontal-Zeit, die kleinere halb gewichtet) und einem einfacheren
Zuschlag für `rad`. Angezeigt wird die Zeile nur, wenn die Höhenmeter die
Zeit messbar verändern — unter etwa 100 Metern Aufstieg bleibt es still,
statt jeden Stadtbummel zu kommentieren.

**Gespeichert, damit es unterwegs da ist.** `ascent_m` und `descent_m` am
`transfer` (nullbar) statt bei jedem Aufruf neu zu rechnen — dann steht die
Zeile auch im Begleiter am Transfer-Block und wäre in einem späteren
Tagespaket ([tagespaket-offline-im-begleiter.md](tagespaket-offline-im-begleiter.md))
ohne Netz verfügbar. Fällt der Dienst aus, bleiben die Felder leer und
alles verhält sich wie heute — kein Fehler auf der Karte, kein blockiertes
Formular (wie der Routing-Ausfall in req-059).

**Was dazu passt, aber nicht dazugehört.** Ein zeichnerisches Höhenprofil,
Höhenmeter über einen ganzen Reisetag summiert, Wegbeschaffenheit
(`surface`, `sac_scale`) und eine echte Barrierefreiheits-Angabe. Letztere
ist eine eigene Idee mit eigener Quelle — hier wird nur die Frage „schaffen
das alle?" so weit beantwortet, wie zwei Zahlen es können.
