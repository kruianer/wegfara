---
type: code-review
repo: Wegfara
commit: 99dcb6e
date: 2026-09-22
---

# Code-Review: Wegfara (99dcb6e)

Automatisch erstellt vom appbaua-Worker am 2026-09-22.

Review complete. Here is the full report.

---
type: code-review
repo: wegfara
commit: 99dcb6e
date: 2026-09-22
---

# Code-Review: wegfara (99dcb6e)

Automatisch erstellt vom appbaua-Worker am 2026-09-22. Vorgänger: [2026-09-15 (739686b)](2026-09-15-code-review-wegfara-739686b.md).

## Kurz-Zusammenfassung

Das automatisierte Quality-Gate ist grün: `npm run types` fehlerfrei, `npm run lint` fehlerfrei, **4013 Tests in 325 Dateien** bestanden (159 s). `git rev-list --count 739686b..HEAD` liefert **93 Commits** — req-064 bis req-073 und die Bugs 046 bis 051, darunter zwei große Strecken: die Anmeldung nur noch per Passkey (req-066, mit dem Wegfall der Notfallcodes) und Backup herunterladen/hochladen samt eigenem ZIP-Leser und -Schreiber (req-071).

**Erledigt sind vier Vorbefunde**, zwei davon Langläufer: Der Kartenausschnitt springt nicht mehr bei jeder Zustandsänderung (25.08. N2 — bug-048 hat den Merker `framedRef` vom sichtbaren POI-Bestand auf Reise und Gebiet umgestellt, `poi-map.tsx:390-403`). Die Notfallcodes im Klartext-Cookie sind mit req-066 komplett verschwunden — elf Dateien gelöscht, Migration `0046_notfallcodes_entfernen.sql`; damit ist Befund #10 vom 18.08. nicht mehr entschärft, sondern weg. Dazu ist die automatische Bildschirmprüfung selbst jetzt getestet (`tests/e2e/bildschirmpruefung.e2e.ts`, elf Fälle), und Open-Meteo hat mit `lib/weather/` einen eigenen Platz.

**Der schwerwiegendste Befund ist, dass der schwerwiegendste Befund der letzten Review unverändert dasteht.** N1 von damals — die Planungskarte meldet die Worker-Adresse nicht, `?bereich=planung` führt daran vorbei, die Linien des Tagesplans fehlen stumm — stand als Punkt 1 der „Empfohlenen Reihenfolge" und ist die Fortschreibung von N1 der Review vom 01.09. Ich habe ihn am Stand 99dcb6e erneut gemessen; er lebt unverändert. Es ist die **vierte Review in Folge**, in der derselbe stumme Fehler auf einem Weg liegt, den die Anwendung selbst anbietet.

Neu dazu: req-069 hat das Setzen des POI-Status vom Einzelfall zum Stapel gemacht, ohne die Kette gegen einen Abbruch in der Mitte zu sichern — dabei entsteht genau die Divergenz zwischen Anzeige und Ablage, gegen die bug-021 gebaut wurde. Die Außenkante ohne Zeitlimits (N3) ist durch req-068 und req-072 noch einmal deutlich gewachsen. Das Icon aus req-065 wird bei jedem Seitenaufruf neu gerechnet, weil die middleware es mit `no-store` ausliefert — dieselbe Falle, die für den Karten-Worker ausdrücklich umgangen wurde. Und die Testsuite hat unter Last drei Zeitüberschreitungen, in einem Gate, das vor jedem prod-Deploy auf genau der belasteten Maschine läuft.

## Neue Befunde

### N1. Drei Tests unter Last abgelaufen — in dem Gate, das den prod-Deploy hält (hoch)

Mein erster Lauf von `npm test` lief nebenläufig zu `npm run types` und `npm run lint`. Ergebnis:

```
Test Files  2 failed | 323 passed (325)
     Tests  3 failed | 4010 passed (4013)
  Duration  235.34s
```

Alle drei Fehlschläge sind derselbe: `Error: Test timed out in 5000ms.`

| Datei | Test |
|---|---|
| `app/plan/plan-view.test.tsx:1501` | „enthält die Reiseliste nach dem Anlegen vier Reisen" |
| `app/plan/components/poi-form.test.tsx:763` | „nimmt einen Kurztext mit 200 Zeichen an" |
| `app/plan/components/poi-form.test.tsx:774` | „lässt das 201. Zeichen des Kurztextes nicht ins Feld" |

**Einzeln laufen alle drei durch**, und zwar mit Abstand zur Grenze:

```
poi-form.test.tsx    (68 Tests)  → grün; "200 Zeichen" 1292ms, "201. Zeichen" 1017ms
plan-view.test.tsx  (147 Tests)  → grün; "vier Reisen" 851ms
```

Und der Lauf ohne Nebenlast ist vollständig grün: **4013 Tests in 325 Dateien, 159,19 s.** Es ist also kein kaputter Code — es ist ein zu knapper Abstand zwischen der tatsächlichen Laufzeit und der Vorgabe. `vitest.config.ts` setzt kein `testTimeout`, es gilt die Voreinstellung von 5000 ms. Die drei betroffenen Tests tippen mit `userEvent` lange Zeichenketten in Felder; das ist die teuerste Sorte Komponententest, und sie liegt bei Nebenlast um den Faktor vier höher als sonst.

**Warum das mehr ist als eine Unschönheit:** `.github/workflows/deploy-prod.yml` führt `npm test` und danach `npm run test:e2e` auf dem self-hosted Runner aus — also auf dem Beelink, auf dem laut `delivery/devops.md` gleichzeitig **beide** Umgebungen mit eigenen Containern und eigenem PostgreSQL laufen. Das ist per Konstruktion eine belastete Maschine. Ein abgelaufener Test dort bricht den Job ab, und weil der Backup-Schritt erst danach kommt, ist der Deploy weg, ohne dass am Code etwas fehlte. Das Gate hält dann nicht den Code auf, sondern die Umgebung — genau der Fall, den der Kommentar im Workflow bei der Node-Version schon einmal beim Namen nennt: *„ein Quality-Gate, das an der Umgebung scheitert statt am Code, haelt nichts auf."*

Zusätzlich hat die Suite seit der letzten Review um 364 Tests auf 4013 zugelegt; die Zahl der Tests in der Nähe der Grenze wächst mit.

**Empfehlung:** `testTimeout` in `vitest.config.ts` auf 15000 setzen — eine Zeile, und sie bewegt sich weg von der Zufälligkeit, ohne echte Hänger zu verstecken (ein tatsächlich blockierter Test läuft nicht 15 s, er läuft unbegrenzt). Wer die Grenze streng halten will, hat die zweite Möglichkeit: die drei Tests tippen Texte, deren Länge die Aussage nicht trägt — `fill()` statt `type()` bzw. `user.paste()` bringt sie von über einer Sekunde auf Millisekunden und prüft dieselbe Zusicherung. Beides ist billig; die Mischung (Timeout hoch **und** die drei Tests entschärfen) ist die saubere Antwort.

