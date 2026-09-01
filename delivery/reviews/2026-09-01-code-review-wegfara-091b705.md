---
type: code-review
repo: Wegfara
commit: 091b705
date: 2026-09-01
---

# Code-Review: Wegfara (091b705)

Automatisch erstellt vom appbaua-Worker am 2026-09-01.

---
type: code-review
repo: Wegfara
commit: 091b705
date: 2026-09-01
---

# Code-Review: Wegfara (091b705)

Automatisch erstellt vom appbaua-Worker am 2026-09-01. Vorgänger:
[2026-08-25 (782c4a4)](2026-08-25-code-review-wegfara-782c4a4.md).

## Kurz-Zusammenfassung

Das automatisierte Quality-Gate ist vollständig grün: `npx tsc --noEmit` fehlerfrei, `npm run lint` fehlerfrei, **747 Tests in 87 Dateien** bestanden (34 s). Unverändert gegenüber der letzten Review — was daran liegt, dass sich am Code nichts geändert hat.

`git diff --stat 782c4a4..HEAD` liefert drei Dateien, alle drei Markdown, alle drei neu angelegt: die Review vom 25.08., den Security-Bericht vom 26.08. und die Idee `tagespaket-offline-im-begleiter.md`. **Keine einzige Quelldatei wurde angefasst.** Damit stehen alle 19 Code-Befunde der letzten beiden Reviews (6 neue vom 25.08., 13 fortgeschriebene vom 18.08.) und alle 8 Befunde des Security-Berichts unverändert — das muss ich nicht einzeln nachprüfen, der Diff beweist es. Die Liste steht unten, gekürzt.

Der Wert dieser Review liegt deshalb nicht im Nachverfolgen, sondern in frischer Analyse an Stellen, die die bisherigen Durchgänge weniger beleuchtet haben: die Planungskarte, die ausgehenden Netzaufrufe und die Nummernvergabe der POIs.

Der schwerwiegendste neue Befund ist ein **Nachzügler von bug-013**: `app/plan/components/day-route-map.tsx` erzeugt eine Karte und legt eine GeoJSON-Quelle an, ruft aber als einzige der drei Kartenkomponenten **nicht** `ensureMapWorkerUrl()` auf. Dass die gepunktete Tagesroute heute trotzdem sichtbar ist, ist kein Verdienst des Codes, sondern eine Nebenwirkung der Mount-Reihenfolge: der Planer startet immer im Bereich „POIs", dessen `PoiMap` die Worker-Adresse global festnagelt, bevor die Planungskarte an die Reihe kommt. Ich habe beide Fälle mit einem Wegwerf-Test gegeneinandergestellt und den Unterschied gemessen.

Daneben: kein einziger ausgehender Netzaufruf hat ein anwendungsseitiges Zeitlimit, die POI-Nummernvergabe ist ein Read-then-Write gegen einen Unique-Constraint ohne Transaktion, und das Wetter ist der einzige externe Dienst, der aus dem Browser des Nutzers geholt wird — gegen die Begründung, die im selben Repo für Nominatim ausdrücklich festgehalten ist.

## Neue Befunde

### N1. Die Planungskarte meldet die Worker-Adresse nicht — bug-013 liegt dort unentschärft (hoch)

`lib/map/worker-url.ts` ist die Lehre aus bug-013. Der Kommentar dort ist unmissverständlich:

> *"Muss vor der ersten Karte laufen: die Bibliothek legt ihren Worker-Pool einmalig beim Erzeugen der ersten Karte an und liest die Adresse nur dabei. Ohne diesen Aufruf errechnet sie die Adresse selbst aus `import.meta.url` — im gebuendelten Code von Next zeigt das Ergebnis ins Leere, der Worker startet nie und GeoJSON-Quellen werden nie verarbeitet: Linien und Flaechen bleiben unsichtbar, ohne Konsolenfehler."*

Drei Komponenten erzeugen eine MapLibre-Karte. Zwei rufen `ensureMapWorkerUrl()`:

| Komponente | GeoJSON-Quelle | `ensureMapWorkerUrl()` |
|---|---|---|
| `app/go/components/map-view.tsx:184` | `transfer-lines` | ✅ |
| `app/plan/components/poi-map.tsx:409` | `search-area`, `search-area-draft`, … | ✅ |
| `app/plan/components/day-route-map.tsx` | `day-route-lines` (`:105`) | ❌ **fehlt** |

`day-route-map.tsx:148-153` erzeugt die Karte, `:105` legt die Quelle an, `:107-119` die zugehörige Ebene `day-route-line` mit `line-dasharray: [1, 2]` — die gepunktete Verbindung zwischen den Wegpunkten des Tages (req-011). Genau die Art von Ebene, die bug-013 lautlos verschwinden ließ. Ein Import von `@/lib/map/worker-url` existiert in der Datei nicht.

