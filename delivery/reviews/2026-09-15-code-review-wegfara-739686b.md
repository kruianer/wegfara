---
type: code-review
repo: Wegfara
commit: 739686b
date: 2026-09-15
---

# Code-Review: Wegfara (739686b)

Automatisch erstellt vom appbaua-Worker am 2026-09-15.

Ich habe das Quality-Gate ausgeführt, die 190 Commits seit der letzten Review durchgesehen und zwei Befunde empirisch mit Wegwerf-Tests bestätigt (beide wieder entfernt, `git status` ist sauber). Hier der Bericht:

---
type: code-review
repo: Wegfara
commit: 739686b
date: 2026-09-15
---

# Code-Review: Wegfara (739686b)

Automatisch erstellt vom appbaua-Worker am 2026-09-15. Vorgänger:
[2026-09-01 (091b705)](2026-09-01-code-review-wegfara-091b705.md).

## Kurz-Zusammenfassung

Das automatisierte Quality-Gate ist vollständig grün: `npm run types` fehlerfrei, `npm run lint` fehlerfrei, **3649 Tests in 304 Dateien** bestanden (125 s). Gegenüber der letzten Review ist das eine Vervierfachung (747 Tests in 87 Dateien) — und das ist keine Zahlenkosmetik, sondern der sichtbarste Teil einer sehr produktiven Strecke: `git rev-list --count 091b705..HEAD` liefert **190 Commits**, darunter req-056 bis req-063 und die Bugs 029 bis 045.

Die Aufräumarbeit ist dabei nicht liegengeblieben. **Fünf der offenen Befunde sind erledigt**, darunter zwei, die drei Reviews in Folge oben standen: die Mandantenprüfung auf den Schreib-Endpunkten (Befund 1 vom 18.08.) ist überall explizit, die Client-Schreibhelfer prüfen `response.ok` (Befund 3), `extractRequestedCount` ist auf 20 gedeckelt (Befund 12), das Backup existiert (Befund 13), und `withDatabaseClient` samt `begin`/`commit`/`rollback` ist für die Wiederherstellung gebaut (Teil von Befund 7). Das ist die Antwort auf die „Empfohlene Reihenfolge" der letzten Review, von unten nach oben abgearbeitet.

Der schwerwiegendste Befund dieser Review ist die Kehrseite davon: **bug-013 ist in der Planungskarte von einer Vorhersage zu einem laufenden Fehler geworden.** Die letzte Review hat drei Szenarien genannt, die ihn scharfschalten würden; das erste — „Die Planer-Bereiche bekommen eigene URLs, wer diese Adresse direkt öffnet, sieht die Wegpunkte, aber keine Linien dazwischen" — ist mit bug-033 gebaut worden. Die Bereichsleiste steht seither auf „Mein Bereich" und in der „Verwaltung" und verlinkt von dort mit `?bereich=planung` direkt in den Planer. Wer diesem Link folgt, bekommt die Tageskarte ohne ihre Linien. Ich habe beide Einstiegswege gegeneinander gemessen.

Dazu kommt: In derselben Zeit ist `tests/mocks/maplibre-gl.ts` gezielt um genau die Unterscheidung erweitert worden, die bug-013 sichtbar macht — und die neu entstandene `day-route-map.test.tsx` schaut auf die falsche Seite davon.

Die übrigen neuen Befunde betreffen eine Lücke in der automatischen Bildschirmprüfung, die unverändert fehlenden Zeitlimits an einer inzwischen deutlich gewachsenen Außenkante, und zwei Stellen, an denen die frisch gebaute Transaktionsfähigkeit nicht angewandt wird.

## Neue Befunde

### N1. bug-013 in der Planungskarte ist scharf — `?bereich=planung` führt daran vorbei (hoch)

Die letzte Review hat es als Vorhersage formuliert. Sie ist eingetreten.

**Die Kette, Glied für Glied:**

| Stelle | Was dort steht |
|---|---|
| `components/bereichsleiste.tsx:129` | `href={planAreaPath(area.id)}` — außerhalb des Planers ein echter `<Link>`, kein `onClick` |
| `lib/plan/areas.ts:76-78` | `planAreaPath("planung")` → `/plan?bereich=planung` |
| `app/plan/page.tsx:130` | `initialArea={planAreaFromParam(bereich)}` |
| `app/plan/plan-view.tsx:194-196` | `useState<PlanAreaId>(initialArea ?? ACTIVE_PLAN_AREA)` |
| `app/plan/plan-view.tsx:621-642` | Ternär-Kette: bei `"planung"` mountet `PlanungView`, `PoisView` steht im letzten `else` |
| `app/plan/components/day-route-map.tsx:173` | `new MapLibreMap({...})` — **kein `ensureMapWorkerUrl()`**, `grep -c worker-url` liefert 0 |

Die Worker-Adresse wird im Planer an genau einer Stelle gemeldet: `app/plan/components/poi-map.tsx:514`. `PoiMap` hängt in `PoisView`. Öffnet jemand den Planer über `?bereich=planung`, mountet `PoisView` nie — und die Tageskarte erbt nichts.

**Empirisch bestätigt.** Wegwerf-Testdatei unter `app/plan/`, die beide Einstiegswege im selben Modulzustand durchspielt (danach entfernt, `git status` sauber):

```
A  <PlanView initialArea="planung">        | workerUrl=""                                | karten=1
B  Planer normal, dann auf „Planung"       | workerUrl="/maplibre/maplibre-gl-worker.mjs" | karten=2
```

Und was ein leeres `workerUrl` für die Linien bedeutet, habe ich in einer zweiten Probe direkt an `DayRouteMap` gemessen:

```
DayRouteMap allein | workerUrl="" | gesetzt=1 | verarbeitet=0
```

Eine Linie liegt in der Quelle, **null** werden verarbeitet. Genau der Zustand aus bug-013: `setData()` hat geschrieben, `querySourceFeatures()` liefert nichts, die Ebene `day-route-line` mit ihrem `line-dasharray: [1, 2]` zeichnet nichts, keine Konsolenmeldung.