### N2. bug-013 in der Planungskarte — vierte Review, unverändert scharf (hoch)

Die letzte Review hat diesen Befund als N1 geführt und als Punkt 1 der empfohlenen Reihenfolge; die Review vom 01.09. hatte ihn als Vorhersage. Am Stand 99dcb6e ist nichts davon umgesetzt.

**Die Kette, gemessen:**

```
$ grep -rn "new MapLibreMap(" --include=*.tsx app lib components | grep -v test
app/go/components/map-view.tsx:199
app/plan/components/day-route-map.tsx:173
app/plan/components/poi-map.tsx:760

$ grep -rn "ensureMapWorkerUrl" --include=*.tsx app lib components | grep -v test
app/go/components/map-view.tsx:198      ← unmittelbar vor der Karte
app/plan/components/poi-map.tsx:759     ← unmittelbar vor der Karte
lib/map/worker-url.ts:16                ← die Definition
```

Zwei von drei Karten melden die Worker-Adresse, `day-route-map.tsx` nicht. Und `day-route-map.test.tsx:73` liest unverändert die falsche Hälfte des Nachbaus:

```js
return (source?.data.features ?? []) as GeoJSON.Feature[];
```

**Empirisch bestätigt am Stand 99dcb6e.** Wegwerf-Testdatei unter `app/plan/components/`, die `DayRouteMap` allein rendert (danach entfernt, `git status` sauber):

```
workerUrl   = ""
gesetzt     = 1
verarbeitet = 0
```

Eine Linie liegt in der Quelle, **null** werden verarbeitet — unverändert derselbe Messwert wie vor einer Woche. `setData()` hat geschrieben, `querySourceFeatures()` liefert nichts, die Ebene `day-route-line` zeichnet nichts, keine Konsolenmeldung.

Das Nutzererlebnis, die Ursache, der Weg über `?bereich=planung` aus der Bereichsleiste und die drei Schritte zur Behebung stehen vollständig und richtig in [N1 der Review vom 15.09.](2026-09-15-code-review-wegfara-739686b.md). Ich wiederhole sie hier nicht, sondern nur die Reihenfolge, weil sie den Beweis mitliefert:

1. `linien()` in `day-route-map.test.tsx:71-74` auf `querySourceFeatures("day-route-lines")` umstellen. Die fünf bestehenden Tests **schlagen dann fehl** — das ist der Repro-Test, den `stack.md` (Testing, reproduce-first) verlangt.
2. `ensureMapWorkerUrl()` in `day-route-map.tsx` vor `new MapLibreMap(...)` (`:173`). Eine Zeile plus Import; die Tests werden grün.
3. Die Struktur-Zusicherung nach dem Muster von `app/api/api-guard.test.ts:53`: „jede Datei mit `new MapLibreMap(` enthält auch `ensureMapWorkerUrl(`". Zehn Zeilen. Bei drei Karten, einem Ausreißer und vier Reviews ist das die einzige Maßnahme, die den fünften Bericht verhindert.

**Was diese Review hinzufügt, ist nur eine Beobachtung zum Verfahren:** Zwischen dem 15.09. und heute sind 93 Commits entstanden, zehn Requirements und sechs Bugs abgearbeitet — die Strecke ist produktiv. Was die Reviews melden, geht daran aber vorbei; die Befunde dieser und der letzten Review überschneiden sich zu großen Teilen. Ein Befund, der als Punkt 1 empfohlen wird, zwei Zeilen Änderung kostet, seinen Repro-Test mitgeliefert bekommt und danach unverändert dasteht, sagt etwas über den Weg vom Bericht zur Arbeitsliste — nicht über seine Schwierigkeit. Ein Vorschlag dazu steht unten unter „Empfohlene Reihenfolge".

### N3. req-069 setzt den Status im Stapel — bricht es in der Mitte, zeigt die Liste etwas anderes als die Datenbank (mittel-hoch)

Seit req-069 lassen sich mehrere angekreuzte POIs auf einmal auf denselben Status setzen. Die Kette:

| Stelle | Was dort steht |
|---|---|
| `app/plan/components/use-poi-status.ts:52` | `setzeStatusFuerMehrere` — zeigt optimistisch an, speichert, nimmt bei Fehlschlag zurück |
| `lib/pois/save-status.ts:41` | `savePoiStatuses` — ein Request; `if (!response.ok) return null` |
| `app/api/poi-status/route.ts:41` | `setPoiStatuses(getPool(), session.accountId, poiIds, status)` — **ohne try/catch** |
| `lib/db/pois.ts:184-188` | `for (const poiId of poiIds) { if (await setPoiStatus(...)) ... }` — ein `update` je POI, jedes über den Pool, jedes in eigener impliziter Transaktion |

Der Kommentar an `setPoiStatuses` begründet die Schleife sauber — *„ein POI, den es im Account nicht gibt, faellt still heraus statt die uebrigen zu verhindern"* — und das trifft für ein `update` zu, das 0 Zeilen liefert. Es trifft nicht für ein `update`, das **wirft**.

**Empirisch bestätigt.** Wegwerf-Test mit einem `Queryable`, das beim dritten Aufruf einen Postgres-Fehler wirft (danach entfernt, `git status` sauber):

```
geschrieben      = [ 'a', 'b' ]
Fehler kam durch = invalid input syntax for type uuid: "kaputt"
```

Zwei POIs sind geschrieben, der Fehler verlässt die Schleife, `setPoiStatuses` gibt nichts zurück. Die Route fängt ihn nicht, Next antwortet mit 500, `savePoiStatuses` liefert `null`, und `use-poi-status.ts:66-71` behandelt `null` als „alles misslungen":

```js
const misslungene = gesetzte === null ? betroffene : betroffene.filter(...);
onPoisChanged(misslungene);            // zurück auf den alten Wert -- für ALLE
```

**Das Ergebnis:** Der Reiseleiter kreuzt zwanzig POIs an, wählt „Gesetzt", bekommt die Meldung *„Der Status von 20 POIs konnte nicht gespeichert werden."* — und in der Datenbank stehen die ersten zwölf auf „Gesetzt". Nach dem nächsten Neuladen sind sie es. Genau die Divergenz zwischen Anzeige und Ablage, gegen die bug-021 gebaut wurde, nur in die andere Richtung: die Anzeige ist jetzt die pessimistischere.

**Zwei Auslöser, einer davon alltäglich:**
- Eine Kennung, die kein UUID ist, erreicht Postgres (`setPoiStatus`, `lib/db/pois.ts:157-163`, `where id = $1` auf einer `uuid`-Spalte) → `22P02`. Über die Oberfläche passiert das nicht; über die Schnittstelle schon (siehe N7, dasselbe Thema).
- **Ein Verbindungsabbruch oder ein Neustart mitten in der Schleife.** Das ist der realistische Fall, und mit zwanzig aufeinanderfolgenden Anweisungen ist das Fenster zwanzigmal so groß wie beim Einzel-POI.