**Empirisch bestätigt.** Ich habe eine Wegwerf-Testdatei angelegt, die beide Reihenfolgen im selben Modulzustand durchspielt (danach wieder entfernt, `git status` ist sauber):

```
A (nur Planung)  | workerUrl=""                                | gesetzt=4 | verarbeitet=0
B (POIs zuerst)  | workerUrl="/maplibre/maplibre-gl-worker.mjs" | gesetzt=4 | verarbeitet=4
```

Vier Linien-Features werden in die Quelle geschrieben. Ohne vorher gemeldete Worker-Adresse verarbeitet die Kartenbibliothek **null** davon — der exakte Zustand aus bug-013: Daten liegen in der Quelle, `querySourceFeatures()` liefert nichts, die Ebene zeichnet nichts, keine Konsolenmeldung.

**Warum es heute trotzdem funktioniert — und warum das kein Trost ist.** `ensureMapWorkerUrl()` setzt ein modulweites `pinned` und ruft `setWorkerUrl` global auf der Bibliothek. `plan-view.tsx:68` startet mit `ACTIVE_PLAN_AREA` = `"pois"` (`lib/plan/areas.ts:25`), also mountet bei jedem Seitenaufruf zuerst `PoisView` mit ihrer `PoiMap`, und die nagelt die Adresse fest. Die Planungskarte erbt das Ergebnis. Die Korrektheit der Planungskarte hängt damit an einer Eigenschaft einer **anderen Komponente in einem anderen Bereich**, die nirgends festgeschrieben ist.

**Konkretes Szenario, das das kippt:** Jede der folgenden, für sich völlig harmlosen Änderungen bringt bug-013 in der Planungskarte zurück — ohne dass ein Test etwas merkt:

- Die Planer-Bereiche bekommen eigene URLs (`/plan/planung`), damit man einen Tagesplan verlinken kann. Wer diese Adresse direkt öffnet, sieht die Wegpunkte, aber keine Linien dazwischen.
- `ACTIVE_PLAN_AREA` wird auf `"planung"` gestellt.
- `PoisView` wird lazy geladen, um den Planer schneller zu starten.

Und der Fehlausgang ist derselbe, den bug-013 so teuer gemacht hat: er ist stumm. Nichts bricht, nichts loggt, die Karte ist da, die nummerierten Marker sind da — nur die Verbindungslinie fehlt, und niemand weiß, ob sie fehlen soll.

**Warum die Testsuite es nicht sieht.** Es gibt keine `day-route-map.test.tsx`. Die Planungskarte wird ausschließlich über `plan-view.test.tsx` erreicht, und deren Helfer `openPlanung()` (`:717-730`) rendert `PlanView` und **klickt dann** auf „Planung" — mountet also erst die POI-Karte. Der eine Test, der die Karte prüft (`:814`, *„zeigt auf der Karte fuenf nummerierte Wegpunkte…"*), zählt Marker — und Marker sind DOM-Knoten im Hauptthread, die ohne Worker genauso erscheinen. Die Linien werden nirgends geprüft. Das Werkzeug dafür liegt fertig da: `map-view.test.tsx:441` macht es für den Begleiter genau richtig (`expect(lastMap().querySourceFeatures("transfer-lines")).toHaveLength(1)`).

**Empfehlung:**

1. `ensureMapWorkerUrl()` in `day-route-map.tsx` unmittelbar vor `new MapLibreMap(...)` (`:148`) aufrufen, wie in den beiden Schwestern.
2. Die Lücke schließen, nicht nur den Fall: eine Zusicherung nach dem Muster von `map-view.test.tsx:441` für `day-route-lines` — in einer eigenen Testdatei, damit sie ohne vorher gemountete POI-Karte läuft. Vitest isoliert je Datei, das genügt.
3. Dauerhaft absichern wie beim Anmelde-Guard: `app/api/api-guard.test.ts` prüft per Dateisuche, dass jeder Route-Handler `currentSession(` enthält. Dasselbe Muster für Karten — „jede Datei, die `new MapLibreMap(` enthält, enthält auch `ensureMapWorkerUrl(`" — ist zehn Zeilen und fängt die vierte Karte ab, bevor sie geschrieben ist. Bei drei Vorkommen mit einem Ausreißer ist das die passende Antwort.

### N2. Kein einziger ausgehender Netzaufruf hat ein Zeitlimit (mittel-hoch)

Ein Grep nach `AbortSignal`, `AbortController` und `timeout` über `app/`, `lib/` und `components/` (ohne Tests) liefert **genau einen** Treffer: `lib/osm/overpass-client.ts:37`, und das ist `[out:json][timeout:25]` — eine Angabe *innerhalb der Overpass-Abfragesprache*, also ein Ausführungslimit auf deren Server. Es begrenzt, wie lange Overpass rechnet, nicht wie lange wegfara wartet. Die Verwechslung liegt nahe genug, dass sie hier ausdrücklich erwähnt gehört.