**Das Nutzererlebnis:** Der Reiseleiter steht in „Mein Bereich", klickt in der Bereichsleiste auf „Planung", und sieht die nummerierten Wegpunkte des Tages ohne die Verbindung dazwischen — weder die gepunktete Gerade noch den echten Straßenverlauf aus req-059, der die ganze Arbeit an OSRM sichtbar machen soll. Klickt er danach auf „POIs" und wieder auf „Planung", ist alles da. Ein Fehlerbild, das vom Weg abhängt, auf dem man hingekommen ist, und für das keine Meldung erscheint.

**Warum die Testsuite es nicht sieht — und das ist der eigentlich beunruhigende Teil.** Seit der letzten Review ist `tests/mocks/maplibre-gl.ts` um genau diese Unterscheidung erweitert worden. Der Kommentar dort (`:31-38`) ist eindeutig:

> *„maplibre-gl verarbeitet GeoJSON-Quellen NICHT im Hauptthread … Genau das war bug-013 … Ohne gemeldete Worker-Adresse bildet der Nachbau denselben Zustand ab: Daten gesetzt, aber nie verarbeitet."*

`GeoJSONSource` führt seither zwei Felder: `data` (*„Die zuletzt uebergebenen Daten — ‚gesetzt'"*) und `processed` (*„Was die Kartenbibliothek daraus gemacht hat — ‚verarbeitet'"*), getrennt durch `if (!workerUrl) return;` (`:79`). `querySourceFeatures()` (`:308`) liest bewusst nur die verarbeitete Seite, mit dem Hinweis: *„Der Unterschied zu `getSource(id).data` ist genau der Fehler aus bug-013."*

Das Werkzeug ist also gebaut. Die ebenfalls neu entstandene `app/plan/components/day-route-map.test.tsx` — fünf Tests, alle über die Linien der Tageskarte — liest in ihrem Helfer `linien()` (`:71-74`):

```js
const source = MapLibreMap.live().getSource("day-route-lines");
return (source?.data.features ?? []) as GeoJSON.Feature[];
```

`.data`. Die Seite, vor der der Kommentar im Nachbau wörtlich warnt. Die Tests rendern `DayRouteMap` isoliert, ohne vorher gemountete `PoiMap` — die Bedingung des Fehlers ist im Test also erfüllt, und die Tests sind trotzdem grün, weil sie die falsche Hälfte messen. Die Vorlage für die richtige steht zwei Verzeichnisse weiter: `app/go/components/map-view.test.tsx:470` prüft `querySourceFeatures("transfer-lines")`, und `poi-map.test.tsx:927-931` erklärt in einem Kommentar sogar, warum.

**Empfehlung:**

1. `ensureMapWorkerUrl()` in `day-route-map.tsx` unmittelbar vor `new MapLibreMap(...)` (`:173`) aufrufen, wie in den beiden Schwestern. Eine Zeile plus Import.
2. `linien()` in `day-route-map.test.tsx:71-74` auf `querySourceFeatures("day-route-lines")` umstellen. Die fünf bestehenden Tests werden damit von Fehlanzeigen zu echten Zusicherungen — und sie schlagen ohne Schritt 1 fehl, was die Reihenfolge festlegt: erst den Test umstellen, den Fehlschlag sehen, dann fixen (reproduce-first, `stack.md`, Testing).
3. Die Lücke strukturell schließen, wie in der letzten Review vorgeschlagen und bisher nicht umgesetzt: eine Zusicherung nach dem Muster von `app/api/api-guard.test.ts:53` — „jede Datei, die `new MapLibreMap(` enthält, enthält auch `ensureMapWorkerUrl(`". Zehn Zeilen, und sie fängt die vierte Karte ab, bevor sie geschrieben ist. Bei drei Vorkommen mit einem Ausreißer über drei Reviews hinweg ist das die passende Antwort.

### N2. Die automatische Bildschirmprüfung erreicht vier der sechs Planer-Bereiche nie (mittel)

`tests/e2e/fixtures.ts:72-79` ist gut gedacht und gut gebaut: die Fixture `seite` klinkt sich in `page.goto` ein und prüft jede geöffnete Seite gegen die vier Regeln aus `stack.md`, bei 375, 768 und 1280 px — *„automatisch fuer diesen und jeden kuenftigen Fluss, ohne dass er selbst daran denken muss."*

Der Haken steckt in „geöffnete Seite". Ein `grep` über alle vier Flüsse liefert die vollständige Liste der Adressen, die je geprüft werden:

```
tests/e2e/anmelden.e2e.ts:48      /einladung/passkey
tests/e2e/anmelden.e2e.ts:64      /plan
tests/e2e/poi-anlegen.e2e.ts:25   /plan
tests/e2e/poi-verplanen.e2e.ts:34 /plan
tests/e2e/reise-anlegen.e2e.ts:30 /plan
```

Alle vier landen auf `/plan` ohne Parameter, und `ACTIVE_PLAN_AREA` ist `"pois"` (`lib/plan/areas.ts:43`). Die Bereiche werden danach per `setActiveArea` im Zustand umgeschaltet — ohne Navigation, also ohne `page.goto`, also ohne Prüfung. Geprüft wird dauerhaft nur der POI-Bereich.

Nicht geprüft werden damit **Planung, Bewertungen, Kosten, Dokumente und Reisedetails** — darunter die beiden neuesten und größten Oberflächen dieser Strecke: `kosten-view.tsx` mit 637 Zeilen und einer mehrspaltigen Tabelle mit Eingabefeldern, und `bewertungen-view.tsx` mit 322 Zeilen und aufklappbaren Zeilen.

Auf der Unit-Ebene ist die Abdeckung ungleich: `bewertungen-view.layout.test.ts` existiert, `kosten-view` hat keinen Layout-Test. Aber selbst mit beiden bleibt die E2E-Ebene die einzige, die die Regeln am echten Rendering misst statt am CSS-Text — genau die Naht, für die req-049 gebaut wurde.

**Warum das gerade jetzt zählt:** Die Bugs 029, 039, 040, 041, 042, 043 und 044 sind allesamt Layout-Bugs im Planer, sechs davon allein in der POI-Karte und ihrer Filterzeile — also in dem einen Bereich, den die Prüfung erreicht. Das ist kein Zufall: dort wird gemessen, dort fällt auf. Was in den anderen fünf Bereichen bei 375 und 768 px passiert, weiß derzeit niemand automatisiert.

**Empfehlung:** Die Lücke ist praktisch geschlossen, bevor man sie ausspricht — `planAreaPath()` (`lib/plan/areas.ts:76`) liefert für jeden Bereich eine echte Adresse, und die Fixture prüft jede Adresse selbsttätig. Ein Fluss reicht:

```ts
for (const area of SWITCHABLE_PLAN_AREAS) {
  await seite.goto(planAreaPath(area));   // prueft sich selbst (fixtures.ts:72)
}
```

Sechs Zeilen, sechs Seiten × drei Breiten × vier Regeln. Als eigener kleiner Fluss neben den vier bestehenden, nicht in einen davon hineingeflochten — er prüft etwas anderes als sie. Und er schlägt zwei Fliegen: er ist zugleich der Fluss, in dem N1 an der echten Anwendung auffliegen würde, weil er `?bereich=planung` direkt öffnet.

### N3. Kein einziger ausgehender Netzaufruf hat ein Zeitlimit — bei deutlich gewachsener Außenkante (mittel-hoch)

Zweite Review in Folge, und der Befund ist seither größer geworden, nicht kleiner. Ein `grep` nach `signal` und `AbortSignal.timeout` über `lib/google`, `lib/osm`, `lib/weather`, `lib/routing` und `lib/ai` (ohne Tests) liefert **keinen einzigen Treffer**.

Overpass ist seit req-057 draußen — und durch mehr ersetzt, als es war:

| Dienst | Aufrufstelle | Zeitlimit |
|---|---|---|
| Google Places (Textsuche) | `lib/google/places-client.ts:200` | ❌ |
| Google Places (Foto-Umleitung) | `places-client.ts:230` | ❌ |
| Google Places (Details) | `places-client.ts:297`, `:322` | ❌ |
| OSRM, drei Profile | `lib/routing/osrm-client.ts:75` | ❌ |
| Nominatim (Ortssuche) | `lib/osm/place-search.ts:146` | ❌ |
| Nominatim (Rückwärtssuche) | `lib/osm/reverse-geocode.ts:19` | ❌ |
| Nominatim (Ort-Lookup) | `lib/osm/ort-lookup.ts:22` | ❌ |
| Open-Meteo | `lib/weather/open-meteo-client.ts:19` | ❌ |
| EZB-Wechselkurse | `lib/expenses/exchange-rate.ts:29` | ❌ |
| OpenAI | `lib/ai/openai-client.ts:84` | ❌ (`maxRetries: 0`, aber keine `timeout`-Option — Vorgabe des SDK: zehn Minuten) |

**Die KI-Suche ist unverändert der Ort, an dem sich das summiert — nur mit anderen Diensten.** Der Deckel aus der letzten Review ist da (`lib/pois/ai-search.ts:253-256`, `MAX_SUGGESTIONS = 20`), und er wirkt. Was er nicht ändert, ist die Form: `app/api/poi-search/route.ts` macht in **einem** Request-Handler nacheinander

1. eine Nominatim-Rückwärtssuche (`:114`),
2. eine OpenAI-Anfrage (`:115`),
3. **bis zu 20 Google-Places-Textsuchen, streng sequenziell** — `ai-search.ts:284` ruft `await deps.lookupPlace(...)` in einer `for`-Schleife über die Vorschläge,
4. `createPois` (`:135`),
5. **bis zu 20 Google-Foto-Abrufe, ebenfalls sequenziell** — `:149-155`, je einer pro angelegtem POI.

Bis zu 42 aufeinanderfolgende Netzaufrufe, keiner mit einer Obergrenze für die Wartezeit. Serverseitig fängt irgendwann undici (300 s je Antwort — bei 42 Aufrufen also nicht die Grenze, die man sich wünscht); die Browserseite (`lib/pois/run-ai-search.ts`) wartet ohne jede Grenze.

**Konkretes Szenario:** Google Places antwortet auf den zwölften Namen nicht. Der Handler hängt. Der Nutzer sieht „Sucht…", ohne Fortschritt. Die POIs sind zu diesem Zeitpunkt noch nicht angelegt (Schritt 4 kommt später) — aber die OpenAI-Anfrage ist bezahlt, und auf dem Beelink mit genau einer Instanz je Umgebung hält die Anfrage einen Platz. Hängt dagegen der *achtzehnte Foto-Abruf*, sind die POIs längst geschrieben, und der Nutzer erfährt es nicht.

**Empfehlung:** Unverändert drei kleine, voneinander unabhängige Schritte — die Fehlerpfade existieren alle schon und liefern `null` bzw. `[]`, ein Abbruch fällt also ohne weitere Änderung hinein.

1. Ein gemeinsames Limit für die HTTP-Clients: `fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) })`. 5 s für Nominatim, Open-Meteo und die EZB, 10 s für Google Places und OSRM.
2. `new OpenAI({ ..., timeout: 30_000 })` — eine Zeile, und der Wert gehört neben `DEFAULT_MODEL` in `lib/ai/openai-client.ts`, wo die anderen Modell-Entscheidungen stehen.
3. Die 20 Google-Nachschläge und die 20 Foto-Abrufe nebenläufig statt nacheinander (`Promise.all` über Gruppen von etwa fünf). Das bringt die Wartezeit des Nutzers von „Summe" auf „Maximum" und ist unabhängig von 1 und 2 richtig.

### N4. Die Wiederherstellung leert die Bildablage nach dem `commit` — ohne Weg zurück (mittel)

`lib/backup/database.ts` macht es genau richtig: `restoreDatabase` öffnet mit `begin` (`:179`), leert und füllt die Tabellen, schließt mit `commit` (`:221`) und fängt jeden Fehler mit `rollback` ab (`:223`). Das ist die saubere Hälfte.

`lib/backup/store.ts:316-322` setzt danach fort:

```js
await restoreDatabase(client, dump);          // <- committet hier

await emptyDirectory(imageDir);               // <- rm -rf, unwiderruflich
const images = path.join(dir, IMAGES_DIR);
if (await exists(images)) {
  await cp(images, imageDir, { recursive: true });
}
```

`emptyDirectory` (`:127-132`) ist `readdir` plus `rm(..., { recursive: true, force: true })` über jeden Eintrag. Zwischen dem `commit` und dem Ende des `cp` gibt es ein Fenster, in dem die Datenbank auf dem Stand des Backups ist und die Bildablage **leer**. Bricht der Prozess dort ab — Platte voll, Rechte, Neustart des Containers —, bleibt genau der Zustand stehen, den `delivery/stack.md` beim Namen nennt:

> *„Beide Hälften müssen zueinander passen — ein Backup, das Datensätze ohne die zugehörigen Dateien enthält (oder umgekehrt), ist kaputt."*

Und: *„Kein Bild ohne Datensatz, kein Datensatz ohne Datei; verwaiste Dateien und Datensätze ohne Datei sind ein Fehlerzustand."*

Der Riegel gegen Gleichzeitigkeit (`beginRestore()`/`endRestore()`, `route.ts:62,87`) hilft hier nicht: er ist ein Flag im Prozess und bei einem Absturz ohnehin weg. Das vorsorgliche Backup (`route.ts:67-76`, voreingestellt an) ist der einzige Rückweg — es macht den Schaden reparabel, nicht unwahrscheinlicher, und wer das Häkchen abwählt, hat auch das nicht.

**Empfehlung:** Die Reihenfolge umdrehen, so dass der unwiderrufliche Schritt der letzte ist.

1. Die Bilder des Backups in ein Geschwisterverzeichnis kopieren (`<imageDir>.neu`),
2. erst dann die Datenbank wiederherstellen und committen,
3. das alte Verzeichnis nach `<imageDir>.alt` umbenennen, `<imageDir>.neu` nach `<imageDir>` — zwei `rename` auf demselben Dateisystem, praktisch atomar,
4. `<imageDir>.alt` zuletzt entfernen.

Scheitert Schritt 1, ist nichts passiert. Scheitert Schritt 3 zwischen den beiden `rename`, liegen beide Stände noch auf der Platte. Das kostet einmal den Platz der Bildablage und macht aus einem Fehlerzustand einen Abbruch.

Zusätzlich: `lib/images/bildablage-pruefung.ts` und `lib/documents/daily-audit.ts` prüfen genau auf verwaiste Dateien und Datensätze ohne Datei — ein Lauf davon direkt nach der Wiederherstellung, dessen Ergebnis in der Antwort steht, würde einen Halbzustand sofort benennen statt beim nächsten Tageslauf.

### N5. `deleteTrip` schreibt elf Anweisungen ohne Transaktion — das Werkzeug dafür liegt daneben (mittel)

`lib/db/pool.ts:19` gibt es seit req-053:

> *„Fuehrt mehrere Anweisungen auf einer einzigen Verbindung aus — noetig ueberall dort, wo eine Transaktion sie umschliessen soll."*

Ein `grep` über `app/` und `lib/` findet genau **einen** Verwender: `app/api/backups/[id]/wiederherstellen/route.ts:78`.

`lib/db/trips.ts:312-355` ist der Fall, der ihn am dringendsten bräuchte. `deleteTrip` führt elf `delete` nacheinander aus — Dokumente, Kostenzeilen, Optionsauswahlen, Transfers, Programmpunkte, POI-Fotos, POIs, Suchgebietspunkte, Suchgebiete, Reisezuordnungen, zuletzt die Reise — jedes über den Pool, jedes damit möglicherweise auf einer anderen Verbindung, jedes in seiner eigenen impliziten Transaktion. Die Reihenfolge ist sorgfältig begründet (*„Sie stehen zuerst, weil sie auf POIs und Transfers zeigen"*), und genau diese Sorgfalt zeigt, worum es geht: es ist eine Kette, deren Glieder aufeinander angewiesen sind.

Bricht sie in der Mitte — Verbindungsverlust, Neustart, ein Fremdschlüssel, an den niemand gedacht hat —, bleibt eine Reise stehen, deren Dokumente und Kostenzeilen weg sind und deren POIs noch da sind. Kein Rollback, keine Meldung, und die Route liefert `true`, sobald sie durchkommt.

Der Eingriff ist klein, weil die Signatur schon passt: `deleteTrip(db: Queryable, ...)` nimmt bereits eine beliebige Verbindung. Der Aufrufer wechselt von `getPool()` auf `withDatabaseClient((client) => ...)`, und in `deleteTrip` kommen `begin`, `commit` und `rollback` dazu — wörtlich das Muster aus `lib/backup/database.ts:179-223`, das schon im Repo steht und getestet ist.

Derselbe Gedanke, kleinere Fälle: `startRatingRound` (`lib/db/rating-rounds.ts:197-207`) legt die Runde an und fügt danach je POI eine Zeile hinzu; `createPois` (`lib/db/pois.ts:236-296`) fügt bis zu 20 POIs einzeln ein.

### N6. Die POI-Nummer wird weiterhin per Read-then-Write vergeben (niedrig-mittel)

Fortschreibung aus der letzten Review (dort N3). `lib/db/pois.ts:301-304`:

```js
const { rows } = await db.query(`select max(number) as max from poi where trip_id = $1`, [tripId]);
return (rows[0]?.max ?? 0) + 1;
```

Gerufen von `createPois` (`:240`, zählt danach in der Schleife selbst hoch) und `createPoi` (`:375`). Der Riegel in der Datenbank steht unverändert: `migrations/0014_poi_number.sql` schließt mit `unique (trip_id, number)`.

**Zwei Dinge haben sich seither geändert, in beide Richtungen.** Entlastend: Die Overpass-Schleife, die den Zeitraum zwischen Lesen und Schreiben minutenlang machte, ist weg; der Deckel auf 20 steht. Belastend: `createPois` ist nicht mehr der einzige Weg, auf dem POIs entstehen. `createPoi` liegt hinter dem Anlegen von Hand — und das geht seit req-060 über die Anlegezeile über der Liste (`poi-anlegezeile.tsx`), also mit deutlich weniger Reibung als über das Formular. Zwei Personen, die im selben Moment einen POI zu derselben Reise anlegen, lesen dasselbe `max`.

Die Empfehlung ist unverändert und bleibt ein einziges Statement:

```sql
insert into poi (id, trip_id, number, ...)
values ($1, $2, (select coalesce(max(number), 0) + 1 from poi where trip_id = $2), ...)
```

Damit fallen Lesen und Schreiben zusammen, und der Constraint kann nicht mehr auslösen. Zusammen mit N5 (Transaktion um `createPois`) ist der Fall geschlossen.

### N7. Kleinigkeiten (niedrig)

- **Unbehandeltes `request.json()` auf vier Routen ergibt eine 500 statt einer 400.** Die neuen Routen machen es vor: `app/api/kostenzeilen/route.ts:50-61` und `app/api/bewertungsrunden/route.ts:23-34` haben denselben `readBody`-Helfer mit `try`/`catch`. Die älteren nicht: `app/api/poi-status/route.ts:14`, `app/api/search-area/route.ts:23` und `:58`, `app/api/poi-search/route.ts:44` rufen `await request.json()` nackt. Ein abgeschnittener Request-Body — im Mobilnetz keine Seltenheit — wird damit als Serverfehler gemeldet statt als fehlerhafte Anfrage. Der Helfer existiert zweimal wortgleich; er gehört nach `lib/` und in alle vier Routen.
- **Nicht-UUIDs ergeben ebenfalls eine 500.** `setPoiStatus` (`lib/db/pois.ts:151-166`) setzt `where id = $1` auf eine `uuid`-Spalte. Ein `poiId: "abc"` erreicht Postgres, das die Umwandlung mit `22P02` verweigert, und der Fehler schlägt ungefangen durch. Dieselbe Formatprüfung fehlt auf den anderen Schreib-Routen. Wenn der `readBody`-Helfer ohnehin wandert, gehört eine `istUuid()`-Prüfung daneben.
- **`updateKostenzeile` beschränkt sich nicht auf manuelle Zeilen.** `lib/db/kostenzeilen.ts:304-318` macht es bei `deleteKostenzeile` richtig (`where id = $1 and activity_id is null`); `updateKostenzeile` (`:231-246`) prüft nur den Account. Über `PUT /api/kostenzeilen` mit `{ id: "<Zeile eines Programmpunkts>", bezeichnung: "x" }` lässt sich damit eine Bezeichnung an eine Plan-Zeile schreiben, die `lib/kosten/zeilen.ts:91` nie anzeigt (dort gilt `poi?.name ?? activity.title`). Kein Schaden, aber stumme Daten in der Ablage, und eine Asymmetrie zwischen zwei Funktionen, die zehn Zeilen auseinander stehen. Ein `and activity_id is null` an derselben Stelle.
- **`startRatingRound` verlässt sich auf den Index, fängt ihn aber nicht.** `migrations/0037_bewertungsrunde.sql:24-26` legt `rating_round_eine_laufende_idx` als partiellen eindeutigen Index an — richtig so, und der Kommentar begründet es sauber (*„Der Index haelt die Regel auch dann, wenn zwei Anfragen gleichzeitig ankommen"*). `lib/db/rating-rounds.ts:179-183` prüft davor selbst auf eine laufende Runde und liefert dann sauber `"laeuft"` → 409. Gewinnt aber die zweite Anfrage das Rennen, löst der Index aus, und die Verletzung schlägt als 500 durch statt als der 409, den der Nutzer verdient hätte. Ein `catch` um das `insert`, das den Unique-Verstoß auf `{ ok: false, reason: "laeuft" }` abbildet.
- **`CLAUDE.md:1` heißt weiterhin `# <Projektname>`** — dritte Review in Folge. Darunter steht unverändert der Einrichtungshinweis der appbaua-Umstellung. Die Datei ist die oberste bindende Anweisung des Repos und die einzige, die noch ihren Platzhalter trägt. Ein Wort: `# wegfara`. (Ihr Inhalt ist im Übrigen aktuell: die Areas „Reise" und „Planung" stimmen, die Verweise auf `delivery/` tragen.)
- **Open-Meteo fehlt weiterhin in `delivery/stack.md`.** `grep -n "Open-Meteo\|Wetter"` über die Datei liefert nichts — weder bei den Außenanbindungen noch in der Aufzählung der zu mockenden Dienste. Die Wetterdaten werden unverändert aus dem Browser jedes Teilnehmers geholt (`app/go/go-view.tsx:161` → `lib/weather/open-meteo-client.ts:19`), gegen die Begründung, die `app/api/place-search/route.ts:5-9` für Nominatim ausdrücklich festhält. Unverändert offen aus der letzten Review (dort N4). Inzwischen ist auch die EZB-Abfrage (`lib/expenses/exchange-rate.ts:29`) in `stack.md` beschrieben, aber nicht in der Mock-Liste genannt.
- **`OSM_STYLE` steht weiterhin dreimal im Repo,** `map-view.tsx:25`, `poi-map.tsx:38`, `day-route-map.tsx:27`, zwei Kopien davon im selben Bereich. Die vollständige Begründung für `tileSize: 512` steht nur noch in der ersten; die beiden anderen verweisen über die Bereichsgrenze hinweg dorthin. Unverändert offen (letzte Review, N5). Zusammen mit N1 wird daraus ein Aufräumen: `lib/map/` — wo schon `worker-url.ts`, `worker-assets.ts`, `day-map.ts` und `lifecycle.ts` liegen — wird der Ort, an dem jede Karte ihre gemeinsamen Voraussetzungen holt, statt dass jede Komponente sich einzeln erinnert.
- **Kein `.dockerignore`,** dritte Review (25.08., N5). `deploy/Dockerfile` existiert, `.dockerignore` nicht — `node_modules` und `.next` wandern damit in den Build-Kontext.
- **Fünf Kommentare verweisen weiterhin auf `bug-011`,** das es unter `delivery/bugs/` (auch nicht in `done/`) nicht gibt: `poi-map.tsx:210`, `:420`, `:550`, `split-view.tsx:107`, `lib/map/lifecycle.ts:24`. Von zwölf auf fünf reduziert — der Rest gehört nachgezogen oder umformuliert.
- **`lib/auth/tokens.ts:20` `secretsMatch` wird außerhalb seines Tests weiterhin nicht gerufen.** Unverändert; die Empfehlung bleibt, den Kommentar um einen Satz zu ergänzen, dass der Vergleich bewusst in der SQL-Bedingung stattfindet.

## Unverändert offen

Aus den drei Vorgänger-Reviews, geprüft am Stand 739686b:

| Herkunft | Befund | Stand |
|---|---|---|
| 18.08. #1 | Mandantenprüfung auf den Schreib-Endpunkten | ✅ **erledigt** — `poi-status`, `search-area` und `poi-search` prüfen jetzt explizit gegen `session.accountId` |
| 18.08. #3 | Client-Schreibhelfer ignorieren HTTP-Fehler | ✅ **erledigt** — geprüft über alle `lib/**/save-*.ts`; `save-status.ts:22` nennt bug-021 als Anlass |
| 18.08. #12 | `extractRequestedCount` nimmt die erste Zahl | ✅ **erledigt** — `MAX_SUGGESTIONS = 20` deckelt (`ai-search.ts:253-256`) |
| 18.08. #13 | Backup-Funktion fehlt | ✅ **erledigt** — req-053, `lib/backup/` mit Sicherung, Wiederherstellung und Wartungssperre |
| 01.09. N6 | TODO in `stack.md` bei „Commands" | ✅ **erledigt** |
| 01.09. N1 | Planungskarte meldet die Worker-Adresse nicht | ❌ **verschärft — siehe N1** |
| 01.09. N2 | Keine Zeitlimits | ❌ offen, Außenkante gewachsen — siehe N3 |
| 01.09. N3 | POI-Nummer per Read-then-Write | ❌ offen — siehe N6 |
| 01.09. N4 | Wetter aus dem Browser, Open-Meteo fehlt in `stack.md` | ❌ offen |
| 01.09. N5 | `OSM_STYLE` dreimal | ❌ offen |
| 25.08. N1 | Trefferflächen der Eckpunkt-Griffe 22 statt 44 px | ❌ offen — **siehe unten** |
| 25.08. N2 | Kartenausschnitt wird bei jeder Zustandsänderung zurückgesetzt | ❌ offen |
| 25.08. N3 | Kommentare verweisen auf nicht existente Bugs | ⚠️ von 12 auf 5 reduziert |
| 25.08. N5 | Kein `.dockerignore` | ❌ offen |
| 18.08. #2 | Schreib-Debounce aus `stack.md` existiert nirgends | ❌ offen — **sechste Review** |
| 18.08. #4, #6, #9, #10, #11 | Anmeldelink per GET; Rate-Limiter O(n); Secure-Flag am `x-forwarded-proto`; Notfallcodes im Klartext-Cookie; Overpass-Zitate | ⚠️ #11 entfallen (Overpass ist weg), übrige offen |
| 18.08. #7 | Mehrschrittige Schreibvorgänge ohne Transaktion | ⚠️ Werkzeug gebaut, einmal angewandt — siehe N5 |
| 18.08. #8 | Demo-Daten in den Schema-Migrationen | ❌ offen |
| Security 26.08. | alle acht, darunter der Transport-Befund | ❌ offen |

**Zwei davon verdienen einen Satz mehr:**

**Die 22-px-Griffe (25.08. N1) haben sich von einem Versehen in eine Festlegung verwandelt.** `app/plan/components/poi-map.module.css:255-270` erklärt die verkleinerte Fläche inzwischen als Lösung:

> *„Die Trefferflaeche kommt jetzt aus der sichtbaren Groesse (22px, erster Punkt 30px) statt aus einem Pseudo-Element — das brauchte ‚position: relative' am Marker und verschob ihn (bug-011)."*

Die Mittelpunkt-Griffe (`.midpointHandle`, `:288-290`) sind mit 9×9 px noch kleiner. `stack.md` (Conventions, Regel 4) verlangt 44×44 px und lässt eine Ausnahme ausdrücklich zu — aber nur mit *„einem sichtbaren Hinweis statt einer kaputten Darstellung"*. Der fehlt. Dass die Datei ringsum zeigt, wie es geht (`.drawButton:218-219` mit `min-height: 44px` und durchsichtigem 7-px-Rand, und `poi-map.layout.test.ts:129-140` prüft genau diese Bauart für die Statusfilter), macht die Ausnahme erklärungsbedürftiger, nicht weniger. Entweder dieselbe Lösung auch für die Griffe — das `border: 7px solid transparent`-Muster kommt ohne `position: relative` aus und hätte bug-011 also nie ausgelöst —, oder die Ausnahme in `stack.md` festhalten. Beides ist besser als eine Vorgabe, gegen die der Code stumm verstößt.

**Der Schreib-Debounce (18.08. #2) steht jetzt in der sechsten Review.** `delivery/stack.md:243` fordert unverändert: *„Schreibende Zugriffe werden im Datenzugriffs-Layer gebündelt und mit 15 Sekunden Verzögerung ausgeführt."* Ein `grep` nach `debounce`/`gebuendelt`/`verzoegert` über `lib/` liefert **zwölf Kommentare, die die Ausnahme in Anspruch nehmen** — `lib/db/sessions.ts:116`, `:146`, `:176`, `lib/db/rating-rounds.ts:293`, `lib/db/account-api-keys.ts:62`, `lib/db/trip-positions.ts:58`, `lib/db/account-switches.ts:21`, `lib/expenses/save-expense.ts:32`, `lib/trips/save-trip-state.ts:8`, `lib/participants/save-account-admin.ts:19`, `lib/trip-participants/save-trip-participant.ts:19`, `lib/api-keys/save-api-key.ts:46`, `lib/invitations/request-invitation.ts:16` — und **keinen einzigen**, der ihn anwendet. Die Ausnahme („Anlegen, Löschen, Abmelden") ist damit die Regel geworden. Jeder dieser Kommentare ist einzeln gut begründet; zusammen sagen sie, dass die Vorgabe in dieser Form nicht getragen hat. Nach sechs Reviews ist eine dauerhaft unerfüllte bindende Vorgabe schlechter als beide Alternativen: entweder bauen, oder `stack.md:238-252` auf das umschreiben, was tatsächlich gilt.

## Was in Ordnung war

- **Quality-Gate vollständig grün:** `npm run types` fehlerfrei, `npm run lint` fehlerfrei, **3649 Tests in 304 Dateien** bestanden (125,3 s). Keine übersprungenen Tests, keine Warnungen. Die Vervierfachung der Testzahl bei 190 Commits bedeutet, dass die Test-Policy aus `stack.md` tatsächlich gelebt wird, nicht nur dasteht.
- **Die Mandantentrennung ist jetzt durchgängig explizit.** Der Befund, der drei Reviews lang oben stand, ist geschlossen — und zwar nicht punktuell: `app/api/poi-search/route.ts:81` holt sich `findTrip(db, accountId, tripId)` und weist mit 404 ab, `lib/db/kostenzeilen.ts` führt drei eigene Helfer (`tripOfActivity`, `tripOfKostenzeile`, `dokumentInTrip`), die jede Änderung bis `trip.account_id` zurückverfolgen, und `lib/db/rating-rounds.ts` verknüpft in **jeder** Abfrage bis dorthin. Ein Grep über `app/api/**/route.ts` findet keinen Handler mehr, der `currentSession()` ruft und die Kennung danach liegen lässt.
- **`lib/backup/database.ts` ist die erste Stelle außerhalb der Migrationen, die Transaktionen richtig benutzt** — `begin` (`:179`), `commit` (`:221`), `rollback` im `catch` (`:223`), auf einer Verbindung aus `withDatabaseClient`. Genau das Muster, das Befund 7 seit dem 18.08. verlangt. Dass es jetzt im Repo steht und getestet ist, macht N5 zu einer Kopieraufgabe statt zu einem Entwurf.
- **`tests/mocks/maplibre-gl.ts` ist ein ungewöhnlich guter Test-Nachbau.** Er modelliert nicht die Schnittstelle, sondern das Fehlverhalten: `data` versus `processed`, getrennt durch die gemeldete Worker-Adresse, mit einer achtzeiligen Begründung aus bug-013 heraus. Ein Nachbau, der einen konkreten Produktionsfehler reproduzierbar macht, ist selten — dass er in N1 an einer Stelle umgangen wird, ändert nichts an seiner Qualität, sondern macht sie erst sichtbar.
- **`lib/secrets/encryption.ts` ist sauber gebaut und vollständig begründet.** AES-256-GCM, zufälliger IV je Vorgang, Auth-Tag im Ergebnis, Zweck-Trennung beim Ableiten (`PURPOSE = "wegfara:zugangsschluessel"`), und `secretEncryptionKey()` liefert lieber `null` als einen festen Wert aus dem Quelltext — *„Ein Ausweichen auf einen festen Wert im Quelltext waere schlimmer als die Sperre."* Der Kommentar nennt auch die Gegenprobe: für Anmeldegeheimnisse gilt das Gegenteil, die liegen als Prüfsumme in der DB.
- **`migrations/0037_bewertungsrunde.sql` und `0045_kostenzeile.sql` sind Lehrstücke.** Jeder Constraint trägt seinen Grund: `rating_round_eine_laufende_idx` als partieller eindeutiger Index mit dem Hinweis, dass er *„die Regel auch dann [haelt], wenn zwei Anfragen gleichzeitig ankommen"*; `kostenzeile_herkunft` mit *„Ohne beides waere sie eine Zeile ohne Gegenstand"*; und die ausdrückliche Feststellung, dass `kostenzeile` **keine** zweite Kopie von Preis und Buchungsstatus hält, *„sonst gaebe es zwei Wahrheiten und die Frage, welche gilt"*. `delivery/datenbank.md` ist dazu vollständig nachgezogen (`:710`, `:799`).
- **Die Trennung zwischen gespeichertem und gerechnetem Zustand ist in req-062 und req-063 konsequent durchgehalten.** `lib/kosten/zeilen.ts` bildet die Tabelle bei jeder Anzeige neu aus Plan und POI; gespeichert wird nur, was sich daraus nicht ergibt. `lib/bewertungen/rundenstand.ts` rechnet die Zustimmung aus den Stimmen und schreibt sie nirgends hin — mit dem Satz dazu, warum: *„sie ist eine Rangfolge, keine Entscheidung: aus den Stimmen folgt nie ein Status"*. Beide Module sind UI-frei und ohne laufendes Next.js prüfbar, wie `stack.md` es verlangt.
- **Die Bereichsleiste löst bug-033 elegant:** derselbe Baustein ist im Planer ein `<button>` mit `onSelectArea` und außerhalb ein `<Link href={planAreaPath(...)}>` (`components/bereichsleiste.tsx:120-134`). Eine Komponente, zwei Betriebsarten, kein Sonderfall im Aufrufer. Dass daraus N1 folgt, ist kein Fehler dieser Lösung, sondern eine Nebenwirkung, die an einer ganz anderen Stelle aufzufangen war.
- **`tests/e2e/fixtures.ts` nimmt jedem künftigen Fluss zwei Dinge ab,** die man sonst vergisst: den Weg nach draußen (`route.abort()` für alles außer localhost) und die Bildschirmprüfung bei jedem `goto`. Die Konstruktion ist richtig; ihr fehlt nur, aufgerufen zu werden (N2).
- **`lib/routing/` hält die Vorgabe aus `stack.md` exakt ein.** `RoutingClient` ist die austauschbare Schnittstelle, `osrm-client.ts:23-27` hält die drei Adressen an genau einer Stelle, `OSRM_BASE_URL` übersteuert alle drei, und der Kommentar erklärt, warum es je Profil eine eigene Adresse braucht (*„Eine OSRM-Instanz rechnet immer nur mit dem Profil, mit dem ihre Daten aufbereitet wurden"*). Ein Umzug auf den Beelink ist eine Umgebungsvariable.
- **Die neuen Routen machen die Eingabeprüfung vorbildlich.** `app/api/kostenzeilen/route.ts` prüft jeden Wert einzeln und unterscheidet sauber zwischen „nicht mitgeschickt" (`undefined`), „gelöscht" (`null`) und „unlesbar" (`"ungueltig"`) — mit der Begründung: *„An einem Geldbetrag wird nichts geraten — was sich nicht lesen laesst, wird abgewiesen."* Die Statuscodes sind differenziert (400/404/409/403 statt pauschal 400). Dass die älteren Routen dahinter zurückbleiben (N7), ist die Aufgabe, nicht der Vorwurf.

## Empfohlene Reihenfolge

1. **N1** (`ensureMapWorkerUrl()` in `day-route-map.tsx`, `linien()` auf `querySourceFeatures` umstellen, Struktur-Test) — ein laufender, stummer Fehler auf einem Weg, den die Anwendung selbst anbietet. Zwei Zeilen Fix, und die vorhandenen fünf Tests werden dabei von Fehlanzeigen zu echten Zusicherungen. bug-013 hat die Ursachensuche schon einmal gekostet.
2. **N2** (ein E2E-Fluss über alle sechs Bereichsadressen) — sechs Zeilen, und sie decken auf einen Schlag fünf ungeprüfte Oberflächen bei drei Breiten ab. Er fängt N1 nebenbei an der echten Anwendung. Vor jeder weiteren Layout-Arbeit im Planer.
3. **25.08. N1** (Trefferflächen der Griffe) — unverändert der Befund mit dem direktesten Nutzerbezug, und inzwischen im CSS als Lösung festgeschrieben. Das `border: 7px solid transparent`-Muster aus `.drawButton` löst es ohne `position: relative` und damit ohne bug-011. Alternativ die Ausnahme in `stack.md` festhalten — aber nicht weiter stumm lassen.
4. **N4** (Reihenfolge der Wiederherstellung) — die einzige Stelle im Repo, an der ein Abbruch Daten unwiederbringlich in einen Zustand bringt, den `stack.md` als Fehlerzustand benennt. Zwei `rename` statt eines `rm -rf`.
5. **N3** (Zeitlimits, Nebenläufigkeit der 40 Google-Aufrufe) — drei unabhängige Änderungen, die Fehlerpfade existieren alle. Punkt 3 (nebenläufig statt sequenziell) ist der, den der Nutzer sofort merkt.
6. **N5 + N6** (`deleteTrip` in eine Transaktion, POI-Nummer per SQL) — gemeinsam anzufassen: dasselbe Thema, das Werkzeug liegt seit req-053 bereit und ist einmal erfolgreich benutzt.
7. **N7** (`readBody`-Helfer nach `lib/`, UUID-Prüfung, `activity_id is null` in `updateKostenzeile`, `catch` in `startRatingRound`) — ein Durchgang, vielleicht eine Stunde, und die Schnittstelle antwortet durchgehend mit dem Code, den sie meint.
8. **Befund 2** (Schreib-Debounce) — oder die Entscheidung, `stack.md:238-252` auf das umzuschreiben, was zwölf Kommentare inzwischen einhellig sagen. Nach sechs Reviews ist die Entscheidung überfällig, in welche Richtung auch immer.
9. **Kleinigkeiten** (`CLAUDE.md:1`, `.dockerignore`, Open-Meteo in `stack.md`, `OSM_STYLE` nach `lib/map/`, die fünf bug-011-Verweise) — Aufräumarbeit; `OSM_STYLE` gehört sachlich zu N1 und sollte mit ihm laufen.

---

**Zur Arbeitsweise dieser Review:** Ausgeführt wurden `npm run types`, `npm run lint` und `npm test` am Stand 739686b — alle drei grün (3649 Tests in 304 Dateien, 125,3 s). Die Abhängigkeiten mussten mit `NODE_ENV=development npm ci` installiert werden; in dieser Umgebung steht `NODE_ENV=production`, weshalb ein einfaches `npm install` die devDependencies auslässt und `npm test` mit `vitest: not found` abbricht — das ist eine Eigenheit der Ausführungsumgebung, kein Befund am Repo. `npm run test:e2e` wurde nicht ausgeführt (kein PostgreSQL-Server in dieser Umgebung); die E2E-Aussagen in N2 stammen aus der Quelltextanalyse der Flüsse und der Fixture, nicht aus einem Lauf. Befund N1 habe ich mit zwei Wegwerf-Testdateien empirisch bestätigt — einmal `DayRouteMap` isoliert (gesetzt=1, verarbeitet=0), einmal `PlanView` über beide Einstiegswege (workerUrl `""` gegen `"/maplibre/maplibre-gl-worker.mjs"`); beide Dateien sind wieder entfernt, `git status` ist sauber. Der Stand der Vorbefunde stammt aus gezielten Greps und dem Lesen der betroffenen Stellen, nicht aus einem Diff — seit 091b705 wurden 818 Dateien geändert, ein Diff-Beweis wie in der letzten Review war hier nicht möglich. Es wurde nichts committet oder gepusht. Kein Zugriff auf prod, keine Datenbank angefasst, kein Netzaufruf nach außen außer der Paketinstallation.