`deletePois` (`lib/db/pois.ts`) hat exakt dieselbe Bauart und dasselbe Verhalten — dort wiegt ein Abbruch schwerer, weil die Bilddateien der bereits gelöschten POIs am Aufrufer hängen.

**Empfehlung:** Drei kleine Schritte, jeder unabhängig richtig.

1. **Ein Statement statt einer Schleife.** Die Mandantenprüfung geht in dieselbe Bedingung, und es gibt keine Mitte mehr, in der es brechen kann:
   ```sql
   update poi set status = $3
   where id = any($1::uuid[])
     and trip_id in (select id from trip where account_id = $2)
   returning id
   ```
   Das `::uuid[]` erledigt N7 für diesen Weg gleich mit: eine Kennung, die kein UUID ist, lässt den ganzen Cast scheitern, bevor eine Zeile geschrieben ist — ein Fehlschlag ohne Teilwirkung.
2. **Die Route fängt den Fehler** und antwortet mit 400 statt 500, wie es `app/api/kostenzeilen/route.ts` für seine Fälle vormacht.
3. **`deletePois` in eine Transaktion** — dort geht ein Statement nicht, weil die Dateinamen mitkommen müssen; `withDatabaseClient` aus `lib/db/pool.ts:19` ist der Weg (siehe N6).

### N4. Kein ausgehender Netzaufruf hat ein Zeitlimit — und die Außenkante ist um den Faktor vier gewachsen (mittel-hoch)

Dritte Review in Folge. Der Grep ist unverändert leer:

```
$ grep -rn "AbortSignal.timeout\|signal:" lib/google lib/osm lib/weather lib/routing lib/ai lib/expenses --include=*.ts | grep -v test
(kein Treffer)
```

`lib/ai/openai-client.ts:105` und `:138` konstruieren beide `new OpenAI({ apiKey, fetch, maxRetries: 0 })` — keine `timeout`-Option, also die Vorgabe des SDK: zehn Minuten.

**Was sich seit der letzten Review geändert hat, geht in die falsche Richtung.** Die Review vom 15.09. hat für `POST /api/poi-search` „bis zu 42 aufeinanderfolgende Netzaufrufe" gezählt. Zwei Requirements haben die Zahl seither erhöht:

| Schritt | Aufrufe | Stelle | vorher |
|---|---|---|---|
| Nominatim Rückwärtssuche | 1 | `poi-search/route.ts:114` | 1 |
| OpenAI (Vorschlagsliste) | 1 | `:115` | 1 |
| Google Places Textsuche, sequenziell in einer `for`-Schleife | bis 20 | `lib/pois/ai-search.ts:285` | bis 20 |
| **Google Foto-Abrufe, sequenziell — Schleife in Schleife** | **bis 140** | `poi-search/route.ts:151` → `lib/pois/google-photos.ts:69` | bis 20 |

`MAX_PHOTOS` ist mit req-068 von 3 auf 7 gestiegen (`lib/google/places-client.ts:16`), und `poi-search/route.ts:142-145` hält ausdrücklich fest, dass hier **nichts mehr gekürzt** wird: *„der Weg, auf dem ein POI entsteht, darf die Anzahl seiner Fotos nicht aendern (bug-049)."* Sachlich richtig — nur multipliziert es sich mit den 20 POIs aus `MAX_SUGGESTIONS`. Aus „bis zu 42" sind **bis zu 162 streng aufeinanderfolgende Netzaufrufe in einem Request-Handler** geworden, keiner mit einer Obergrenze für die Wartezeit.

Dazu ist mit req-072 eine neue Außenkante entstanden, und zwar die langsamste von allen: `openai.images.generate` (`lib/ai/openai-client.ts:138-141`). Bilderzeugung dauert typisch Dutzende Sekunden. Ohne `timeout` gilt dafür dieselbe Zehn-Minuten-Vorgabe, und `app/api/poi-ki-bild/route.ts:64` wartet darauf, während der Nutzer auf „Bild erzeugen" gedrückt hat. Auf dem Beelink mit genau einer Instanz je Umgebung hält jede solche Anfrage einen Platz.

**Empfehlung:** Unverändert drei unabhängige Schritte; die Fehlerpfade liefern alle schon `null` bzw. `[]`, ein Abbruch fällt also ohne weitere Änderung hinein.

1. `fetch(url, { signal: AbortSignal.timeout(MS) })` in den HTTP-Clients — 5 s für Nominatim, Open-Meteo und die EZB, 10 s für Google Places und OSRM. Zehn Aufrufstellen (`lib/google/places-client.ts`, `lib/routing/osrm-client.ts`, `lib/osm/*.ts`, `lib/weather/open-meteo-client.ts`, `lib/expenses/exchange-rate.ts`).
2. `new OpenAI({ ..., timeout: 30_000 })` für die Fragen und `timeout: 120_000` für das Bild — zwei Zeilen, und die Werte gehören neben `DEFAULT_MODEL` und `DEFAULT_IMAGE_MODEL`, wo die anderen Modell-Entscheidungen stehen.
3. Die 20 Nachschläge und die bis zu 140 Foto-Abrufe **nebenläufig** statt nacheinander (`Promise.all` über Gruppen von etwa fünf). Das bringt die Wartezeit von „Summe" auf „Maximum" und ist unabhängig von 1 und 2 richtig — es ist auch die einzige der drei Änderungen, die der Nutzer sofort merkt.

### N5. Das Icon aus req-065 wird bei jedem Seitenaufruf neu gerechnet (mittel)

`app/icon/[groesse]/route.tsx` rendert die Kompassrose über `ImageResponse` aus `next/og` — satori plus resvg, bei jeder Anfrage neu. Dass es bei der Anfrage entsteht und nicht beim Bauen, ist eine bewusste und gut begründete Entscheidung (`lib/icon/icon-pfade.ts:5-8`, `delivery/stack.md`, Conventions): nur so entscheidet die Umgebung über die Farbe, obwohl dev und prod aus demselben Stand bauen.

Was dazu nicht passt: Die middleware verbietet dem Browser, das Ergebnis abzulegen.

**Empirisch bestätigt.** Wegwerf-Test, der `config.matcher` und `middleware()` direkt befragt (danach entfernt, `git status` sauber):

```
matcher /icon/180       = true
matcher /icon/32        = true
matcher /maplibre/x.mjs = false
Cache-Control /icon/180 = no-store, no-cache, must-revalidate, max-age=0
```

Die Kette: `/icon/180` trägt keine Dateiendung und ist damit vom matcher (`middleware.ts:145`) **nicht** ausgenommen → die middleware läuft → `ICON_BASIS_PFAD` steht in `PUBLIC_PREFIXES` (`middleware.ts:50`) → `return noStore(NextResponse.next())` (`:93`). Ein eigenes `Cache-Control` im Route-Handler hilft nicht; die middleware setzt ihres auf dieselbe Antwort.