Ohne Zeitlimit sind:

| Aufruf | Datei |
|---|---|
| Nominatim (Ortssuche) | `lib/osm/place-search.ts:78` |
| Nominatim (Reverse-Geocoding) | `lib/osm/reverse-geocode.ts:19` |
| Overpass | `lib/osm/overpass-client.ts:88` |
| Open-Meteo | `lib/weather/open-meteo-client.ts:19` |
| OpenAI | `lib/ai/openai-client.ts:26` (`maxRetries: 0`, aber keine `timeout`-Option — das SDK wartet per Vorgabe zehn Minuten) |
| die eigenen Schnittstellen aus dem Browser | `run-ai-search.ts:21`, `save-status.ts:14`, `save-search-area.ts:13,26`, `save-trip.ts:12,53`, `konto-view.tsx`, `anmelde-view.tsx` |

Serverseitig greift immerhin irgendwann Node selbst (undici, `headersTimeout`/`bodyTimeout`, je 300 s). Im Browser gibt es **gar kein** Limit: ein `fetch` ohne `signal` wartet, bis die Verbindung von der Gegenseite oder vom Betriebssystem beendet wird.

Am deutlichsten wird das an der KI-Suche, weil sich dort mehrere Wartezeiten hintereinanderlegen — und zwar in einer Schleife, deren Länge der Nutzer versehentlich bestimmt. `lib/pois/ai-search.ts:161-183` fragt Overpass **nacheinander, einen Namen nach dem anderen** ab. Die Anzahl kommt aus `extractRequestedCount` (`:54-59`), und das nimmt die erste beliebige Zahl im Wunschtext (Befund 12 der Review vom 18.08. — hier zeigt sich, was daran mehr als ein Schönheitsfehler ist):

**Konkretes Szenario:** Der Nutzer tippt „Kirchen aus dem 18. Jahrhundert". `extractRequestedCount` liest daraus **18**. Die KI liefert 18 Namen, und `searchPoisWithAi` schlägt sie einzeln nacheinander bei Overpass nach. Die öffentliche Overpass-Instanz gewährt zwei gleichzeitige Plätze je Adresse und lässt Anfragen davor warten; jede einzelne darf laut Abfrage bis zu 25 Sekunden rechnen. Der Aufruf kann damit viele Minuten laufen. In dieser Zeit:

- hält der Request-Handler einen Platz im Node-Prozess — auf einem Beelink mit genau einer Instanz je Umgebung,
- steht im Browser „Sucht…" (`ai-poi-search.tsx:67`), ohne Fortschritt und ohne Abbrechen-Möglichkeit,
- und ist die OpenAI-Anfrage längst bezahlt.

Bricht der Nutzer per Neuladen ab, läuft der Server weiter und schreibt die POIs trotzdem an — er erfährt nur nichts davon.

**Empfehlung:** Drei kleine, unabhängige Schritte.

1. Ein gemeinsames Limit für die drei OSM-/Wetter-Clients: `fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) })`. Die `try`/`catch`-Blöcke stehen bereits alle da und liefern schon heute `null` bzw. `[]` — der Abbruch fällt also ohne weitere Änderung in den vorgesehenen Fehlerpfad. Sinnvoll wären etwa 5 s für Nominatim und Open-Meteo, 30 s für Overpass (etwas über dessen eigene 25).
2. `new OpenAI({ ..., timeout: 30_000 })` ergänzen — eine Zeile, und der Wert gehört neben `DEFAULT_MODEL` in `lib/ai/openai-client.ts`, wo die anderen Modell-Entscheidungen liegen.
3. Die Overpass-Schleife begrenzen: `maxCount` gegen eine Obergrenze deckeln (`Math.min(extractRequestedCount(wish) ?? 10, 10)`). Das repariert nebenbei Befund 12 an der Stelle, wo er tatsächlich weh tut.

### N3. Die POI-Nummer wird per Read-then-Write vergeben — gegen einen Unique-Constraint, ohne Transaktion (mittel)

`lib/db/pois.ts:67-71` liest die höchste vergebene Nummer und zählt in der Anwendung hoch:

```js
const { rows } = await db.query(`select max(number) as max from poi where trip_id = $1`, [tripId]);
let nextNumber = (rows[0]?.max ?? 0) + 1;
```

Danach folgt eine Schleife einzelner `insert`s (`:74-103`), jeder in seiner eigenen impliziten Transaktion — Befund 7 der Review vom 18.08. in seiner konkretesten Ausprägung. Denn in der Datenbank steht ein Riegel: `migrations/0014_poi_number.sql` schließt mit

