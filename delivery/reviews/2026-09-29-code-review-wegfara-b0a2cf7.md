---
type: code-review
repo: Wegfara
commit: b0a2cf7
date: 2026-09-29
---

# Code-Review: Wegfara (b0a2cf7)

Automatisch erstellt vom appbaua-Worker am 2026-09-29.

Review abgeschlossen. Hier ist der vollständige Bericht.

---
---
type: code-review
repo: wegfara
commit: b0a2cf7
date: 2026-09-29
---

# Code-Review: wegfara (b0a2cf7)

Automatisch erstellt vom appbaua-Worker am 2026-09-29. Vorgänger: [2026-09-22 (99dcb6e)](2026-09-22-code-review-wegfara-99dcb6e.md).

## Kurz-Zusammenfassung

`npm run types` fehlerfrei, `npm run lint` fehlerfrei. `git rev-list --count 99dcb6e..HEAD` liefert **61 Commits** — req-074 bis req-079 und die Bugs 052 bis 059. Der Schwerpunkt der Strecke ist die Oberfläche: die Kopfleiste des Planers ist einer Seitenleiste gewichen (req-077/078), der Zeitstrahl lässt sich zoomen (req-076), die Tageskarte trägt Richtungspfeile (req-075), POI-Nummern stehen jetzt überall dieselben (req-074, bug-055), und die Kachel des Begleiters zeigt Foto, Links und Buchungszustand (req-079). Die Testsuite ist auf **4366 Tests in 342 Dateien** gewachsen (+353 Tests, +17 Dateien).

**Der Testlauf selbst ist der erste Befund.** Die letzte Review hat drei Zeitüberschreitungen gemeldet und festgehalten, der Lauf *ohne Nebenlast* sei vollständig grün. Das gilt nicht mehr: mein erster `npm test` lief ohne jede Nebenlast und endete mit **zwei** Zeitüberschreitungen; der zweite, ebenfalls ohne Nebenlast, war grün. Dasselbe Gate, zweimal hintereinander, zwei verschiedene Ergebnisse — und es ist das Gate, das vor jedem prod-Deploy läuft.