**Das ist wörtlich die Falle, die für den Karten-Worker erkannt und umgangen wurde.** Der Kommentar an `config.matcher` (`middleware.ts:138-141`):

> *„‚maplibre/' ist der Worker der Kartenbibliothek (bug-013) … Laeuft die middleware darueber, traegt die Auslieferung ‚no-store' und der Browser laedt bei jedem Kartenaufruf ein halbes Megabyte neu."*

Dieselbe Begründung gilt für das Icon — nur kostet es nicht Bandbreite, sondern Rechenzeit auf dem Server, und zwar bei **jedem** Seitenaufruf zweimal (32 px für den Tab, 180 px für den Homescreen; `app/layout.tsx:39-51` und `app/manifest.ts:43-53`).

**Warum es trotzdem nur „mittel" ist:** Die Anwendung ist für den privaten Kreis gebaut (`vision.md`), die Last bleibt klein. Aber die Anzahl der POST-freien Seitenaufrufe im Begleiter ist die höchste Anfragezahl, die die App überhaupt hat, sie läuft auf einer Instanz auf einem Beelink, und der Bau eines PNG über satori ist die teuerste Antwort, die diese Anwendung kennt.

**Empfehlung:** Die Lösung liegt fertig daneben — dieselbe, die `maplibre/` bekommen hat. `ICON_BASIS_PFAD` in den matcher-Ausschluss (`middleware.ts:145`) aufnehmen und im Route-Handler ein eigenes `Cache-Control` setzen, das lange gilt, aber nicht ewig:

```ts
headers: { "Cache-Control": "public, max-age=86400" }
```