```sql
alter table poi add constraint poi_trip_id_number_key unique (trip_id, number);
```

Zwei überlappende Suchläufe auf derselben Reise lesen dasselbe `max`, und der zweite läuft in eine Verletzung dieses Constraints. Es gibt keinen `try`/`catch` im Route-Handler (`app/api/poi-search/route.ts:68`), der Fehler schlägt also als 500 durch. `runAiPoiSearch:30` sieht `!response.ok` und liefert `null`, `ai-poi-search.tsx:35` setzt `{ kind: "error" }`, und der Nutzer liest:

> *„Die Suche ist fehlgeschlagen. Die POI-Liste ist unverändert."*

Diese Aussage ist dann falsch. Die vor der Kollision eingefügten POIs stehen bereits in der Datenbank — ohne Transaktion wird nichts zurückgerollt. Der Nutzer bekommt die Meldung „unverändert", lädt neu, und findet eine halb gefüllte Liste vor, deren Herkunft er sich nicht erklären kann.

**Konkretes Szenario, und es braucht keine zwei Tabs.** Der Erneut-Klick ist zwar gesperrt (`ai-poi-search.tsx:30,65`: `disabled={... || running}`), aber diese Sperre lebt im Zustand `state` — und der liegt in einer Komponente, die beim Einklappen der Liste **unmountet**. Das ist Befund N4 der Review vom 25.08., hier von der anderen Seite betrachtet:

1. Der Nutzer startet die Suche. Sie läuft (siehe N2: minutenlang, ohne Fortschrittsanzeige).
2. Nach zwanzig Sekunden ohne sichtbare Reaktion klappt er die Liste weg, um auf der Karte nachzusehen, ob sein Suchgebiet stimmt (`split-view.tsx:56-64` hängt die Spalte aus dem Baum aus).
3. Er klappt wieder auf. `AiPoiSearch` mountet neu, `state` ist `{ kind: "idle" }`, das Wunschfeld ist leer, der Knopf ist **wieder aktiv**.
4. Er tippt den Wunsch neu und klickt. Zwei Suchläufe auf derselben Reise, überlappend.

Der zweite Lauf ist zu diesem Zeitpunkt noch bei OpenAI und Overpass; der erste kommt irgendwann bei `createPois` an. Wer von beiden zuerst schreibt, entscheidet der Zufall — der andere kollidiert.

**Empfehlung:** Die Nummer gehört in die Datenbank statt in die Anwendung. Ein einziges Statement je POI erledigt Lesen und Schreiben atomar:

```sql
insert into poi (id, trip_id, number, ...)
values ($1, $2, (select coalesce(max(number), 0) + 1 from poi where trip_id = $2), ...)
```

Zusätzlich — und unabhängig davon nötig — die Schleife in `createPois` in eine Transaktion fassen, damit ein Abbruch keine halbe Liste hinterlässt. Das ist derselbe Eingriff, den Befund 7 für `replaceRecoveryCodes` und `setSearchArea` verlangt; `createPois` ist der dritte Fall und der einzige, bei dem ein Constraint die Kollision garantiert auslöst statt sie nur zu ermöglichen. Und wenn `createPois` scheitert, sollte der Handler das abfangen und die bereits angelegten POIs melden, statt „unverändert" zu behaupten.

### N4. Das Wetter ist der einzige externe Dienst, der aus dem Browser geholt wird (mittel)

`app/go/go-view.tsx:1` ist `"use client"`, und `:86-97` ruft in einem Effekt `getWeatherForDay(...)` auf. Die Kette führt über `lib/weather/get-weather.ts:24` zu `lib/weather/open-meteo-client.ts:19` — ein `fetch` auf `https://api.open-meteo.com/v1/forecast`. Der läuft damit **im Gerät jedes Teilnehmers**, nicht auf dem Server.

Das Repo hat diese Frage für einen anderen Dienst bereits entschieden, und zwar ausdrücklich. `app/api/place-search/route.ts:5-9`:

> *"Die Ortssuche fuer den Hauptort einer Reise (siehe req-017). Sie laeuft **ueber den Server**, damit die Anfrage an Nominatim den geforderten User-Agent traegt und **der Browser des Nutzers nicht selbst dort auftaucht**."*

Für Open-Meteo gilt der zweite Halbsatz genauso, nur ist er dort nie gestellt worden. Übermittelt werden die IP-Adresse des Teilnehmers — unterwegs also sein grober Aufenthaltsort samt Mobilfunkanbieter — und die Koordinaten des Reiseziels, und zwar bei jedem Wechsel von Reise oder Reisetag außerhalb des 15-Minuten-Fensters. `delivery/security.md` sagt: *„An externe Dienste gehen nur die fuer die Anfrage noetigen Daten."* Die IP des Teilnehmers ist für eine Wettervorhersage am Reiseziel nicht nötig.