**Der schwerwiegendste inhaltliche Befund ist, dass req-079 auf ein Feld baut, das die Anwendung nie schreibt.** Die neue Anzeige „Gebucht" / „Noch nicht gebucht" hängt an `activity.booked`, `bookingUrl`, `bookingEmail`, `bookingPhone`. Diese vier Spalten werden von genau zwei Stellen gefüllt: der Migration `0007_activity_booking.sql` und `seed/demo-daten.sql` — beide setzen sie auf vier fest verdrahtete Demo-Kennungen. `createActivity` schreibt sie nicht, `ActivityValues` kennt sie nicht, ein `update` darauf gibt es nicht. Für jeden Programmpunkt, den ein Nutzer anlegt, liefert `buchungszustand()` `null`; die neue Anzeige erscheint nie. Das Requirement hat sich dabei auf eine falsche Voraussetzung gestützt: sein „Out of Scope" sagt *„Den Buchungszustand im Begleiter ändern (das kann req-005 schon)"* — req-005 kann es nicht, und sagt das selbst (*„Zur Erprobung enthalten die Programmpunkte alle vier Fälle"*).

**Und bug-013 in der Planungskarte steht in der fünften Review.** Ich habe es am Stand b0a2cf7 erneut selbst gemessen: `workerUrl="" gesetzt=1 verarbeitet=0`. Neu ist, was diese Strecke darauf gebaut hat: req-075 hat derselben Karte Richtungspfeile gegeben, und die sind **Marker** — die brauchen den Worker nicht. Gemessen: Pfeile aus → 2 Marker, Pfeile an → 3 Marker, Linie gesetzt, **verarbeitet 0**. Auf dem Bildschirm heißt das: Punkte und Pfeile stehen da, die Linie darunter fehlt. bug-059 hat anschließend die Farbe von Linie und Pfeil so gesetzt, dass sie sich vom hellen Kartengrund abheben — für eine Linie, die auf dieser Karte gar nicht gezeichnet wird.

Dazu: der neue Zoom überlebt den Bereichswechsel nicht (gemessen 672 → 1344 → 672), obwohl sein Kommentar behauptet, er verhalte sich „wie die Filter" — die ebendiese Strecke ausdrücklich dagegen abgesichert hat. Und „Mehr lesen" leert die Kachel des Begleiters vollständig, wenn der POI keinen Langtext hat.

## Neue Befunde

### N1. req-079 zeigt einen Buchungszustand, den die Anwendung nicht erzeugen kann (hoch)

Die Kachel des Begleiters trägt seit req-079 die Antwort auf „ist es gebucht?" — ausdrücklich *„ohne sie aus dem Vorhandensein eines Knopfes zu erschließen"*. Die Logik ist sauber und gut kommentiert (`lib/activities/booking.ts:54-66`):

```ts
export function buchungszustand(activity): Buchungszustand | null {
  if (activity.booked) return "gebucht";
  const zuBuchen =
    activity.bookingUrl || activity.bookingEmail || activity.bookingPhone;
  return zuBuchen ? "offen" : null;
}
```

`null` heißt „hier ist nichts zu buchen" — dann steht auf der Kachel weder „gebucht" noch „offen" (`activity-card.tsx:144-153`). Genau das ist der Fall, der in der Praxis immer eintritt.

**Woher die vier Felder kommen:**

```
$ grep -rn "booking_email|booking_phone|booking_url|\bbooked\b" migrations lib/db app/api
migrations/0007_activity_booking.sql:3   alter table activity add column booked ...
migrations/0007_activity_booking.sql:14  update activity set booked = true where id = '6460c010-…'
migrations/0007_activity_booking.sql:16  update activity set booking_url   = '…' where id = '384d0b94-…'
migrations/0007_activity_booking.sql:18  update activity set booking_email = '…' where id = '6d0ed984-…'
migrations/0007_activity_booking.sql:20  update activity set booking_phone = '…' where id = 'deaacefe-…'
seed/demo-daten.sql:159-166              dieselben vier, "zuvor migrations/0007_activity_booking.sql"
lib/db/activities.ts:43-46               gelesen (toActivity)
lib/db/activities.ts:53,58               gelesen (ACTIVITY_COLUMNS)
```

Geschrieben wird nirgends sonst. `createActivity` (`lib/db/activities.ts:100-104`) führt in seiner Spaltenliste `id, trip_id, poi_id, type, title, short_text, long_text, start_at, end_at, lat, lng` — keine der vier. Das einzige `update` auf `activity` ist `updateActivityTimes` (`:166`), und `ActivityValues` (`lib/activities/types.ts:49-62`) hat die Felder gar nicht. Es gibt also keinen Weg, sie zu setzen — weder über die Oberfläche noch über die Schnittstelle.

**Die Folge, dreifach:**

| Was req-079 gebaut hat | Wann es erscheint |
|---|---|
| „Gebucht" / „Noch nicht gebucht" auf der Kachel | nur bei vier Demo-Programmpunkten |
| E-Mail-Symbol auf der Kachel (`activity.bookingEmail`) | nur bei einem Demo-Programmpunkt |
| Telefon-Rückfall (`activity.bookingPhone`, wenn der POI keine Nummer führt) | nur bei einem Demo-Programmpunkt |

Die Telefonnummer des POI (`poi.phone`) trägt der Fall dagegen zuverlässig — nur der *Rückfall* auf den Programmpunkt ist tot.

**Das Requirement selbst trägt die falsche Voraussetzung.** `delivery/requirements/done/req-079-…md:122` führt unter „Out of Scope": *„Den Buchungszustand im Begleiter ändern (das kann req-005 schon)."* req-005 kann es nicht. Es hat die **Anzeige** und den **Buchungs-Knopf** gebaut, der nach außen verlinkt, und schreibt in seiner eigenen Beschreibung: *„Zur Erprobung enthalten die Programmpunkte alle vier Fälle: gebucht, …"* — also Demo-Daten, keine Eingabe. Der Implementierer hat die Zeile zu Recht als gegeben genommen; sie war es nicht. Alle vier Akzeptanzkriterien zum Buchungszustand sind abgehakt, und sie sind auch erfüllt — gegen die Demo-Daten.

**Warum das „hoch" ist:** Es ist kein kaputter Code, sondern fertige Arbeit ohne Wirkung — die teuerste Sorte. Die Vision sagt *„weniger Funktionen, aber fertig, statt mehr und roh"*; eine Anzeige, die kein Nutzer je sieht, ist die Gegenprobe darauf. Und der Befund verzahnt sich mit einem alten: „Demo-Daten in den Schema-Migrationen" (18.08. #8) ist jetzt nicht mehr bloß unsauber, sondern **tragend** — `migrations/0007` ist der einzige Erzeuger der Daten, die req-079 liest. Wer die Demo-Daten dort irgendwann herausnimmt, entfernt damit das letzte Vorkommen der neuen Anzeige.

**Empfehlung, in dieser Reihenfolge:**

1. **Zuerst entscheiden, nicht bauen.** Entweder der Buchungszustand wird pflegbar (ein Haken am Programmpunkt, dazu Kontaktweg-Felder — das wäre ein eigenes Requirement in der Area „Planung"), oder req-079s Buchungsanzeige wird zurückgenommen. Beides ist vertretbar; der jetzige Zustand ist es nicht.
2. **Bis dahin die Lücke sichtbar machen.** Eine Zusicherung nach dem Muster von `app/api/api-guard.test.ts:53`: „jedes Feld, das `buchungszustand()` liest, wird von mindestens einer `insert`- oder `update`-Anweisung in `lib/db/` geschrieben." Zehn Zeilen, und sie wäre heute rot — das ist der Repro-Test, den `stack.md` (Testing, reproduce-first) verlangt.
3. `delivery/requirements/done/req-079-…md:122` korrigieren: req-005 kann es nicht. Eine Zeile, aber sie ist die Ursache des Befunds.

### N2. Das Quality-Gate fällt jetzt auch ohne Nebenlast um — zweimal gemessen (hoch)

Die letzte Review hat drei Zeitüberschreitungen gemeldet und sie damit erklärt, dass der Lauf nebenläufig zu `npm run types` und `npm run lint` lief; der Wiederholungslauf ohne Nebenlast sei vollständig grün gewesen. Diese Erklärung trägt nicht mehr.

**Lauf 1** (Typprüfung und Lint waren zu diesem Zeitpunkt beide beendet, keine weitere Arbeit parallel):

```
 Test Files  2 failed | 340 passed (342)
      Tests  2 failed | 4364 passed (4366)
   Duration  177.12s
```

Beide Fehlschläge derselbe `Error: Test timed out in 5000ms.`

| Datei | Test |
|---|---|
| `app/plan/plan-view.test.tsx:397` | „zeigt einen von Hand angelegten POI nach einem Wechsel des Planer-Bereichs weiterhin" |
| `app/plan/components/poi-form.test.tsx:763` | „nimmt einen Kurztext mit 200 Zeichen an" |

**Lauf 2**, unmittelbar danach, ebenfalls ohne Nebenlast:

```
 Test Files  342 passed (342)
      Tests  4366 passed (4366)
   Duration  122.24s
```

**Und einzeln laufen die Betroffenen mit großem Abstand durch:**

```
$ npm test -- app/plan/components/poi-form.test.tsx
  ✓ nimmt einen Kurztext mit 200 Zeichen an          868ms
  ✓ lässt das 201. Zeichen des Kurztextes nicht ins Feld  841ms
  Test Files  1 passed (1)   Tests  68 passed (68)   Duration  12.41s
```

868 ms allein, über 5000 ms im Verband. Der Unterschied zwischen den beiden Gesamtläufen — 177 s gegen 122 s, ein Schwanken von 45 % — sagt dasselbe: die Laufzeit einzelner Tests hängt hier nicht am Test, sondern daran, wie viele Arbeiter gerade um dieselben Kerne konkurrieren. `vitest.config.ts` setzt unverändert **kein** `testTimeout`, es gilt die Voreinstellung von 5000 ms, und die Suite ist seit der letzten Review um weitere 353 Tests gewachsen.

**Warum das mehr ist als eine Unschönheit — unverändert gültig:** `.github/workflows/deploy-prod.yml` führt `npm test` und `npm run test:e2e` auf dem self-hosted Runner aus, also auf dem Beelink, auf dem laut `delivery/devops.md` gleichzeitig **beide** Umgebungen mit eigenen Containern und eigenem PostgreSQL laufen. Das ist per Konstruktion die belastete Maschine. Ein abgelaufener Test dort bricht den Job ab, bevor der Backup-Schritt kommt. Der Kommentar zur festgenagelten Node-Version im Workflow nennt den Fall selbst beim Namen: *„ein Quality-Gate, das an der Umgebung scheitert statt am Code, haelt nichts auf."*

Neu gegenüber der letzten Review ist die Beweislage: damals ließ sich der Fehlschlag noch auf meine eigene Nebenlast schieben. Jetzt nicht mehr. Die Ampel im prod-Deploy ist ab hier zweideutig, und zwar bei jedem Lauf.

**Empfehlung** (unverändert, jetzt dringender):

1. `testTimeout: 15000` in `vitest.config.ts`. Eine Zeile. Sie versteckt keinen echten Hänger — ein tatsächlich blockierter Test läuft nicht 15 s, er läuft unbegrenzt.
2. Die tippenden Tests entschärfen: `user.paste()` bzw. `fill()` statt `type()` für die langen Zeichenketten. Sie prüfen dieselbe Zusicherung in Millisekunden statt in einer Sekunde. Betroffen sind die beiden aus Lauf 1 und die dritte aus der letzten Review (`poi-form.test.tsx:774`).
3. Beides zusammen, nicht eines davon.

### N3. bug-013 in der Tageskarte — fünfte Review, und req-075 hat darauf gebaut (hoch)

Der Befund steht seit dem 15.09. als N1, war in der Review vom 01.09. eine Vorhersage und stand in der letzten Review als Punkt 1 der empfohlenen Reihenfolge. Am Stand b0a2cf7 ist nichts davon umgesetzt.

**Die Kette, frisch gemessen:**

```
$ grep -rn "new MapLibreMap(" --include=*.tsx app lib components | grep -v test
app/go/components/map-view.tsx:202
app/plan/components/day-route-map.tsx:281
app/plan/components/poi-map.tsx:757

$ grep -rn "ensureMapWorkerUrl" --include=*.tsx app lib components | grep -v '\.test\.'
app/go/components/map-view.tsx:19, :201      ← unmittelbar vor der Karte
app/plan/components/poi-map.tsx:47, :756     ← unmittelbar vor der Karte
lib/map/worker-url.ts:16                     ← die Definition
```

Zwei von drei Karten melden die Worker-Adresse, `day-route-map.tsx` nicht — obwohl die Datei in dieser Strecke um 214 Zeilen gewachsen ist. Und `day-route-map.test.tsx:95-97` liest unverändert die falsche Hälfte des Nachbaus:

```js
function linien() {
  const source = MapLibreMap.live().getSource("day-route-lines");
  return (source?.data.features ?? []) as GeoJSON.Feature[];
}
```

`.data` ist im Nachbau ausdrücklich „gesetzt", nicht „verarbeitet" — `tests/mocks/maplibre-gl.ts:60-86` modelliert den Unterschied exakt und schreibt selbst dazu, warum: *„Wie in maplibre-gl: liefert nur, was die Bibliothek aus den Daten tatsaechlich gemacht hat. Der Unterschied zu getSource(id).data ist genau der Fehler aus bug-013."* Der Nachbau ist richtig; die Tests fragen die falsche Seite davon ab.

**Eigene Messung am Stand b0a2cf7** (Wegwerf-Testdatei unter `app/plan/components/`, die `DayRouteMap` allein rendert; danach entfernt, `git status` sauber):

```
workerUrl=""  gesetzt=1  verarbeitet=0
```

Eine Linie liegt in der Quelle, **null** werden verarbeitet. Das ist derselbe Messwert wie vor einer und wie vor zwei Wochen.

**Was diese Strecke hinzugefügt hat, macht es schlimmer, nicht besser.** req-075 hat derselben Karte Richtungspfeile gegeben — und die hängen als **Marker** an der Karte, nicht als Ebene darin. Das ist eine bewusste und gut begründete Entscheidung (`day-route-map.tsx:233-238`: *„so behalten sie auf jeder Zoomstufe dieselbe Groesse"*), und der Code weiß auch, was daran hängt (`:374`: *„Marker brauchen -- anders als Quellen und Ebenen -- keinen geladenen Stil"*). Genau deshalb sind die Pfeile von bug-013 nicht betroffen. Gemessen, dieselbe Wegwerfdatei:

```
pfeile_aus=2  pfeile_an=3  workerUrl=""  gesetzt=1  verarbeitet=0
```

Zwei POI-Marker, nach dem Einschalten ein dritter für den Pfeil — alle drei zeichnen. Die Linie unter ihnen nicht. **Der Nutzer sieht auf der Planungskarte also Punkte und einen Pfeil, der ins Leere zeigt.**

Und bug-059 hat anschließend genau diese Farbfrage bearbeitet. `lib/map/routenfarbe.ts` ist für sich vorbildlich — ein Wert, ein Grund, ein Kontrasttest gegen den Kartengrund:

> *„Linie und Pfeil trugen den Akzent des Planers … und erreichten auf dem hellen Kartengrund nur 1,49:1 — man musste sie suchen (bug-059)."*

Die Pfeile heben sich jetzt ab. Die Linie, deren Kontrast im selben Atemzug behoben wurde, wird auf dieser Karte nicht gezeichnet. Ein Bugreport über schlecht sichtbare Linien auf einer Karte, die keine Linien zeigt, ist das deutlichste Zeichen dafür, dass der Befund nicht durchdringt.

**Empfehlung — unverändert drei Schritte, in dieser Reihenfolge:**

1. `linien()` in `day-route-map.test.tsx:95-97` auf `querySourceFeatures("day-route-lines")` umstellen. **Die bestehenden Tests schlagen dann fehl** — das ist der Repro-Test.
2. `ensureMapWorkerUrl()` vor `new MapLibreMap(...)` in `day-route-map.tsx:281`. Eine Zeile plus Import; die Tests werden grün.
3. Die Struktur-Zusicherung nach dem Muster von `app/api/api-guard.test.ts:53`: „jede Datei mit `new MapLibreMap(` enthält auch `ensureMapWorkerUrl(`". Zehn Zeilen. Bei drei Karten, einem Ausreißer und fünf Reviews ist das die einzige Maßnahme, die den sechsten Bericht verhindert.

Zusammen unter einer halben Stunde. Danach zeigt die Tageskarte ihre Linien, die fünf vorhandenen Tests sind echte Zusicherungen statt Fehlanzeigen, und der Kontrast aus bug-059 wird zum ersten Mal wirksam.

### N4. Der Zoom überlebt den Bereichswechsel nicht — und sein Kommentar behauptet das Gegenteil (mittel-hoch)

req-076 hat den Zeitstrahl zoombar gemacht, req-078 die Stufen nachgezogen. Die Domänenlogik dazu (`lib/plan/timeline-zoom.ts`) ist die beste Datei dieser Strecke — dazu unten. Der Zustand daneben ist es nicht.

Der Zoom liegt in `PlanungView` (`app/plan/components/planung-view.tsx:143`):

```ts
const [hourHeightPx, setHourHeightPx] = useState(ZOOM_GRUNDSTUFE_PX);
```

Und `PlanungView` wird nur gerendert, solange der Bereich „Planung" offen ist (`app/plan/plan-view.tsx:686`: `activeArea === "planung" ? <PlanungView … />`). Beim Bereichswechsel unmountet sie — `plan-view.tsx` sagt das an vier Stellen selbst, immer als Begründung dafür, warum ein Zustand *nicht* dort liegen darf: *„Die Liste liegt hier und nicht in PoisView, da diese beim Wechsel des Planer-Bereichs unmountet."*

**Gemessen** (Wegwerf-Test, danach entfernt): Zoom zweimal vergrößern, in „POIs" wechseln, zurück in „Planung":

```
grund=672  gezoomt=1344  nachWechsel=672  zoom_ueberlebt=false
```

**Der Kommentar am Zustand sagt etwas anderes** (`planung-view.tsx:137-142`):

> *„Gespeichert wird er nicht -- ein Neustart der App und ein Wechsel der Reise setzen ihn zurueck (wie die Filter, bug-052)."*

Der Vergleich mit den Filtern ist gerade falsch. Die Filter der POI-Liste **überleben** den Bereichswechsel — das ist genau, was bug-052 in dieser Strecke behoben hat: sie sind nach `PlanView` gewandert und liegen zusätzlich in der Sitzungsablage (`lib/pois/ansicht-einstellungen.ts`, `plan-view.tsx:222-242`). Der Zoom hat diese Behandlung nicht bekommen, der Kommentar behauptet aber, er verhalte sich gleich. Zwei Dateien weit auseinander sagen widersprüchliche Dinge über dasselbe Verhalten — und der Kommentar ist die Stelle, an der der nächste Bearbeiter nachsieht.

**Dieselbe Familie, eine Reihe weiter:** `selectedDate` (`planung-view.tsx:117`) liegt ebenfalls dort. Wer am 21. Juli plant, in „Kosten" wechselt und zurückkommt, steht wieder am Vorgabetag. Das ist nicht neu, fällt aber mit der Seitenleiste stärker auf: sie zeigt alle sechs Bereiche zugleich und macht das Wechseln zur Normalbedienung — vorher war es ein Schieben in einer Kopfleiste.

**Empfehlung:** `hourHeightPx` und `selectedDate` nach `PlanView` heben, wo Filter, Kartenstatus, POIs, Programmpunkte, Transfers und Optionswahl schon liegen — und beide durch `speichere…`/`lade…` in `lib/pois/ansicht-einstellungen.ts` aufnehmen (die Datei ist dafür gebaut, je Reise ein Schlüssel, Prüfung Feld für Feld). Der Zoom gehört dabei gegen `ZOOM_STUFEN_PX` geprüft, nicht bloß auf „ist eine Zahl": ein alter Eintrag mit 96 px läge sonst zwischen zwei Stufen. Zwei Zustände umziehen, zwei Prüffunktionen, dazu je ein Test „überlebt den Bereichswechsel" — nach dem Muster, das `plan-view.test.tsx` für die Filter schon enthält. Und der Kommentar in `planung-view.tsx:137-142` wird richtig oder verschwindet.

### N5. „Mehr lesen" leert die Kachel, wenn der POI keinen Langtext hat (mittel)

req-079 hat das Aufklappen der Kachel umgestellt: aufgeklappt steht jetzt der Langtext **statt** des Kurztexts, nicht darunter. Das ist ausdrücklich gewollt und als Akzeptanzkriterium abgehakt: *„dann steht dort der Langtext und NICHT mehr der Kurztext."* Der Code tut genau das (`app/go/components/activity-card.tsx:94-98`):

```tsx
{expanded ? (
  <p className={styles.longText}>{activity.longText}</p>
) : (
  <p className={styles.shortText}>{activity.shortText}</p>
)}
```

Nur ist ein leerer Langtext der Normalfall, nicht der Ausnahmefall. `plannedActivityFromPoi` (`lib/plan/plan-poi.ts:130-131`) setzt:

```ts
shortText: poi.shortText ?? "",
longText: poi.longText ?? "",
```

`poi.long_text` ist seit `migrations/0034_poi_kurztext_langtext.sql:13` eine Spalte ohne `not null` — ein POI ohne Langtext ist gültig und alltäglich. Der Knopf „Mehr lesen" erscheint dabei unbedingt (`activity-card.tsx:132-137`), unabhängig davon, ob es etwas zu lesen gibt.

**Gemessen** (Wegwerf-Test mit `longText: ""`, danach entfernt):

```
vorher_kurztext=true
nachher_kurztext=false  knopf=Weniger anzeigen
```

Der Nutzer tippt „Mehr lesen" und die Kachel hat keinen Text mehr — nur noch Titel, Foto und einen Knopf, der jetzt „Weniger anzeigen" heißt. Vor req-079 blieb der Kurztext stehen und der leere Langtext fiel weg; die Umstellung hat den Fall mitgenommen, ohne ihn zu bemerken. Kein Test deckt ihn ab: `activity-card.test.tsx` kennt nur Programmpunkte mit gefülltem Langtext.

**Empfehlung:** Ein leerer Langtext heißt „es gibt nichts mehr zu lesen" — dann gehört der Knopf gar nicht dahin. In derselben Zeile zu lösen, in der `zustand` schon so behandelt wird:

```tsx
const mehrZuLesen = activity.longText.trim().length > 0;
```

und `{mehrZuLesen && <button …>}`. Sind dann noch weitere Fotos da, braucht es den Knopf trotzdem — `mehrZuLesen || weitereFotos.length > 0` deckt beides, und aufgeklappt bleibt bei leerem Langtext der Kurztext stehen. Dazu zwei Tests: „ohne Langtext steht kein ‚Mehr lesen' da" und „ohne Langtext, aber mit vier Fotos, klappt die Kachel auf und behält ihren Kurztext". Das ist die Sorte Grenzfall, die `stack.md` unter „was nicht hinterlegt ist, ergibt keinen Eintrag" schon an anderer Stelle sauber löst (`lib/activities/kachel-links.ts:44-47`).

### N6. Zwei Routen bitten um einen Tag Zwischenspeicher, die middleware verbietet ihn — und niemand prüft, wer gewinnt (mittel)

Die letzte Review hat das für das Icon aus req-065 festgestellt (dort N5, unverändert offen). req-079 hat den Einsatz erhöht: jede Kachel des Begleiters lädt jetzt ein Foto über `/api/poi-fotos/<id>`, aufgeklappt alle weiteren.

Die Route ist sorgfältig gebaut — Sitzung verlangt, Mandant geprüft, und sie bittet ausdrücklich um einen Tag privaten Zwischenspeicher (`app/api/poi-fotos/[id]/route.ts:43`):

```ts
"Cache-Control": "private, max-age=86400",
```

Dieselbe Bitte steht in `app/api/dokumente/[id]/route.ts:45`. Es sind die einzigen zwei Stellen im Repo, die überhaupt um Zwischenspeicherung bitten.

Die middleware setzt auf **jede** Antwort hinter der Anmeldung ihr eigenes `Cache-Control` (`middleware.ts:88-92`):

```ts
const response = NextResponse.next();
response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions(secure));
noStore(response);   // "no-store, no-cache, must-revalidate, max-age=0"
```

`/api/poi-fotos/<id>` trägt keine Dateiendung und ist damit vom matcher (`middleware.ts:120`) **nicht** ausgenommen — die middleware läuft darüber. Zwei Vorgaben für dieselbe Antwort, aus zwei Schichten.

**Was ich nicht messen konnte, und das ist der eigentliche Befund:** welche der beiden beim Browser ankommt. Das entscheidet, wie Next.js die Kopfzeilen einer `NextResponse.next()` mit denen des Route-Handlers zusammenführt, und dafür braucht es einen laufenden Server mit gültiger Sitzung — in dieser Umgebung nicht herstellbar (siehe „Zur Arbeitsweise"). `middleware.test.ts:181-192` prüft nur, dass die middleware `no-store` **setzt**, und zwar für `/plan`; keine Zeile im Repo prüft, was `/api/poi-fotos/<id>` tatsächlich ausliefert. Die Zahl `max-age=86400` steht an zwei Stellen als Absicht im Code und an keiner als Zusicherung.

Damit gibt es zwei Möglichkeiten, und beide sind ein Befund:

- Die middleware gewinnt: dann lädt der Begleiter bei jedem Blick auf den Tagesplan alle Fotos neu — im Mobilfunk, wofür er gebaut ist, und gegen die ausdrückliche Absicht der Route. Derselbe Mechanismus, den der Kommentar an `config.matcher` für den Karten-Worker beim Namen nennt: *„Laeuft die middleware darueber, traegt die Auslieferung ‚no-store' und der Browser laedt bei jedem Kartenaufruf ein halbes Megabyte neu."*
- Der Route-Handler gewinnt: dann ist die Absicht erfüllt, aber niemand weiß es, und der nächste Umbau der middleware kann es unbemerkt kippen.

**Empfehlung:** Dieselbe Lösung, die `maplibre/` bekommen hat, und dazu die fehlende Messung.

1. `/api/poi-fotos` und `/api/dokumente` in den matcher-Ausschluss aufnehmen — beide prüfen ihre Sitzung selbst (`currentSession()`, `unauthorized()`), sie brauchen die grobe Absicherung der middleware nicht. Zusammen mit `ICON_BASIS_PFAD` aus dem Vorbefund ist das eine Zeile im Muster.
2. Je eine Zusicherung nach dem Muster von `middleware.test.ts:200` („der Worker … darf zwischengespeichert werden"), die den Ausschluss festhält — ohne sie wandern die Pfade beim nächsten Umbau zurück.
3. Eine E2E-Zusicherung, die die Kopfzeile am echten Server liest. `tests/e2e/begleiter.e2e.ts` öffnet `/go` bereits mit angemeldeter Sitzung; ein `seite.waitForResponse(/\/api\/poi-fotos\//)` und ein `expect(antwort.headers()["cache-control"])` sind drei Zeilen und beantworten die Frage endgültig — auch für das Icon.

### N7. Kein ausgehender Netzaufruf hat ein Zeitlimit — vierte Review (mittel)

Der Grep ist unverändert leer:

```
$ grep -rn "AbortSignal.timeout\|signal:" lib/google lib/osm lib/weather lib/routing lib/ai lib/expenses --include=*.ts | grep -v test
(kein Treffer)
```

`lib/ai/openai-client.ts:105` und `:138` konstruieren beide `new OpenAI({ apiKey, fetch, maxRetries: 0 })` — keine `timeout`-Option, also die Vorgabe des SDK: zehn Minuten. Auch für `openai.images.generate`, das typisch Dutzende Sekunden braucht und auf das `app/api/poi-ki-bild/route.ts` wartet, während der Nutzer auf „Bild erzeugen" gedrückt hat.

Die Zahlen aus der letzten Review gelten unverändert: bis zu **162 streng aufeinanderfolgende Netzaufrufe** in `POST /api/poi-search` (1 Nominatim + 1 OpenAI + bis 20 Google-Textsuchen + bis 140 Foto-Abrufe), keiner mit einer Obergrenze für die Wartezeit, alle nacheinander. Diese Strecke hat daran nichts geändert — aber sie hat die Fotos, die dabei entstehen, zur zentralen Anzeige des Begleiters gemacht (req-079). Die Außenkante ist also nicht gewachsen, ihre Bedeutung schon.

**Empfehlung** (unverändert, drei unabhängige Schritte; die Fehlerpfade liefern alle schon `null` bzw. `[]`, ein Abbruch fällt also ohne weitere Änderung hinein):

1. `fetch(url, { signal: AbortSignal.timeout(MS) })` in den HTTP-Clients — 5 s für Nominatim, Open-Meteo und die EZB, 10 s für Google Places und OSRM. Zehn Aufrufstellen.
2. `timeout: 30_000` für die Fragen an OpenAI, `timeout: 120_000` für das Bild — zwei Zeilen, und sie gehören neben `DEFAULT_MODEL` und `DEFAULT_IMAGE_MODEL`.
3. Die 20 Nachschläge und die bis zu 140 Foto-Abrufe nebenläufig statt nacheinander (`Promise.all` über Gruppen von etwa fünf). Bringt die Wartezeit von „Summe" auf „Maximum", ist unabhängig von 1 und 2 richtig und die einzige der drei Änderungen, die der Nutzer sofort merkt.

### N8. Adressen aus Nutzer- und KI-Daten landen ohne Schema-Prüfung im `href` (niedrig-mittel)

req-079 hat die Webseite des POI auf die Kachel des Begleiters gebracht (`lib/activities/kachel-links.ts:69-76`, `app/go/components/kachel-links.tsx:56`). Damit gibt es jetzt zwei Stellen, die `poi.web` unmittelbar als `href` verwenden — die neue und `app/plan/components/poi-list.tsx:678`.

Geprüft wird die Adresse von `normalizeWeb` (`lib/pois/validate.ts:119-125`):

```ts
return /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
```

Das Muster verlangt `://`. `javascript:alert(1)` fällt deshalb durch und wird zu `https://javascript:alert(1)` — harmlos. `javascript://…` erfüllt das Muster aber und geht unverändert durch. **Gemessen**, Wegwerf-Test, danach entfernt:

```
normalizeWeb        = "javascript://%0aalert(document.domain)"
kachelLinks_href    = "javascript://%0aalert(document.domain)"
dom_href            = "javascript:throw new Error('React has blocked a javascript: URL as a security precaution.')"
```

**Ausgenutzt werden kann es heute nicht:** React 19 erkennt das Schema beim Rendern und tauscht die Adresse aus. Das ist die ganze Wahrheit des Befunds, und ich formuliere ihn deshalb nicht als Sicherheitslücke. Was bleibt, sind drei Dinge:

1. **Die Zusicherung der Kachel ist gebrochen.** `kachel-links.tsx` schreibt über sich: *„ein Platzhalter oder ein Link ins Leere steht nie dabei"*, und req-079 hat das als Akzeptanzkriterium. Ein Symbol, das beim Antippen einen React-Fehler auslöst, ist genau ein Link ins Leere.
2. **Der Schutz liegt im Framework, nicht in der Anwendung.** Er gilt, solange die Adresse durch React-Rendering geht. `poi.web` geht heute nirgends sonst hin — aber ein `window.open(poi.web)`, eine Zeile in einer Mail oder ein Eintrag im Backup hätte ihn nicht.
3. **Das Repo hat das Muster schon, an der richtigen Stelle.** `lib/auth/redirect-target.ts` prüft ein Ziel aus der Adresszeile gegen eine Positivliste, mit der Begründung *„ist damit vom Nutzer (oder von einem Angreifer) frei waehlbar"*, und `redirect-target.test.ts:19` führt `["javascript:alert(1)", "Skript-Adresse"]` als Fall. Dieselbe Sorgfalt fehlt eine Ebene weiter.

Dieselbe Lage gilt für `activity.bookingUrl` (`lib/activities/booking.ts:78`) — allerdings nur theoretisch, weil die Spalte nach N1 ohnehin nie gefüllt wird. Und für `lib/pois/ai-search.ts:319` (`web: place.web`), wo die Adresse aus Google Places durch die Formularstrecke läuft und damit dieselbe `normalizeWeb`-Prüfung trifft.

**Empfehlung:** `normalizeWeb` auf eine Positivliste umstellen — genau die Reihenfolge, die `lib/backup/import.ts:38-48` schon vorbildlich vorführt („erst erlauben, dann verbieten"):

```ts
const ERLAUBT = ["http:", "https:"];
```

und alles, was kein Schema trägt, wie bisher mit `https://` versehen. Wer etwas anderes eintippt, bekommt denselben Feldfehler, den `validatePoiInput` für zu lange Adressen schon liefert (`validate.ts:161-163`) — also eine Antwort statt eines stummen Umbaus. Dazu die beiden Fälle in `validate.test.ts` neben die drei vorhandenen `normalizeWeb`-Tests (`:85-97`): `javascript://%0a…` und `data://…`.

### N9. `readBody` steht fünfzehnmal im Repo, sieben Routen lesen den Body unverpackt (niedrig-mittel)

Unverändert aus der letzten Review, hier nur die Messung:

```
$ grep -rln "async function readBody" app | wc -l
15
```

Und die sieben Stellen, die `request.json()` ohne Absicherung rufen, stehen alle noch:

| Route | Stelle |
|---|---|
| `app/api/poi-status/route.ts` | `:23` |
| `app/api/search-area/route.ts` | `:23`, `:58` |
| `app/api/poi-search/route.ts` | `:44` |
| `app/api/poi-beschreibung/route.ts` | `:32` |
| `app/api/activity-option-selection/route.ts` | `:12` |
| `app/api/ort-aus-link/route.ts` | `:26` |

Ein abgeschnittener Request-Body — im Mobilnetz keine Seltenheit, und der Begleiter läuft dort — wird als Serverfehler gemeldet statt als fehlerhafte Anfrage. Drei der sieben (`poi-status`, `activity-option-selection`, `search-area`) gehören zu Bedienschritten, die der Begleiter und der Planer beiläufig auslösen.

**Empfehlung, unverändert:** `lib/api/read-body.ts` mit den zwölf Zeilen, daneben `istUuid()`, und beides in allen einundzwanzig Routen. Ein Durchgang mit `sed`-Charakter. `stack.md` (Conventions) verlangt geteilte Logik in `lib/`; hier reproduziert sie sich stattdessen selbst, weil jede neue Route sie von der Nachbarroute kopiert.

### N10. Kleinigkeiten (niedrig)

Neu aus dieser Strecke:

- **`toggleMapStatus` hat die sichere Form gegen die unsichere getauscht.** `app/plan/plan-view.tsx:274-282` las den Zustand bis req-/bug-052 über die Updater-Form (`setVisibleMapStatuses((current) => …)`) und liest ihn jetzt direkt aus der Closure, um den neuen Wert an `speichereKartenStatus` weitergeben zu können. Zwei Umschaltungen in derselben Renderrunde verlieren damit die erste. In der Praxis schwer auszulösen — jeder Klick ist ein eigenes Ereignis —, aber es ist ein Rückschritt, und er ist unnötig: der neue Wert gehört in die Updater-Funktion, das Speichern in einen `useEffect` auf `[selectedTripId, visibleMapStatuses]`. Dann steht die Ablage auch nur an einer Stelle statt an zweien (`:280` und `merkePoiListenEinstellungen`).
- **Der Name am Richtungspfeil kann den falschen POI nennen.** `lib/map/day-map.ts:147-163` nimmt die Positionen der Linie aus den Programmpunkten des Transfers (`entry.transfer.fromActivityId`, `entry.toActivity`), die POI-Nummern daneben aber aus den **gewählten** Alternativen (`poiNummerJeEintrag[index ± 1]`, gebildet über `gewaehlteActivity`). Zeigt ein Transfer auf eine nicht gewählte Alternative einer Options-Gruppe, beschreibt `day-route-map.tsx:70` (`Pfeil von POI 14 nach POI 3`) eine andere Verbindung als die gezeichnete — und die Linie endet dort, wo kein Marker steht. Ein enger Fall, und die Linienführung ist älter als req-075; die Beschriftung ist neu und behauptet mehr, als sie weiß. Entweder die Nummern aus denselben Programmpunkten ziehen wie die Positionen, oder bei Uneinigkeit `null` liefern — der Fall ist im Typ schon vorgesehen.
- **`app/plan/plan-view.tsx:239` trägt ein `// eslint-disable-next-line react-hooks/set-state-in-effect`** für den ersten von zwei `setState`-Aufrufen im selben Effekt. Der Effekt ist richtig und der Kommentar darüber erklärt ihn vollständig (Hydration); die Ausnahme steht aber nur an der einen Zeile, ohne Begründung daneben. Ein Halbsatz, warum sie hier vertretbar ist — der Rest der Datei hält diesen Standard.

Unverändert offen, aus den Vorgänger-Reviews, alle am Stand b0a2cf7 nachgemessen:

- **`updateKostenzeile` beschränkt sich nicht auf manuelle Zeilen.** `lib/db/kostenzeilen.ts:313` macht es bei `deleteKostenzeile` richtig (`where id = $1 and activity_id is null`); `updateKostenzeile` (`:231-246`) prüft nur den Account und delegiert an `aendere` (`:214-228`), das ohne diese Bedingung schreibt. Ein `and activity_id is null` in `aendere`.
- **`startRatingRound` verlässt sich auf den Index, fängt ihn aber nicht.** `lib/db/rating-rounds.ts:196-208` prüft selbst auf eine laufende Runde; gewinnt die zweite Anfrage das Rennen, schlägt der Unique-Verstoß als 500 durch. Ein `catch` um das `insert`, das ihn auf `{ ok: false, reason: "laeuft" }` abbildet.
- **Die POI-Nummer wird per Read-then-Write vergeben.** `lib/db/pois.ts:326`, `select max(number) …`, gegen `unique (trip_id, number)` aus `migrations/0014_poi_number.sql`. Ein `insert … (select coalesce(max(number), 0) + 1 …)`. Das ist mit req-074 wichtiger geworden, nicht unwichtiger: die Nummer steht jetzt an fünf Stellen der Oberfläche.
- **Kein `.dockerignore`** — fünfte Review. `ls -a | grep docker` liefert nichts. Die Begründung aus der letzten Review gilt unverändert: `deploy/Dockerfile` legt mit `COPY . .` das `node_modules` des Hosts über das, das `npm ci` im Abbild gebaut hat, und macht die `deps`-Stufe wirkungslos. Ein `.dockerignore` mit `node_modules`, `.next`, `.git`, `test-results`, `tsconfig.tsbuildinfo`, `.env*`.
- **`CLAUDE.md:1` heißt weiterhin `# <Projektname>`** — fünfte Review, und darunter steht unverändert der Einrichtungshinweis der appbaua-Umstellung. Die Datei ist die oberste bindende Anweisung des Repos und die einzige, die noch ihren Platzhalter trägt. Ein Wort.
- **Die Mock-Liste in `stack.md:203` nennt Overpass**, das es nicht mehr gibt (`grep -rin overpass lib app components` liefert nur einen Kommentar in `tests/e2e/offline-fetch.cjs`), und nennt Open-Meteo und die EZB-Kurse nicht. Vierte Review für Open-Meteo. Eine Zeile.
- **`OSM_STYLE` steht dreimal** (`app/go/components/map-view.tsx:25`, `app/plan/components/day-route-map.tsx:30`, `app/plan/components/poi-map.tsx:52`). Nach `lib/map/`, wo `worker-url.ts` und `lifecycle.ts` schon liegen — dann fällt N3 beim nächsten Mal nebenbei auf.
- **Fünf Kommentare verweisen auf `bug-011`**, das unter `delivery/bugs/` (auch nicht in `done/`) nicht existiert: `poi-map.tsx:328`, `:665`, `:796`, `split-view.tsx:107`, `lib/map/lifecycle.ts:24`.
- **`poi-map.module.css:378` verweist auf ein Pseudo-Element**, das der Kommentar vier Zeilen darunter (`:382-384`) für entfallen erklärt. Zwei Zeilen streichen.
- **Die Trefferflächen der Eckpunkt-Griffe** sind unverändert 22 × 22 px, der erste 30 × 30, die Mittelpunkte 9 × 9 (`poi-map.module.css:367-400`) — sechste Review. `stack.md` (Conventions, Regel 4) verlangt 44 × 44 und lässt die Ausnahme zu, aber *„nur mit einem sichtbaren Hinweis statt einer kaputten Darstellung"*; der fehlt. Dass die neue Seitenleiste in derselben Woche 44 px sauber einhält und das in `seitenleiste.layout.test.ts:218,326-331,425` dreifach festnagelt, macht die Ausnahme erklärungsbedürftiger.
- **`lib/auth/tokens.ts:20` `secretsMatch`** wird außerhalb seines Tests nicht gerufen. Ein Satz im Kommentar, dass der Vergleich bewusst in der SQL-Bedingung stattfindet.
- **Typografie:** `app/plan/components/use-poi-status.ts:10` schreibt `„${pois[0].name}"` — Anführungszeichen unten, gerades oben. Ein Zeichen.

## Unverändert offen

Aus den Vorgänger-Reviews, geprüft am Stand b0a2cf7:

| Herkunft | Befund | Stand |
|---|---|---|
| 22.09. N1 | Tests unter Last abgelaufen | ❌ **verschärft** — jetzt auch ohne Nebenlast, siehe N2 |
| 15.09. N1 / 22.09. N2 | Planungskarte meldet die Worker-Adresse nicht | ❌ **unverändert, fünfte Review — siehe N3** |
| 15.09. N2 | E2E-Bildschirmprüfung erreicht die Planer-Bereiche nie | ⚠️ **halb** — `/go` ist neu abgedeckt (`tests/e2e/begleiter.e2e.ts`), die fünf Planer-Bereiche nicht — siehe unten |
| 15.09. N3 / 22.09. N4 | Keine Zeitlimits | ❌ offen — siehe N7 |
| 22.09. N5 | Icon wird bei jedem Seitenaufruf neu gerechnet | ❌ offen, **Umfang gewachsen** — siehe N6 |
| 15.09. N4 / 22.09. N6 | Wiederherstellung leert die Bildablage nach dem `commit` | ❌ offen — `lib/backup/store.ts:316` `restoreDatabase`, `:318` `emptyDirectory`, `:321` `cp`, Zeile für Zeile wie vor einer Woche |
| 15.09. N5 / 22.09. N6 | `deleteTrip` ohne Transaktion | ❌ offen — `lib/db/trips.ts:312`; `withDatabaseClient` hat unverändert **einen** Verwender |
| 22.09. N3 | `setPoiStatuses` als Schleife, Route ohne `try/catch` | ❌ offen — `lib/db/pois.ts:178-189`, `app/api/poi-status/route.ts:41-45` |
| 22.09. N7 | `readBody` fünfzehnmal, sieben nackte `request.json()` | ❌ offen — siehe N9 |
| 15.09. N6 | POI-Nummer per Read-then-Write | ❌ offen — siehe N10 |
| 25.08. N1 | Trefferflächen der Eckpunkt-Griffe 22 statt 44 px | ❌ offen, **sechste Review** — siehe N10 |
| 25.08. N3 | Kommentare verweisen auf nicht existente Bugs | ❌ offen, unverändert fünf |
| 25.08. N5 | Kein `.dockerignore` | ❌ offen, **fünfte Review** |
| 18.08. #2 | Schreib-Debounce aus `stack.md` existiert nirgends | ❌ offen — **achte Review**, elf Ausnahme-Kommentare, kein Verwender |
| 18.08. #4, #6, #9 | Anmeldelink per GET; Rate-Limiter O(n); Secure-Flag am `x-forwarded-proto` | ❌ offen (alle drei mit dokumentierter Begründung im Code) |
| 18.08. #7 | Mehrschrittige Schreibvorgänge ohne Transaktion | ❌ offen, unverändert fünf Fälle |
| 18.08. #8 | Demo-Daten in den Schema-Migrationen | ❌ offen — und seit req-079 **tragend**, siehe N1 |
| 01.09. N4 | Wetter aus dem Browser, Open-Meteo fehlt in `stack.md` | ⚠️ halb — unverändert |
| 01.09. N5 | `OSM_STYLE` dreimal | ❌ offen |
| Security 23.09. | siehe `delivery/security/2026-09-23-security-wegfara-2a04f69.md` | nicht Gegenstand dieser Review |

**Zwei davon verdienen einen Satz mehr:**

**Die E2E-Bildschirmprüfung ist zum ersten Mal in Bewegung.** `tests/e2e/begleiter.e2e.ts` ist neu und ist der erste Fluss, der `/go` überhaupt öffnet — damit greift die Bildschirmbreiten-Prüfung aus req-049 (`tests/e2e/fixtures.ts`) endlich auch am Begleiter, und der Fluss prüft die richtige Naht: Options-Wahl klicken, Seite neu laden, Wahl steht noch. Genau der Schnitt, den Komponententests nicht erreichen. Der Grep über alle Flüsse liefert jetzt sieben Adressen statt fünf:

```
tests/e2e/anmelden.e2e.ts:52      /einladung/passkey
tests/e2e/anmelden.e2e.ts:75      /plan
tests/e2e/anmelden.e2e.ts:110     /anmeldung
tests/e2e/begleiter.e2e.ts:43     /go          ← neu
tests/e2e/poi-anlegen.e2e.ts:25   /plan
tests/e2e/poi-verplanen.e2e.ts:34 /plan
tests/e2e/reise-anlegen.e2e.ts:30 /plan
```

Vier Aufrufe von `/plan` ohne Parameter, `ACTIVE_PLAN_AREA` ist `"pois"`. **Planung, Bewertungen, Kosten, Dokumente und Reisedetails** werden weiterhin nie geöffnet — und das ist diese Woche besonders bitter, weil die Strecke fast ausschließlich in ihnen gearbeitet hat: die Seitenleiste, der Zoom, die Tageskarte mit den Pfeilen liegen alle in „Planung". Die Lücke ist praktisch geschlossen, bevor man sie ausspricht: `planAreaPath()` (`lib/plan/areas.ts:77`) liefert für jeden Bereich eine echte Adresse, `SWITCHABLE_PLAN_AREAS` (`:54`) die Liste, und die Fixture prüft jede geöffnete Adresse selbsttätig bei drei Breiten. Ein `for`-Loop — sechs Zeilen für fünf ungeprüfte Oberflächen. **Und er fängt N3 an der echten Anwendung**, wo keine Karten-Attrappe die Frage entscheidet.

**Der Schreib-Debounce steht in der achten Review.** `delivery/stack.md` fordert unverändert: *„Schreibende Zugriffe werden im Datenzugriffs-Layer gebündelt und mit 15 Sekunden Verzögerung ausgeführt."* Elf Kommentare in `lib/` nehmen die Ausnahme in Anspruch, keiner wendet die Regel an. Jeder dieser Kommentare ist für sich gut begründet; zusammen sagen sie, dass die Vorgabe in dieser Form nicht getragen hat. Nach acht Reviews ist eine dauerhaft unerfüllte bindende Vorgabe schlechter als beide Alternativen — sie entwertet den Rest der Datei, und der Rest der Datei ist gut.

## Was in Ordnung war

- **`npm run types` und `npm run lint` fehlerfrei**, und die Suite ist um 353 Tests auf 4366 in 342 Dateien gewachsen. Bei 61 Commits sind das knapp sechs neue Tests pro Commit; die Test-Policy aus `stack.md` wird gelebt, nicht zitiert. Keine übersprungenen Tests.
- **`lib/plan/timeline-zoom.ts` ist die beste Datei dieser Strecke.** Sie ist 68 Zeilen lang, davon die Hälfte Begründung — und die Begründungen tragen jede eine Zahl: 24 px unten, *„weil ein Block mindestens so viel braucht, damit Nummer und Titel ganz darin stehen (req-074)"*; 176 px oben, *„weil eine Viertelstunde damit die 44 px bekommt, die stack.md für Bedienelemente verlangt"* — und mit dem Satz dazu, warum die 96 px aus req-076 nicht reichten (req-078: *„auf dem iPad mit dem Finger zu knapp"*). Die Stufenliste enthält `HOUR_HEIGHT_PX` an ihrer Stelle statt einer zweiten `48`, und `timeline-zoom.test.ts:26` prüft, dass die Liste sortiert **bleibt** — ohne das würde `groessereStundenhoehePx` stillschweigend falsch rechnen, sobald jemand die Grundhöhe ändert. Ein Test, der die Voraussetzung der eigenen Implementierung festnagelt statt nur ihr Ergebnis.
- **bug-052 ist an der richtigen Stelle gelöst, und die Lösung erklärt sich selbst.** `lib/pois/ansicht-einstellungen.ts` begründet in drei Absätzen, warum die Ablage an der Sitzung hängt und nicht am Gerät (*„Filter und Sortierung sind Arbeitsstand, keine Einstellung"*), warum es je Reise einen Schlüssel gibt (*„damit setzt ein Reisewechsel sie zurueck"*), und warum die Karte ihre eigene Auswahl behält. Gelesen wird Feld für Feld gegen die bekannten Werte (`alsTypFilter`, `alsStatusFilter`, `alsSortierung`) — *„aus einem alten Eintrag darf keine Liste entstehen, die nichts mehr zeigt"* —, und der Unterschied zwischen „leere Auswahl" und „kein Eintrag" ist ausdrücklich behandelt (`kartenStatusAus:139-142`). Dazu drei Schutzschichten gegen die Umgebung: kein `window` serverseitig, ein Browser darf die Ablage verweigern, ein beschädigter Eintrag ist kein Fehler. Und `tests/setup.ts:33-38` leert die Ablage nach jedem Test, mit der Begründung dafür — die Sorte Aufräumarbeit, die man erst nach dem ersten geheimnisvoll durchfallenden Test macht, hier vorher.
- **`lib/map/routenfarbe.ts` prüft gegen die Fläche, auf der die Farbe wirklich liegt.** Drei Konstanten, jede mit ihrem Grund: die Farbe, der **Kartengrund** der OpenStreetMap-Kacheln (`#f2efe9`, ausdrücklich *„kein Wert der Oberflaeche"*) und die Grenze aus `stack.md`. Dazu der Satz, der den Test überhaupt tragfähig macht: *„Die Kartenflaechen darauf (Wasser, Wald, Bebauung) sind dunkler als er; wer gegen ihn besteht, besteht auch gegen sie."* Das ist eine Aussage darüber, warum *eine* Messung reicht — genau das, was `stack.md` unter „Maßgeblich ist die Fläche, auf der die Schrift tatsächlich liegt" verlangt, und was in Kontrasttests fast nie dasteht. Der alte Wert wird mitgeliefert (1,49:1), damit man die Größe des Problems noch sieht.
- **`lib/map/pfeile.ts` rechnet den Fall aus, den man übersieht.** Der Pfeil sitzt auf der halben Strecke der Linie — und „halbe Strecke" ist bei einem Straßenverlauf aus vier Punkten nicht der mittlere Punkt. Die Datei summiert die Abschnitte, sucht den, auf dem die Hälfte liegt, und interpoliert darin. Dazu zwei Feinheiten mit ihrer Begründung: ein Bezugsbreitengrad für die ganze Linie, *„nur so lassen sich die Laengen ihrer Abschnitte miteinander verrechnen"*, und `ohneStillstand`, das Punkte auf ihrem Vorgänger entfernt — *„er taeuschte eine [Richtung] vor, wenn die halbe Strecke gerade auf ihm endete."* Damit ist auch die Division in `:72` gegen Null gesichert, ohne dass dort ein Wächter stehen muss. Und der Kommentar am Winkel sagt, warum ein Bildschirmwinkel hier gleich dem Kugelwinkel ist (*„Die Karte steht in Mercator, und der ist winkeltreu"*).
- **bug-055 ist als Begriffsfrage gelöst, nicht als Anzeigefrage.** `lib/map/day-map.ts` hat `number` durch zwei getrennte Felder ersetzt — `poiNummer` (die Nummer des POI, *„Eine eigene Zaehlung tritt dann nicht an ihre Stelle"*) und `reihenfolge` (die Stelle in der Tagesfolge) — und schreibt an jedes, wer es beschriftet: die POI-Nummer im Planer, die Reihenfolge im Begleiter. `lib/pois/nummer.ts` hält daneben fest, wo das Gitter davor steht und wo nicht, und warum (*„weil dort kein Platz fuer ein Zeichen mehr ist"*). Ein Bug über eine falsche Zahl, dessen Fix erklärt, welche Zahl es überhaupt gibt.
- **Die Seitenleiste ist gegen die Regeln geprüft, die `stack.md` aufstellt, nicht gegen ihr Aussehen.** `seitenleiste.layout.test.ts` ist 482 Zeilen lang und misst unter anderem die 44 px für jeden Eintrag an drei Stellen — einmal als `min-height`, einmal am Schalter, und einmal als Rechnung `breite − 2·innen − rand ≥ 44` (`:343`), also die Breite, die eingeklappt tatsächlich übrig bleibt. Dazu `overflow-y: auto` an der Liste mit der Begründung für den Fall, an den man nicht denkt (*„Eine sehr niedrige Leiste (iPad quer, geteiltes Fenster) laesst die Liste rollen, statt Eintraege abzuschneiden"*). Und die Leiste merkt sich absichtlich nichts: *„sie ist der Weg irgendwohin, nicht der Ort, an dem man bleibt"* — eine Entscheidung mit Grund, an der Stelle, an der man sie sucht.
- **`app/plan/layout.tsx` begründet eine Schriftart mit dem Datenschutz.** Die neue Handschrift kommt über `next/font/google`, *„laedt sie beim Bauen herunter und liefert sie aus dem eigenen Bundle aus … im Browser wird kein fremder Dienst angesprochen, wie es delivery/stack.md verlangt"*, samt genannter Rückfall-Schriften für Windows und Apple. Das ist das Prinzip *„proprietär nur, wo es keine brauchbare Alternative gibt, und dann nur verlinkt, ohne Nutzerdaten abzugeben"* an einer Stelle angewandt, an der man es gar nicht erwartet.
- **`app/api/poi-fotos/[id]/route.ts` ist die Sorte Route, die man sich für jede wünscht.** Sitzung verlangt, Mandant in der Abfrage (`findPhotoFileName(pool, session.accountId, id)`), *„Ein Foto eines anderen Accounts existiert fuer diese Sitzung nicht"* → 404 statt 403, Content-Type aus dem eigenen Dateinamen statt aus der Anfrage, und ein fehlender Datei-Inhalt wird als 404 sichtbar statt als leeres Bild — *„Ein Datensatz ohne Datei ist ein Fehlerzustand (siehe stack.md) und wird hier sichtbar."* Die Regel aus `stack.md` ist hier nicht zitiert, sondern erzwungen. (Dass ihre Cache-Vorgabe von der middleware überschrieben werden könnte, ist N6 — die Route selbst ist richtig.)
- **`lib/activities/kachel-links.ts` sagt für jedes Feld, woher es kommt und warum nicht von woanders.** Navigation aus der Position *„und nicht hier nachgebaut"* (`poiMapsUrl`), Webseite und Telefon vom POI, E-Mail vom Programmpunkt *„Eine E-Mail fuehrt der POI nicht"* — und die Regel darüber: *„Was nicht hinterlegt ist, ergibt keinen Eintrag: auf der Kachel steht kein toter Link und kein Platzhalter."* Die Reihenfolge steht als Liste an einer Stelle, statt sich aus der Einfügefolge zu ergeben. Dass N1 und N8 genau an dieser Datei hängen, liegt nicht an ihr.
- **req-076 hat die Falle vermieden, die es hätte stellen können.** Die Stundenhöhe steht am Raster (`TimelineGrid.hourHeightPx`) und wird über **eine** Funktion gelesen (`gridHourHeightPx`), mit der Begründung: *„jede Stelle, die eine Zeit in Pixel oder Pixel in eine Zeit umrechnet, bekommt das Raster mit und rechnet damit zwangslaeufig mit derselben Zahl"* — und in `lib/plan/plan-poi.ts:44-47` steht, was sonst passiert wäre: *„Sonst landete ein gezogener POI auf einer anderen Zeit als der, auf die er gezogen wurde."* Ein Zoom, der die Fallenlogik des Ziehens nicht angefasst hat, weil er gar nicht an ihr vorbeikam.

## Empfohlene Reihenfolge

Vorbemerkung: Die Punkte 1 bis 3 sind zusammen unter einer Stunde und schließen einen Befund ab, der fünf Reviews alt ist und auf dem diese Woche zwei weitere Arbeiten aufgesetzt haben. Sie stehen absichtlich vor allem anderen — wie letzte Woche, und die Woche davor.

1. **N3 Schritt 1+2** — `linien()` in `day-route-map.test.tsx:95-97` auf `querySourceFeatures` umstellen (Repro-Test, schlägt fehl), dann `ensureMapWorkerUrl()` in `day-route-map.tsx:281` (Fix, Test wird grün). Zwei Zeilen Produktivcode. Danach zeigt die Tageskarte ihre Linien, die Pfeile aus req-075 liegen auf etwas, und der Kontrast aus bug-059 wird zum ersten Mal wirksam.
2. **N3 Schritt 3** — die Struktur-Zusicherung „jede Datei mit `new MapLibreMap(` enthält `ensureMapWorkerUrl(`", nach dem Muster `app/api/api-guard.test.ts:53`. Zehn Zeilen. Sie beendet die Serie, statt sie zu verwalten.
3. **15.09. N2** — ein E2E-Fluss `for (const area of SWITCHABLE_PLAN_AREAS) await seite.goto(planAreaPath(area))`. Sechs Zeilen, fünf bisher ungeprüfte Oberflächen bei drei Breiten — und genau die fünf, in denen diese Strecke gearbeitet hat. Er fängt Punkt 1 an der echten Anwendung. Vor jeder weiteren Arbeit im Planer.
4. **N2** — `testTimeout: 15000` in `vitest.config.ts` und die drei `userEvent`-Tipptests auf `paste()`/`fill()` umstellen. Solange dieselbe Suite zweimal hintereinander zwei verschiedene Ergebnisse liefert, ist jede rote Ampel im prod-Deploy zweideutig — und die Punkte 1 bis 3 arbeiten gegen dieses Gate.
5. **N1** — entscheiden, ob der Buchungszustand pflegbar wird oder die Anzeige zurückgenommen wird; bis dahin die Zusicherung „jedes gelesene Feld wird irgendwo geschrieben" und die falsche Zeile in req-079 korrigieren. Das ist die einzige Entscheidung auf dieser Liste, die nicht in Code besteht, und sie ist überfällig, bevor der nächste Requirement darauf aufsetzt.
6. **N4 + N5** — den Zoom und den Reisetag nach `PlanView` heben und in die Sitzungsablage aufnehmen; `„Mehr lesen"` nur anbieten, wenn es etwas zu lesen gibt. Zwei Befunde, die der Nutzer diese Woche merkt, beide unter einer Stunde, beide in dem Bereich, den Punkt 3 gerade prüfbar gemacht hat.
7. **N6** — `/api/poi-fotos`, `/api/dokumente` und `ICON_BASIS_PFAD` in den matcher-Ausschluss, je eine Zusicherung dafür, und die E2E-Messung der Kopfzeile in `begleiter.e2e.ts`. Drei Zeilen Produktivcode, und die häufigsten Anfragen der App kosten nichts mehr.
8. **N7** — Zeitlimits (zehn Aufrufstellen plus zwei OpenAI-Zeilen) und die bis zu 160 Aufrufe nebenläufig statt nacheinander. Schritt 3 ist der, den der Nutzer sofort merkt, und er ist unabhängig von den anderen richtig.
9. **22.09. N3 + N6** — `setPoiStatuses` auf ein `update … where id = any($1::uuid[])` zusammenziehen und die Route den Fehler fangen lassen; `deleteTrip` in eine Transaktion; die Reihenfolge der Wiederherstellung umdrehen (zwei `rename` statt eines `rm -rf`). Gemeinsam anzufassen: dasselbe Thema, das Werkzeug liegt seit req-053 bereit und ist einmal erfolgreich benutzt.
10. **N8 + N9 + N10** — `normalizeWeb` auf eine Positivliste; `readBody` und `istUuid` nach `lib/api/` und in alle einundzwanzig Routen; `and activity_id is null` in `aendere`; `catch` in `startRatingRound`; POI-Nummer per SQL; `toggleMapStatus` zurück auf die Updater-Form; `.dockerignore`; `CLAUDE.md:1`; die Mock-Liste in `stack.md`; `OSM_STYLE` nach `lib/map/`; die fünf bug-011-Verweise; der doppelte CSS-Kommentar; das Anführungszeichen. Ein Durchgang.
11. **25.08. N1** — Trefferflächen der Griffe, sechste Review. Das `border: 7px solid transparent`-Muster aus `.drawButton` löst es ohne `position: relative` und damit ohne bug-011. Alternativ die Ausnahme in `stack.md` festhalten — aber nicht weiter stumm gegen eine bindende Vorgabe verstoßen, während die neue Seitenleiste sie dreifach prüft.
12. **18.08. #2** (Schreib-Debounce) — oder die Entscheidung, `stack.md` auf das umzuschreiben, was elf Kommentare inzwischen einhellig sagen. Nach acht Reviews ist die Entscheidung überfällig, in welche Richtung auch immer.

---

**Zur Arbeitsweise dieser Review:** Ausgeführt wurden `npm run types` (fehlerfrei), `npm run lint` (fehlerfrei) und `npm test` **zweimal** am Stand b0a2cf7. Beide Testläufe liefen ohne Nebenlast von meiner Seite — Typprüfung und Lint waren vor dem ersten Lauf beendet. Lauf 1: 2 Fehlschläge in 342 Dateien, 177,12 s. Lauf 2: 4366 Tests in 342 Dateien grün, 122,24 s. Dazu ein gezielter Einzellauf von `poi-form.test.tsx` (68 Tests grün, 12,41 s; die beiden Tipptests bei 868 ms und 841 ms). Beide Gesamtläufe sind gemeinsam die Aussage: N2 ist nicht ein Lauf, sondern der Unterschied zwischen zwei.

`npm run test:e2e` wurde **nicht** ausgeführt. Ein PostgreSQL-Server ist in dieser Umgebung erreichbar (`db:5432`) — das ist der Server der dev-Umgebung. Der Lauf hätte darauf eine Wegwerf-Datenbank angelegt und dazu einen vollständigen `next build` gebraucht; ich habe darauf verzichtet, weil ein autonomer Lauf nicht auf dem Datenbankserver einer laufenden Umgebung Datenbanken anlegen sollte, solange er es nicht muss. Die E2E-Aussagen dieser Review stammen deshalb aus der Quelltextanalyse der Flüsse und der Fixture, nicht aus einem Lauf — und die offene Messung in N6 ist genau die, die dieser Lauf beantworten würde. Die Aussage zum Docker-Build stammt aus `deploy/Dockerfile`, `package-lock.json` und dem Workflow; Docker ist hier nicht installiert.

**Vier Befunde habe ich mit Wegwerf-Testdateien empirisch bestätigt und die Dateien wieder entfernt** (`git status` ist sauber, nichts committet, nichts gepusht):

| Befund | Messung |
|---|---|
| N3 | `DayRouteMap` allein: `workerUrl="" gesetzt=1 verarbeitet=0`; Pfeile aus → 2 Marker, Pfeile an → 3 Marker |
| N4 | `PlanView` bei 1440 px, zweimal zoomen, Bereich wechseln und zurück: `grund=672 gezoomt=1344 nachWechsel=672` |
| N5 | `ActivityCard` mit `longText: ""`: `vorher_kurztext=true nachher_kurztext=false` |
| N8 | `normalizeWeb("javascript://%0aalert(…)")` unverändert; im DOM von React ersetzt durch `javascript:throw new Error('React has blocked a javascript: URL as a security precaution.')` |

Der Stand der Vorbefunde stammt aus gezielten Greps und dem Lesen der betroffenen Stellen, jeder einzeln am Stand b0a2cf7 nachgeschlagen. Kein Zugriff auf prod, keine Datenbank angefasst, kein Netzaufruf nach außen.