Das Icon ändert sich nur, wenn sich `APP_URL` oder die Farben ändern — beides ein Deploy, kein Alltag. Einen Tag ist reichlich konservativ. Die vorhandene Zusicherung `isPublicPath("/icon/32")` (`middleware.test.ts:71`) bleibt richtig; dazu gehört eine zweite nach dem Muster von `middleware.test.ts:200` („der Worker … darf zwischengespeichert werden"), die den matcher-Ausschluss festhält — ohne sie wandert das Icon beim nächsten Umbau der middleware zurück.

### N6. Die Wiederherstellung leert die Bildablage nach dem `commit`; `deleteTrip` schreibt elf Anweisungen ohne Transaktion (mittel)

Beide unverändert aus der letzten Review (dort N4 und N5), beide gemessen am Stand 99dcb6e — ich fasse sie zusammen, weil das Werkzeug dasselbe ist und die Zahl der Verwender unverändert **eins** beträgt:

```
$ grep -rn "withDatabaseClient" app lib --include=*.ts | grep -v test
app/api/backups/[id]/wiederherstellen/route.ts:2    (Import)
app/api/backups/[id]/wiederherstellen/route.ts:78   (der einzige Aufruf)
lib/db/pool.ts:19                                   (die Definition)
lib/backup/database.ts:163                          (ein Kommentar darauf)
```

**Die Wiederherstellung** (`lib/backup/store.ts:316-322`) steht Zeile für Zeile wie vor einer Woche: `restoreDatabase(client, dump)` committet (`:316`), danach `emptyDirectory(imageDir)` (`:318`, ein `rm -rf` über jeden Eintrag), danach `cp` (`:321`). Zwischen `commit` und Ende des `cp` liegt ein Fenster, in dem die Datenbank auf dem Stand des Backups ist und die Bildablage leer — der Zustand, den `delivery/stack.md` beim Namen nennt (*„Kein Bild ohne Datensatz, kein Datensatz ohne Datei"*). Die Empfehlung bleibt: kopieren nach `<imageDir>.neu`, dann wiederherstellen, dann zwei `rename`, zuletzt `<imageDir>.alt` entfernen — der unwiderrufliche Schritt wird der letzte.

**`deleteTrip`** (`lib/db/trips.ts:312-355`) führt unverändert elf `delete` nacheinander über den Pool aus, jedes möglicherweise auf einer anderen Verbindung. Die Signatur passt schon (`deleteTrip(db: Queryable, ...)`); der Aufrufer wechselt von `getPool()` auf `withDatabaseClient`, und `begin`/`commit`/`rollback` kommen dazu — wörtlich das Muster aus `lib/backup/database.ts:179-223`, das im Repo steht und getestet ist.

Dieselbe Familie, jetzt mit zwei weiteren Mitgliedern: `startRatingRound` (`lib/db/rating-rounds.ts:196-206`, ein `insert` für die Runde plus je POI eines), `createPois` (`lib/db/pois.ts`), und seit req-069 `setPoiStatuses` und `deletePois` (siehe N3).

### N7. Der `readBody`-Helfer steht inzwischen fünfzehnmal wortgleich im Repo (niedrig-mittel)

Die letzte Review hat ihn zweimal gefunden und empfohlen, ihn nach `lib/` zu ziehen und auf die vier nackten `request.json()` anzuwenden. Stattdessen ist er mitgewandert:

```
$ grep -rln "async function readBody" app | wc -l
15
```

Fünfzehn Dateien, und die fünf, die ich verglichen habe (`participants/account-admin`, `ki-planung`, `pois`, `kostenzeilen`, `transfers`), sind **zeichengleich** — dieselben zwölf Zeilen, derselbe Zeilenumbruch, dieselbe Einrückung. Das ist nicht mehr eine Duplizierung, das ist ein Muster, das sich selbst reproduziert: jede neue Route kopiert ihn von der Nachbarroute.

**Und die Lücke, die er schließen sollte, ist offen.** Diese Routen rufen `request.json()` unverpackt:

| Route | Stelle |
|---|---|
| `app/api/poi-status/route.ts` | `:23` |
| `app/api/search-area/route.ts` | `:23`, `:58` |
| `app/api/poi-search/route.ts` | `:44` |
| `app/api/poi-beschreibung/route.ts` | `:32` |
| `app/api/activity-option-selection/route.ts` | `:12` |
| `app/api/ort-aus-link/route.ts` | `:26` |

Sieben Stellen in sechs Dateien (zwei mehr als beim letzten Mal gezählt). Ein abgeschnittener Request-Body — im Mobilnetz keine Seltenheit, und der Begleiter läuft dort — wird als Serverfehler gemeldet statt als fehlerhafte Anfrage.

**Empfehlung:** `lib/api/read-body.ts` mit den zwölf Zeilen, daneben `istUuid()`, und beides in allen einundzwanzig Routen. Das ist ein Durchgang mit `sed`-Charakter und macht den nächsten Neubau billiger, statt ihn wieder kopieren zu lassen. Der Ort ist vorgezeichnet: `stack.md` (Conventions) verlangt, dass geteilte Logik nach `lib/` gehört.

### N8. Kleinigkeiten (niedrig)

- **`updateKostenzeile` beschränkt sich weiterhin nicht auf manuelle Zeilen.** `lib/db/kostenzeilen.ts:304-318` macht es bei `deleteKostenzeile` richtig (`where id = $1 and activity_id is null`); `updateKostenzeile` (`:231-246`) prüft nur den Account und delegiert an `aendere`, das ohne diese Bedingung schreibt. Unverändert offen. Ein `and activity_id is null` in `aendere`.
- **`startRatingRound` verlässt sich auf den Index, fängt ihn aber nicht.** `lib/db/rating-rounds.ts:179-183` prüft selbst auf eine laufende Runde und liefert `"laeuft"` → 409; gewinnt die zweite Anfrage das Rennen, löst `rating_round_eine_laufende_idx` aus und die Verletzung schlägt als 500 durch. Unverändert. Ein `catch` um das `insert` (`:198`), das den Unique-Verstoß auf `{ ok: false, reason: "laeuft" }` abbildet.
- **Die POI-Nummer wird weiterhin per Read-then-Write vergeben.** `lib/db/pois.ts:326`, `select max(number) ... + 1`, gegen `unique (trip_id, number)` aus `migrations/0014_poi_number.sql`. Unverändert; die Empfehlung bleibt das eine `insert ... (select coalesce(max(number), 0) + 1 ...)`.
- **Kein `.dockerignore` — und das ist mehr als Kontext-Ballast.** Vierte Review. Neu ist, was ich diesmal an der Reihenfolge im `deploy/Dockerfile` gesehen habe:
  ```dockerfile
  FROM node:22-alpine AS builder
  COPY --from=deps /app/node_modules ./node_modules   # das Ergebnis von npm ci im Abbild
  COPY . .                                            # ← überschreibt es mit dem des Hosts
  ```
  Ohne `.dockerignore` liegt `node_modules` im Build-Kontext (hier 744 MB, dazu 132 MB `.next` — 877 MB an den Daemon), und `COPY . .` legt die Kopie des Hosts über die, die `npm ci` gerade im Abbild gebaut hat. Die `deps`-Stufe wird damit wirkungslos, und der Bau hängt davon ab, dass die Pakete des Runners zum Abbild passen: Der Beelink-Runner installiert mit `npm ci` (Workflow-Schritt „Abhängigkeiten") für **sein** Betriebssystem, gebaut wird in `node:22-alpine` (musl). Plattformabhängige Pakete stehen im Lock reichlich — `@next/swc-linux-x64-gnu` neben `-musl`, zwanzig `@img/sharp-*`-Varianten. Ob es im Einzelfall trägt, entscheidet, welche optionale Variante npm auf dem Host ausgewählt hat; verlassen kann man sich darauf nicht. (Docker steht in dieser Umgebung nicht zur Verfügung, ich konnte den Bau nicht nachstellen — die Reihenfolge im Dockerfile und die Paketliste im Lock sind aber beide eindeutig.) Ein `.dockerignore` mit `node_modules`, `.next`, `.git`, `test-results`, `tsconfig.tsbuildinfo`, `.env*` löst beides: den Ballast und die Überschreibung.
- **Ein Kommentar im CSS verweist auf ein Pseudo-Element, das der Kommentar drei Zeilen darunter für entfallen erklärt.** `app/plan/components/poi-map.module.css:378` endet mit *„Das Pseudo-Element unten bezieht sich stattdessen auf den Marker-Container."*; `:382-384` sagt: *„Die Trefferflaeche kommt jetzt aus der sichtbaren Groesse (22px, erster Punkt 30px) statt aus einem Pseudo-Element."* Der erste Satz zeigt ins Leere. Zwei Zeilen streichen.
- **`CLAUDE.md:1` heißt weiterhin `# <Projektname>`** — vierte Review. Darunter steht unverändert der Einrichtungshinweis der appbaua-Umstellung (*„Sie ist ein Startpunkt — passe sie an und ersetze die Platzhalter"*). Die Datei ist die oberste bindende Anweisung des Repos und die einzige, die noch ihren Platzhalter trägt. Ein Wort: `# wegfara`. Ihr Inhalt ist im Übrigen aktuell und trägt.
- **Die Mock-Liste in `stack.md` nennt einen Dienst, den es nicht mehr gibt, und zwei nicht, die es gibt.** `delivery/stack.md:203` zählt auf: *„(OpenAI, Google Places, Nominatim, Overpass, OSRM)"*. `grep -rin overpass lib app components tests` liefert **keinen Treffer** — Overpass ist mit req-057 verschwunden. Dafür fehlen Open-Meteo (`lib/weather/open-meteo-client.ts:19`) und die EZB-Wechselkurse (`lib/expenses/exchange-rate.ts:29`). Dritte Review für Open-Meteo. Eine Zeile.
- **Fünf Kommentare verweisen weiterhin auf `bug-011`,** das es unter `delivery/bugs/` (auch nicht in `done/`) nicht gibt: `poi-map.tsx:328`, `:665`, `:796`, `split-view.tsx:107`, `lib/map/lifecycle.ts:24`. Unverändert fünf. Nachziehen oder umformulieren.
- **`lib/auth/tokens.ts:20` `secretsMatch` wird außerhalb seines Tests weiterhin nicht gerufen.** Unverändert; die Empfehlung bleibt, den Kommentar um einen Satz zu ergänzen, dass der Vergleich bewusst in der SQL-Bedingung stattfindet.
- **Typografie:** `app/plan/components/use-poi-status.ts:10` schreibt `„${pois[0].name}"` — deutsches Anführungszeichen unten, gerades oben. Der Rest des Repos ist sorgfältig (`lib/backup/import.ts:31-32` etwa `„datenbank.json“`). Ein Zeichen.

## Unverändert offen

Aus den Vorgänger-Reviews, geprüft am Stand 99dcb6e:

| Herkunft | Befund | Stand |
|---|---|---|
| 25.08. N2 | Kartenausschnitt wird bei jeder Zustandsänderung zurückgesetzt | ✅ **erledigt** — bug-048; `framedRef` hängt an Reise und Gebiet, nicht am sichtbaren Bestand (`poi-map.tsx:390-403`) |
| 18.08. #10 | Notfallcodes im Klartext-Cookie | ✅ **erledigt** — req-066 hat sie entfernt (elf Dateien gelöscht, `migrations/0046`); die Rückfallebene ist allein das hinterlegte Postfach |
| 01.09. N4 | Wetter aus dem Browser, Open-Meteo fehlt in `stack.md` | ⚠️ halb — `lib/weather/` ist saubere Domänenlogik, der Abruf läuft weiter aus dem Browser, `stack.md` nennt ihn nicht (N8) |
| 15.09. N1 | Planungskarte meldet die Worker-Adresse nicht | ❌ **unverändert, vierte Review — siehe N2** |
| 15.09. N2 | E2E-Bildschirmprüfung erreicht vier der sechs Planer-Bereiche nie | ❌ offen — **siehe unten** |
| 15.09. N3 | Keine Zeitlimits | ❌ offen, Außenkante um Faktor vier gewachsen — siehe N4 |
| 15.09. N4 | Wiederherstellung leert die Bildablage nach dem `commit` | ❌ offen — siehe N6 |
| 15.09. N5 | `deleteTrip` ohne Transaktion | ❌ offen, `withDatabaseClient` weiterhin ein Verwender — siehe N6 |
| 15.09. N6 | POI-Nummer per Read-then-Write | ❌ offen — siehe N8 |
| 25.08. N1 | Trefferflächen der Eckpunkt-Griffe 22 statt 44 px | ❌ offen — **siehe unten** |
| 25.08. N3 | Kommentare verweisen auf nicht existente Bugs | ❌ offen, unverändert fünf |
| 25.08. N5 | Kein `.dockerignore` | ❌ offen, **verschärft** — siehe N8 |
| 18.08. #2 | Schreib-Debounce aus `stack.md` existiert nirgends | ❌ offen — **siebte Review** |
| 18.08. #4, #6, #9 | Anmeldelink per GET; Rate-Limiter O(n); Secure-Flag am `x-forwarded-proto` | ❌ offen (alle drei mit dokumentierter Begründung im Code) |
| 18.08. #7 | Mehrschrittige Schreibvorgänge ohne Transaktion | ❌ offen, um zwei Fälle gewachsen — siehe N3, N6 |
| 18.08. #8 | Demo-Daten in den Schema-Migrationen | ❌ offen — `migrations/0002_seed_demo_data.sql`, `0015_auth.sql:77`, `0020_trip_participant.sql:28` |
| 01.09. N5 | `OSM_STYLE` dreimal | ❌ offen |
| Security 26.08. | alle acht, darunter der Transport-Befund | ❌ offen |
| 01.09. N6 / 18.08. #1, #3, #12, #13, #11 | TODO in `stack.md`; Mandantenprüfung; `response.ok`; `extractRequestedCount`; Backup; Overpass-Zitate | ✅ erledigt (Vorreview) |

**Drei davon verdienen einen Satz mehr:**

**Die E2E-Bildschirmprüfung (15.09. N2) ist nicht geschlossen, aber sie ist besser geworden.** Neu ist `tests/e2e/bildschirmpruefung.e2e.ts` — elf Fälle, die die Prüfung *selbst* gegen die vier Regeln aus `stack.md` fahren, mit von Hand gebauten Seiten, sodass jede Regel gezielt auslösbar ist. Der Fall zu bug-044 („in einer dichten Spalte gehört jedes Kästchen seinem eigenen Schalter") misst mit `elementFromPoint` an Ober-, Mittel- und Unterkante und ist ein Musterbeispiel dafür, wie man eine CSS-Aussage im echten Browser festnagelt. Was dabei nicht dazugekommen ist, ist ein Fluss durch die Bereiche. Der Grep über alle Flüsse liefert unverändert fünf Adressen:

```
tests/e2e/anmelden.e2e.ts:52      /einladung/passkey
tests/e2e/anmelden.e2e.ts:75      /plan
tests/e2e/anmelden.e2e.ts:110     /anmeldung
tests/e2e/poi-anlegen.e2e.ts:25   /plan
tests/e2e/poi-verplanen.e2e.ts:34 /plan
tests/e2e/reise-anlegen.e2e.ts:30 /plan
```

Vier Aufrufe von `/plan` ohne Parameter, `ACTIVE_PLAN_AREA` ist `"pois"` (`lib/plan/areas.ts:43`). **Planung, Bewertungen, Kosten, Dokumente und Reisedetails** werden weiterhin nie geöffnet. Die Lücke ist praktisch geschlossen, bevor man sie ausspricht: `planAreaPath()` (`:76`) liefert für jeden Bereich eine echte Adresse, `SWITCHABLE_PLAN_AREAS` (`:53`) die Liste, und die Fixture (`tests/e2e/fixtures.ts:72-79`) prüft jede geöffnete Adresse selbsttätig bei drei Breiten. Ein `for`-Loop über `SWITCHABLE_PLAN_AREAS` mit `await seite.goto(planAreaPath(area))` — sechs Zeilen für fünf ungeprüfte Oberflächen. **Und er fängt N2 nebenbei an der echten Anwendung.**

**Die 22-px-Griffe (25.08. N1), fünfte Review.** `poi-map.module.css:366-407` unverändert: `.vertexHandle` 22×22 px, `.vertexHandleFirst` 30×30 px, `.midpointHandle` 9×9 px. `stack.md` (Conventions, Regel 4) verlangt 44×44 px und lässt eine Ausnahme ausdrücklich zu — *„aber nur mit einem sichtbaren Hinweis statt einer kaputten Darstellung"*. Der fehlt. Dass dieselbe Datei 40 Zeilen darüber zeigt, wie es geht (`:328-329`, `min-height: 44px; min-width: 44px` am `.drawButton`), und dass `tests/e2e/bildschirmpruefung.e2e.ts` seit dieser Woche genau diese Bauart für dicht stehende Tippziele im echten Browser durchmisst, macht die Ausnahme erklärungsbedürftiger, nicht weniger. Entweder das `border: 7px solid transparent`-Muster auch für die Griffe — es kommt ohne `position: relative` aus und hätte bug-011 also nie ausgelöst —, oder die Ausnahme in `stack.md` festhalten.

**Der Schreib-Debounce (18.08. #2) steht in der siebten Review.** `delivery/stack.md:238-252` fordert unverändert: *„Schreibende Zugriffe werden im Datenzugriffs-Layer gebündelt und mit 15 Sekunden Verzögerung ausgeführt."* Ein Grep nach `nicht verzoegert`/`nicht gebuendelt` über `lib/` liefert **elf** Kommentare, die die Ausnahme in Anspruch nehmen — `lib/db/sessions.ts:116,146,176`, `lib/db/rating-rounds.ts:293`, `lib/db/account-api-keys.ts:62`, `lib/db/trip-positions.ts:58`, `lib/db/account-switches.ts:21`, `lib/expenses/save-expense.ts:32`, `lib/trips/save-trip-state.ts:8`, `lib/participants/save-account-admin.ts:19`, `lib/trip-participants/save-trip-participant.ts:19`, `lib/api-keys/save-api-key.ts:46`, `lib/invitations/request-invitation.ts:16`, `lib/accounts/save-account.ts:18` — und **keinen einzigen**, der sie anwendet. Jeder dieser Kommentare ist für sich gut begründet; zusammen sagen sie, dass die Vorgabe in dieser Form nicht getragen hat. Nach sieben Reviews ist eine dauerhaft unerfüllte bindende Vorgabe schlechter als beide Alternativen.

## Was in Ordnung war

- **Quality-Gate grün:** `npm run types` fehlerfrei, `npm run lint` fehlerfrei, **4013 Tests in 325 Dateien** bestanden (159,2 s), keine übersprungenen Tests, keine Warnungen. Bei 93 Commits sind 364 Tests dazugekommen; die Test-Policy aus `stack.md` wird gelebt, nicht zitiert.
- **req-071 ist die beste Arbeit dieser Strecke.** `lib/backup/zip.ts` und `unzip.ts` sind ein von Hand geschriebener ZIP-Schreiber und -Leser, und zwar einer, der die Dinge tut, die man in solchem Code fast nie findet: Gelesen wird über das zentrale Verzeichnis am Ende, *„so steht vor dem ersten geschriebenen Byte fest, was drinsteckt und ob etwas fehlt"*; jeder Eintrag läuft als Strom durch eine `mitPruefsumme`-Generatorstufe und wird gegen seine CRC32 gehalten (`unzip.ts:222-233`); ZIP64 ist auf beiden Seiten gebaut und getestet (`zip.test.ts:111-130`, `unzip.ts:83-100`), weil ein Backup mit vielen Bildern die 4-GB-Grenze reißt. Nichts wird im Ganzen in den Speicher geladen — die Tests prüfen sogar das (*„packt grosse Dateien nicht in den Arbeitsspeicher, sondern stueckweise"*).
- **Und der Pfad-Ausbruch ist richtig zugemacht.** `lib/backup/import.ts:38-48`: `uebernommen()` ist eine **Positivliste**, kein Filter — ein Eintrag zählt nur, wenn er genau `datenbank.json` oder `manifest.json` heißt oder mit `bilder/` beginnt, und zusätzlich fallen `\`, führendes `/` und jedes `..`-Segment heraus. Das ist die Reihenfolge, die hält: erst erlauben, dann verbieten. Ein eigener Test deckt es ab (*„laesst einen Eintrag ausserhalb der Ablage links liegen"*), und der Aufbau läuft in `mkdtemp(".eingespielt-")`, dessen Name absichtlich nicht zum Muster einer Backup-Kennung passt — *„so taucht ein abgebrochener Lauf nicht in der Liste auf"*. Auch `backupArchivName` (`lib/backup/format.ts:44-49`) putzt die Umgebung, bevor sie in den `Content-Disposition`-Kopf gerät. Bei selbstgeschriebenem Archivcode ist das der Teil, an dem es üblicherweise scheitert; hier nicht.
- **req-072 hält die Regel „kein Bild ohne Datensatz" in beide Richtungen ein.** `app/api/poi-ki-bild/route.ts:83-105`: erst die Datei, dann der Datensatz, und schlägt der Datensatz fehl, wird die Datei wieder entfernt (`store.remove(fileName).catch(() => {})`) — mit dem Satz dazu, warum. Der Zugangsschlüssel kommt aus dem Account, in dem gearbeitet wird, nie aus der Umgebung (`:55-62`, req-028), der POI wird über `findPoi(db, session.accountId, poiId)` geholt, und jeder Fehlschlag trägt einen benannten Grund statt eines `null` (`AI_FEHLER_TEXT`, bug-021/bug-032). Vier Bugs aus der Vergangenheit sind hier in einem Handler beantwortet.
- **Der Kontrast des neuen Zeitpuffers ist gegen die richtige Fläche geprüft.** `components/farbwelt.kontrast.test.ts:147-173` liest `--hint-bg` aus dem Stylesheet und rechnet die durchscheinende Fläche des Transfer-Blocks über `--card-alt` aus, statt bequem gegen `--card` zu messen: *„geprueft wird deshalb gegen die Farbe, die dabei [entsteht]"*. Das ist genau, was `stack.md` verlangt (*„Maßgeblich ist die Fläche, auf der die Schrift tatsächlich liegt"*) — und die Sorte Genauigkeit, die man in einem Kontrasttest fast nie sieht.
- **req-073 trennt Rechnung und Darstellung sauber.** `zeitpuffer()` (`lib/transfers/luecke.ts:57-67`) liefert `minuten`, `text` und `passt` und baut auf den vorhandenen `lueckeMinuten`/`passtInLuecke` auf — keine zweite Rechnung daneben, wie das Requirement es fordert. Das Vorzeichen trägt dieselbe Aussage wie die Farbe, damit die Anzeige ohne Farbunterscheidung eindeutig bleibt; das steht als Constraint im Requirement und als Kommentar im Code. Der Grenzfall „keine Lücke" ergibt `−35 Min` und nicht `±0` — geprüft und richtig.
- **`lib/auth/entsperrung.ts` beschreibt ein echtes Browser-Verhalten statt es zu raten.** `GESTE_GRENZE_MS = 250`, mit der vollständigen Begründung: Safari weist `navigator.credentials.get()` ohne Geste mit demselben `NotAllowedError` ab, mit dem auch ein Abbruch durch den Nutzer kommt — *„Unterscheiden laesst sich beides nur an der Dauer."* Dazu `lib/auth/geraete-merker.ts`, das in seinem eigenen Kommentar festhält, warum der Merker **kein** Zugangsnachweis ist (*„Wer ihn faelscht, bekommt eine Entsperrung, die niemanden kennt"*) und das Safari-Wegwerfverhalten im privaten Modus abfängt. Eine Anmeldung, die auf Geräte-Eigenheiten trifft, und ein Autor, der sie aufgeschrieben hat.
- **`lib/backup/tables.ts` schützt sich gegen sein eigenes Veralten.** 27 Tabellen in Fremdschlüssel-Reihenfolge, von Hand gepflegt mit dem Grund dafür (*„die kennt PostgreSQL zwar, die Datenbank im Arbeitsspeicher der Tests aber nicht"*) — und `tables.test.ts` prüft die Liste gegen das Schema der Migrationen, sodass eine neue Tabelle ohne Eintrag den Test rot macht. Ich habe es gegengerechnet: alle 29 je angelegten Tabellen sind erfasst oder wieder gelöscht (`guest_access`, `guest_session` in `0033`, `recovery_code` in `0046`); `schema_migrations` steht mit Begründung in `EXCLUDED_TABLES`. Ein Backup, das eine Tabelle vergisst, ist der leiseste Datenverlust, den es gibt — hier kann er nicht passieren.
- **bug-050 ist an beiden Enden geschlossen.** `lib/trips/laenge.ts` legt die Grenze an einer Stelle fest (60 Tage, mit dem Grund: *„sie soll ein verrutschtes Jahr abfangen … nicht die Reise eines Aussteigers verbieten"*) und bildet den Hinweis einmal für Formular und Schnittstelle — *„ein Aufruf an der Oberflaeche vorbei soll eine solche Reise genauso wenig unbemerkt anlegen koennen"*. Genau so steht es dann auch in `app/api/trips/route.ts:126-140`. Ein Bug, dessen Fix nicht nur den Weg schließt, auf dem er auftrat.
- **`.github/workflows/deploy-prod.yml` hält `devops.md` exakt ein**, inklusive der Teile, die man weglassen könnte: kein `push`-Trigger, `workflow_dispatch` mit Tippbestätigung, Quality-Gate (Unit **und** E2E) **vor** dem Backup, Backup über die Anwendungsfunktion statt über ein eigenes Skript — mit der Begründung, warum das die richtige Wahl ist (*„nur so passen beide Haelften zueinander, und nur so laesst sich das Ergebnis in der Anwendung wieder einspielen"*) — und ein Sonderfall für den allerersten Deploy, bei dem noch keine Instanz antwortet. Auch die festgenagelte Node-Version trägt ihre Geschichte bei sich.

## Empfohlene Reihenfolge

Vorbemerkung: Die Punkte 1 bis 3 sind zusammen unter einer Stunde Arbeit und schließen einen Befund ab, der vier Reviews alt ist. Sie stehen absichtlich vor allem anderen.

1. **N2 Schritt 1+2** — `linien()` in `day-route-map.test.tsx:71-74` auf `querySourceFeatures` umstellen (Repro-Test, schlägt fehl), dann `ensureMapWorkerUrl()` in `day-route-map.tsx:173` (Fix, Test wird grün). Zwei Zeilen Produktivcode. Danach zeigt die Tageskarte auf allen Wegen ihre Linien, und die fünf vorhandenen Tests sind echte Zusicherungen statt Fehlanzeigen.
2. **N2 Schritt 3** — die Struktur-Zusicherung „jede Datei mit `new MapLibreMap(` enthält `ensureMapWorkerUrl(`", nach dem Muster `app/api/api-guard.test.ts:53`. Zehn Zeilen. Sie fängt die vierte Karte ab, bevor sie geschrieben ist, und beendet die Serie.
3. **15.09. N2** — ein E2E-Fluss `for (const area of SWITCHABLE_PLAN_AREAS) await seite.goto(planAreaPath(area))`. Sechs Zeilen, fünf bisher ungeprüfte Oberflächen bei drei Breiten, und er fängt Punkt 1 an der echten Anwendung. Vor jeder weiteren Layout-Arbeit im Planer.
4. **N1** — `testTimeout` in `vitest.config.ts` hoch und die drei `userEvent`-Tipptests auf `fill()`/`paste()` umstellen. Solange das Gate unter Last umfallen kann, ist jede rote Ampel im prod-Deploy zweideutig — und Punkte 1 bis 3 arbeiten gegen dieses Gate.
5. **N3** — `setPoiStatuses` auf ein `update ... where id = any($1::uuid[])` zusammenziehen und die Route den Fehler fangen lassen. Die Schleife ist der einzige Ort im Repo, an dem ein Abbruch heute zu einer Anzeige führt, die *pessimistischer* ist als die Ablage — und das Statement erledigt den UUID-Teil von N7 gleich mit.
6. **N5** — `ICON_BASIS_PFAD` in den matcher-Ausschluss, `Cache-Control: public, max-age=86400` im Route-Handler, dazu eine Zusicherung für den Ausschluss. Drei Zeilen, und die häufigste Anfrage der App kostet nichts mehr.
7. **N4** — Zeitlimits (zehn Aufrufstellen plus zwei OpenAI-Zeilen) und die bis zu 160 Aufrufe nebenläufig statt nacheinander. Punkt 3 (Nebenläufigkeit) ist der, den der Nutzer sofort merkt, und er ist unabhängig von den Zeitlimits richtig.
8. **N6** — `deleteTrip` in eine Transaktion und die Reihenfolge der Wiederherstellung umdrehen (zwei `rename` statt eines `rm -rf`). Gemeinsam anzufassen: dasselbe Thema, das Werkzeug liegt seit req-053 bereit und ist einmal erfolgreich benutzt.
9. **25.08. N1** — Trefferflächen der Griffe, fünfte Review. Das `border: 7px solid transparent`-Muster aus `.drawButton` löst es ohne `position: relative` und damit ohne bug-011. Alternativ die Ausnahme in `stack.md` festhalten — aber nicht weiter stumm gegen eine bindende Vorgabe verstoßen.
10. **N7 + N8** — `readBody` und `istUuid` nach `lib/api/`, in alle einundzwanzig Routen; `and activity_id is null` in `aendere`; `catch` in `startRatingRound`; POI-Nummer per SQL; `.dockerignore`; `CLAUDE.md:1`; die Mock-Liste in `stack.md`; die fünf bug-011-Verweise; der doppelte CSS-Kommentar; das Anführungszeichen. Ein Durchgang.
11. **18.08. #2** (Schreib-Debounce) — oder die Entscheidung, `stack.md:238-252` auf das umzuschreiben, was elf Kommentare inzwischen einhellig sagen. Nach sieben Reviews ist die Entscheidung überfällig, in welche Richtung auch immer.

---

**Zur Arbeitsweise dieser Review:** Ausgeführt wurden `npm run types`, `npm run lint` und `npm test` am Stand 99dcb6e. Der erste `npm test`-Lauf lief nebenläufig zu Typprüfung und Lint und endete mit drei Zeitüberschreitungen (siehe N1); die drei Tests laufen einzeln durch, und der Wiederholungslauf ohne Nebenlast ist vollständig grün (4013 Tests in 325 Dateien, 159,19 s). Dieser zweite Lauf ist die Aussage über den Zustand des Repos; der erste ist der Befund N1. `npm run test:e2e` wurde nicht ausgeführt: der Lauf verlangt einen PostgreSQL-Server (`E2E_DATABASE_URL`, PG\*-Variablen oder Docker), und in dieser Umgebung steht keines davon zur Verfügung — die E2E-Aussagen stammen aus der Quelltextanalyse der Flüsse und der Fixture, nicht aus einem Lauf. Die Aussage zum Docker-Build in N8 stammt aus `deploy/Dockerfile`, `package-lock.json` und dem Workflow; Docker ist hier nicht installiert, den Bau konnte ich nicht nachstellen. Drei Befunde habe ich mit Wegwerf-Testdateien empirisch bestätigt und die Dateien wieder entfernt: N2 (`DayRouteMap` allein — `workerUrl=""`, gesetzt=1, verarbeitet=0), N3 (`setPoiStatuses` mit einem Fehlschlag beim dritten Aufruf — zwei POIs geschrieben, Fehler kommt durch), N5 (`config.matcher` und `middleware()` für `/icon/180` — matcher greift, `Cache-Control: no-store`). `git status` ist sauber. Der Stand der Vorbefunde stammt aus gezielten Greps und dem Lesen der betroffenen Stellen. Es wurde nichts committet oder gepusht. Kein Zugriff auf prod, keine Datenbank angefasst, kein Netzaufruf nach außen.