Drei Folgen, die zusammenhängen:

- **Der Cache schützt nicht, was der Kommentar behauptet.** `lib/weather/cache.ts:3` sagt: *„Verhindert wiederholte Abrufe bei der Wetterquelle innerhalb dieses Fensters."* Die `Map` ist modulweit — im Browser heißt das: pro Tab. Vier Teilnehmer mit je zwei Tabs sind acht unabhängige Caches; jeder Neuladen der Seite fängt bei null an. Serverseitig wäre es ein Cache für alle, und genau so liest sich der Kommentar.
- **Open-Meteo fehlt in `delivery/stack.md`.** Der Abschnitt „Languages & Frameworks" listet OpenStreetMap, OpenAI und SMTP als Außenanbindungen — die Wetterquelle kommt nicht vor. Die Test-Policy nennt namentlich *„Externe Dienste (OpenAI, Nominatim, Overpass) werden in Tests gemockt"* und lässt sie ebenfalls aus. Die Tests machen es trotzdem richtig (`tests/setup.ts:19-28` verbietet echtes `fetch` global und nennt in der Begründung sogar die Wetterquelle) — die bindende Vorgabe hinkt der Umsetzung hinterher.
- **Kein Zeitlimit, im Browser wirklich ohne Grenze** (siehe N2). Hängt Open-Meteo, bleibt die Wetteranzeige im Kopfbereich des Begleiters dauerhaft leer, ohne Hinweis.

**Empfehlung:** Den Abruf hinter eine eigene Route legen — `app/api/weather/route.ts`, mit `currentSession()`-Prüfung wie alle anderen, und `getWeatherForDay` von dort aufrufen. Der Browser fragt dann nur noch die eigene Anwendung; der Cache in `lib/weather/cache.ts` wird dadurch zu dem serverseitigen Cache, als der er beschrieben ist, und `place-search` liefert die Vorlage einschließlich Begründungskommentar. Danach `delivery/stack.md` um Open-Meteo ergänzen — sowohl bei den Außenanbindungen als auch in der Aufzählung der zu mockenden Dienste.

### N5. `OSM_STYLE` steht dreimal im Repo, zwei Kopien davon im selben Bereich (niedrig-mittel)

Dieselbe `StyleSpecification` — Version, Kachel-URL, `tileSize: 512`, Attribution, Ebene — steht wörtlich in:

- `app/go/components/map-view.tsx:23-38`
- `app/plan/components/poi-map.tsx:34-46`
- `app/plan/components/day-route-map.tsx:24-36`

Die Trennung von Planer und Begleiter aus `delivery/stack.md` erklärt höchstens die erste Teilung. Sie erklärt **nicht**, warum `poi-map.tsx` und `day-route-map.tsx` — beide unter `app/plan/components/` — dieselbe Konstante zweimal führen.

Bemerkenswert ist, was beim Kopieren verloren ging. In `map-view.tsx:29-33` steht die vollständige Begründung für `tileSize: 512`:

> *„tileSize 512 statt der nativen 256px laesst MapLibre eine Zoomstufe hoeher anfragen und dadurch Beschriftungen auf Geraeten mit doppelter Pixeldichte lesbar darstellen (bug-003) — die Kachelquelle selbst liefert weiterhin nur 256px-Kacheln."*

In beiden Kopien ist daraus ein Verweis geworden: *„tileSize 512 statt der nativen 256px (siehe app/go/components/map-view.tsx, bug-003)."* Ein Verweis quer über die Bereichsgrenze, die `stack.md` gerade dicht halten will — und die einzige Stelle, an der noch steht, *warum* 512.

`lib/map/` existiert bereits und ist der richtige Ort: es enthält heute `worker-assets.ts` und `day-map.ts`, beides UI-freie Kartenlogik, und `stack.md` sagt *„Geteilte Logik gehört nach `lib/`"*. Eine Style-Spezifikation ist Daten, keine Komponente.

**Empfehlung:** `OSM_STYLE` samt der ausführlichen Begründung nach `lib/map/osm-style.ts` ziehen und aus allen drei Komponenten importieren. Das ist genau die Disziplin, die `lib/map/worker-assets.ts` für Verzeichnis, Dateiname und URL des Workers schon vorbildlich durchhält: eine Quelle, ein Kommentar, drei Verwender. Zusammen mit N1 wird daraus ein Aufräumen: `lib/map/` wird der Ort, an dem *jede* Karte ihre gemeinsamen Voraussetzungen holt — Stil und Worker-Adresse — statt dass jede Komponente sich einzeln daran erinnern muss.

### N6. Kleinigkeiten (niedrig)

- **`CLAUDE.md:1` heißt weiterhin `# <Projektname>`**, und darunter steht unverändert der Einrichtungshinweis der appbaua-Umstellung: *„Sie ist ein Startpunkt — passe sie an und ersetze die Platzhalter."* Die Datei ist die oberste bindende Anweisung des Repos und die einzige, die noch ihren Platzhalter trägt — `vision.md`, `stack.md`, `security.md` und `devops.md` sind alle ausgefüllt. Ein Wort: `# wegfara`.
- **`delivery/stack.md` trägt einen erledigten TODO.** Am Ende von „Commands" steht: *„`<TODO: Die Kommandos sind Template-Defaults — beim Anlegen der package.json prüfen und hier korrigieren, falls sie abweichen.>`"* Die `package.json` existiert seit langem, und die sechs genannten Kommandos stimmen. Nicht genannt sind `npm run migrate` (das Migrationswerkzeug, das im Container vor dem App-Start läuft) und `npm run types` (dasselbe wie `npx tsc --noEmit`, nur kürzer). Den TODO streichen, `migrate` aufnehmen.
- **`lib/auth/tokens.ts:20` `secretsMatch` wird außerhalb seines eigenen Tests nirgends aufgerufen.** Der Kommentar verspricht *„Vergleicht zwei Pruefsummen ohne verwertbare Laufzeitunterschiede"* — ein Schutz, der nie angewandt wird, weil alle Prüfsummen-Vergleiche in der SQL-Bedingung stattfinden (`sessions.ts:64`, `recovery-codes.ts:67`). Das ist richtig so und im Ergebnis auch unbedenklich. Aber eine ungenutzte Funktion, die eine Sicherheitszusage im Namen führt, liest sich beim nächsten Durchsehen wie eine erfüllte Anforderung. Entweder entfernen oder den Kommentar um einen Satz ergänzen, dass der Vergleich bewusst in der Datenbank stattfindet.
- **Nicht-UUIDs auf den Schreib-Endpunkten ergeben eine 500 statt einer 400.** `poi-status/route.ts:18` prüft `!poiId`, `search-area/route.ts:28` prüft `!tripId` — auf Wohlgeformtheit prüft keiner. Ein `poiId: "abc"` erreicht `update poi set status = $2 where id = $1`, Postgres verweigert die Umwandlung nach `uuid`, der Fehler schlägt ungefangen als 500 durch. Wenn diese Routen ohnehin um die Mandantenprüfung erweitert werden (Befund 1, siehe unten), lässt sich die Formatprüfung im selben Zug erledigen.
- **`app/api/api-guard.test.ts:53` prüft per Textsuche `expect(source).toContain("currentSession(")`.** Das ist eine gute, billige Absicherung gegen die vergessene Anmeldeprüfung, und sie hat ihren Zweck erfüllt. Sie sagt aber nichts darüber, ob mit der Sitzung anschließend etwas geschieht — und genau darin besteht Befund 1: drei Routen rufen `currentSession()` auf und benutzen `session.participant.accountId` nie. Der Test ist grün und die Lücke offen. Eine zweite Erwartung („enthält `accountId`") wäre nach demselben Muster gebaut und würde die drei Fälle sofort sichtbar machen. Dieselbe Bauart empfehle ich in N1 für die Kartenkomponenten.

## Unverändert offen

Seit 782c4a4 wurde **keine Quelldatei geändert** (`git diff --stat 782c4a4..HEAD`: drei neue Markdown-Dateien, sonst nichts). Alle Befunde der beiden Vorgänger-Reviews stehen damit wörtlich; ich verweise auf sie, statt sie zu wiederholen.

**Aus der Review vom [2026-08-25](2026-08-25-code-review-wegfara-782c4a4.md):**

| # | Befund |
|---|---|
| N1 | Trefferflächen der Eckpunkt-Griffe von 44 auf 22 Pixel geschrumpft — der Fix von bug-011 nimmt den Fix von bug-009 zurück (hoch) |
| N2 | Jede Zustandsänderung im Planer setzt den Kartenausschnitt zurück (mittel) |
| N3 | Zwölf Code-Kommentare verweisen auf bug-010/011/012, die es im Repo nicht gibt (mittel) |
| N4 | Das Einklappen der Liste wirft den Zustand der KI-Suche weg (niedrig-mittel) — **siehe N3 dieser Review: das ist inzwischen mehr als ein Komfortproblem** |
| N5 | Kein `.dockerignore` (niedrig) |
| N6 | Zahlendreher in `datenbank.md`; ungenutztes `resetWorkerUrl` im Test-Double (niedrig) |

**Aus der Review vom [2026-08-18](2026-08-18-code-review-wegfara-a1df1f1.md)** — alle dreizehn: Mandantenprüfung auf drei Schreib-Endpunkten (1, hoch), Schreib-Debounce aus `stack.md` existiert nirgends (2, hoch — **fünfte Review in Folge**), Client-Schreibhelfer ignorieren HTTP-Fehler (3, hoch), Anmeldelink per GET (4), Transfer-Linien ignorieren die Alternative (5), Rate-Limiter O(n) je Anfrage (6), mehrschrittige Schreibvorgänge ohne Transaktion (7 — **N3 dieser Review ist der dritte Fall**), Demo-Daten in den Schema-Migrationen (8), Secure-Flag am `x-forwarded-proto` (9), Notfallcodes im Klartext-Cookie (10), Overpass bricht bei `"` im Ortsnamen (11), `extractRequestedCount` nimmt die erste Zahl (12 — **N2 dieser Review zeigt die Folgen**), Backup-Funktion fehlt (13).

**Aus dem Security-Bericht vom [2026-08-26](../security/2026-08-26-security-wegfara-40a680b.md):** alle acht, darunter der hoch eingestufte Transport-Befund (Anwendung über HTTP erreichbar, Sitzungs-Cookie dann ohne `Secure`) und das fehlende Backup.

Drei Befunde dieser Review sind keine neuen Themen, sondern Zuspitzungen bereits gemeldeter: N2 macht aus Befund 12 ein Betriebsproblem, N3 macht aus Befund 7 und N4/25.08. einen konkreten Datenfehler, N4 berührt die Datenschutz-Vorgabe aus `security.md`. Das ist das Muster dieser Codebasis: die einzelnen Befunde sind meist klein, aber sie verstärken einander, und je länger sie offen stehen, desto häufiger treffen sie sich.

## Was in Ordnung war

- **Quality-Gate vollständig grün:** `npx tsc --noEmit` fehlerfrei, `npm run lint` fehlerfrei, 747 Tests in 87 Dateien bestanden (33,9 s). Keine übersprungenen Tests, keine Warnungen.
- **`tests/setup.ts:16-28` verbietet echtes `fetch` global.** Jeder Test, der ein Netz braucht, muss es sich selbst stubben; wer es vergisst, bekommt eine Fehlermeldung mit Handlungsanweisung statt eines wackligen Tests. Die Begründung nennt die Wetterquelle namentlich — die Testebene hat also gesehen, was `stack.md` in seiner Dienste-Aufzählung übergeht (N4).
- **`scripts/migrate.mjs` ist sauber gebaut:** jede Migration einzeln in `begin`/`commit`, bei Fehler `rollback` und Abbruch, der Vermerk in `schema_migrations` in derselben Transaktion wie die Migration selbst. Die Migrationen sind damit die einzige Stelle im Repo, die Transaktionen richtig verwendet — Befund 7 fällt umso mehr auf.
- **`scripts/verify-standalone-bundle.mjs` prüft, was der Test nicht erreichen kann,** und begründet beide Hälften aus den Bugs heraus, die sie erzeugt haben (bug-006, bug-010, bug-013). Dass es als `postbuild` läuft und damit auch im Container-Build, ist die richtige Entscheidung. Es prüft die Worker-*Dateien* — die fehlende *Anmeldung* der Adresse aus N1 kann es naturgemäß nicht sehen; das ist keine Lücke des Skripts, sondern die Grenze seiner Ebene.
- **`lib/db/recovery-codes.ts:58-71` entwertet den Notfallcode serverseitig in der `where`-Bedingung des `update` und liest die betroffene Zeile per `returning` zurück.** Damit kann derselbe Code auch bei gleichzeitigen Versuchen nur einmal greifen — ohne Transaktion, ohne Sperre. Der Kommentar sagt genau das. Es ist die richtige Lösung an der Stelle, an der eine falsche teuer wäre.
- **`lib/db/sql-datetime.ts` löst ein subtiles Problem und erklärt es vollständig:** `timestamp without time zone` kommt vom Treiber als `Date` mit UTC-interpretierten Komponenten; lokale Getter würden die Uhrzeit um den Zonenversatz der ausführenden Umgebung verschieben. Das ist bug-004 („zeitzonenabhängige Programmpunkte") — und die Erklärung steht dort, wo man sie beim nächsten Mal sucht.
- **`lib/auth/recovery-codes.ts:12` wählt ein Alphabet aus genau 32 Zeichen ohne verwechselbare Zeichen,** und der Kommentar begründet beides: 32 teilt 256 glatt, also erzeugt `bytes[i] % 32` keine Schieflage. Nachgerechnet, stimmt.
- **`middleware.ts` ist unverändert doppelt begründet und beides trägt:** der Karten-Worker ist sowohl im `matcher` ausgenommen als auch in `PUBLIC_PREFIXES`, und der Prefix-Test ist korrekt geankert (`pathname === prefix || startsWith(prefix + "/")`) — `/maplibre-admin` würde nicht mitgefangen. `middleware.test.ts` prüft beide Seiten.
- **`lib/ai/` hält die Vorgabe aus `stack.md` exakt ein:** Der Modellname steht an genau einer Stelle (`openai-client.ts:8`), ist über `OPENAI_MODEL` übersteuerbar, und `AiClient` hat genau eine Methode. Ein Wechsel auf Ollama wäre eine neue Datei neben `openai-client.ts` und eine geänderte Zeile im Route-Handler. Die einzige Lücke ist das fehlende `timeout` (N2).
- **Alle Architekturvorgaben aus `stack.md` eingehalten:** kein SQL außerhalb von `lib/db/` (geprüft per Grep über `app/`, `components/`, `lib/` ohne `lib/db/`), keine Importe zwischen `app/plan/` und `app/go/`, KI-Zugriff nur über `lib/ai/`, Mailversand nur über `lib/mail/mailer.ts`, Domänenlogik in `lib/` ohne Next.js testbar, Secrets ausschließlich aus Umgebungsvariablen. Die Dreifach-Kopie von `OSM_STYLE` (N5) ist die einzige Stelle, an der die Struktur gegen sich selbst arbeitet.
- **`app/api/poi-search/route.ts` erzwingt den Mandanten implizit richtig:** `listSearchAreas(db, accountId)` liefert nur Gebiete des eigenen Accounts, und ohne Treffer endet die Anfrage mit 400. Eine fremde `tripId` kommt nicht durch. Das ist wirksam — aber es ist eine Nebenwirkung der Datenbeschaffung, kein Riegel. `app/api/trips/route.ts` mit `belongsToAccount()` ist die explizite Fassung desselben Gedankens und die Vorlage für Befund 1.

## Empfohlene Reihenfolge

1. **N1** (`ensureMapWorkerUrl()` in `day-route-map.tsx`, plus Zusicherung und Struktur-Test) — eine Zeile Fix, und sie nimmt einen stummen Fehler aus dem Weg, der sonst beim ersten Routing-Umbau des Planers zurückkommt. bug-013 hat die Ursachensuche schon einmal gekostet; ein zweites Mal wäre vermeidbar gewesen.
2. **N1 der Review vom 25.08.** (Trefferflächen zurück auf 44 Pixel) — unverändert der Befund mit dem direktesten Nutzerbezug: ein abgenommener Bugfix ist auf dem Zielgerät wieder aufgehoben.
3. **Befund 1** (Mandantenprüfung auf den drei Schreib-Endpunkten) — dritte Review und zweiter Security-Bericht in Folge, kleiner Eingriff, Muster liegt in `trips.ts`. Bitte gleich mit der zweiten Erwartung in `api-guard.test.ts` absichern (N6) und die Formatprüfung der IDs mitnehmen.
4. **N3** (POI-Nummer per SQL vergeben, `createPois` in eine Transaktion) — verhindert, dass die Anwendung dem Nutzer „unverändert" meldet, während sie Daten geschrieben hat. Zusammen mit N4 der Review vom 25.08. (Zustand der KI-Suche überlebt das Einklappen) ist das Szenario dann geschlossen.
5. **N2** (Zeitlimits, `maxCount` deckeln) — drei kleine, voneinander unabhängige Änderungen; die Fehlerpfade existieren bereits alle.
6. **Befund 3** (`response.ok` prüfen) — wenige Zeilen, verhindert stillen Datenverlust nach Sitzungsablauf.
7. **N4** (Wetter über eine eigene Route, `stack.md` nachziehen) und **N5** (`OSM_STYLE` nach `lib/map/`) — beides Aufräumarbeit, beides klein, und N5 gehört sachlich zu N1: `lib/map/` wird der Ort, an dem jede Karte ihre Voraussetzungen holt.
8. **Befund 2** (Schreib-Debounce) — oder die bewusste Entscheidung, die Vorgabe aus `stack.md` zu streichen. Nach fünf Reviews ohne Umsetzung ist eine dauerhaft unerfüllte bindende Vorgabe schlechter als beide Alternativen.

---

**Zur Arbeitsweise dieser Review:** Ausgeführt wurden `npx tsc --noEmit`, `npm run lint` und `npm test` am Stand 091b705. Befund N1 habe ich mit einer Wegwerf-Testdatei unter `app/plan/components/` empirisch bestätigt (beide Mount-Reihenfolgen gegeneinander, gemessen an `querySourceFeatures`); die Datei ist wieder entfernt, `git status` ist sauber. Der Nachweis, dass alle Vorbefunde offen sind, stammt aus `git diff --stat 782c4a4..HEAD` — es wurde keine Quelldatei geändert. Es wurde nichts committet oder gepusht. Kein Zugriff auf prod, keine Datenbank angefasst, kein Netzaufruf nach außen.
