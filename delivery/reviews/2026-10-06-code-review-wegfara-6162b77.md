---
type: code-review
repo: Wegfara
commit: 6162b77
date: 2026-10-06
---

# Code-Review: Wegfara (6162b77)

Automatisch erstellt vom appbaua-Worker am 2026-10-06.

Working tree is clean, throwaway test files removed. Here is the report.

---
```
---
type: code-review
repo: wegfara
commit: 6162b77
date: 2026-10-06
---
```

# Code-Review: wegfara (6162b77)

Automatisch erstellt vom appbaua-Worker am 2026-10-06. Vorgänger: [2026-09-29 (b0a2cf7)](2026-09-29-code-review-wegfara-b0a2cf7.md).

## Kurz-Zusammenfassung

**Seit der letzten Review hat sich am Quelltext nichts geändert.** `git diff --stat b0a2cf7..HEAD` liefert drei Dateien, alle unter `delivery/`:

```
delivery/idea/tageslicht-reicht-bis.md                    | 112 +++++
delivery/reviews/2026-09-29-code-review-wegfara-b0a2cf7.md | 490 +++++++++++
delivery/security/2026-09-30-security-wegfara-42b2d65.md   | 256 +++++++
3 files changed, 858 insertions(+)
```

Kein Commit an `app/`, `lib/`, `components/`, `migrations/` oder `.github/`. Alle vierzehn Befunde der letzten Review sind damit unverändert offen — ich habe jeden einzeln nachgemessen und führe sie unten kompakt, statt sie neu zu erzählen. Ein Bericht, der zum zweiten Mal dieselben 490 Zeilen schreibt, hilft niemandem; **diese Review geht deshalb in Bereiche, die acht Vorgänger nicht angefasst haben** — Zeitrechnung, die Options-Gruppen und die Abstimmung zwischen Dokumentation und Code.

`npm run types` und `npm run lint` sind fehlerfrei. `npm test` lief **zweimal** vollständig grün: 4366 Tests in 342 Dateien, **195,56 s** und **124,04 s**. Keine Zeitüberschreitung — aber die beiden Zahlen sind zusammen die Bestätigung des Vorbefunds: dieselbe Suite, zweimal hintereinander, **58 % Laufzeitunterschied**. Letzte Woche waren es 177 s (zwei Fehlschläge) und 122 s (grün); diesmal 196 s und 124 s. Der langsame Lauf ist diesmal durchgekommen, der nächste muss es nicht. Es gibt unverändert kein `testTimeout` in `vitest.config.ts`.

**Der schwerwiegendste neue Befund: wegfara bestimmt „heute" in UTC — und benutzt die Antwort als Ortsdatum am Reiseziel.** Sechs Stellen leiten das heutige Datum serverseitig ab, keine davon kennt die Zeitzone des Reiseziels, weil es sie im ganzen Repo nicht gibt. Daran hängt, ob der Live-Status überhaupt erscheint, welche Reise der Begleiter öffnet, welcher Reisetag angezeigt wird und ob die Position der Gruppe gespeichert und herausgegeben wird. Gemessen: ein Nutzer in Japan sieht an jedem Reisemorgen bis 09:00 Ortszeit den **Vortag**; in der ersten Nacht einer Italien-Reise ist der Live-Status **gar nicht da**. Das ist bug-004 eine Ebene höher — und bug-004s eigener Text formuliert genau das Prinzip, das hier verletzt wird.

**Zweiter neuer Befund, empirisch bestätigt: wer eine Options-Gruppe auf eine andere Uhrzeit zieht, verliert die Wahl der Gruppe.** Der Schlüssel der Wahl enthält Beginn und Ende; beim Umplanen schreibt niemand ihn nach. Die Wahl fällt still auf die erste Alternative zurück, und in der Tabelle bleibt eine verwaiste Zeile stehen, die nie jemand aufräumt.

**Dritter: die neue Idee stützt sich auf eine Voraussetzung, die nicht zutrifft** — dieselbe Fehlerart, die letzte Woche als N1 bei req-079 stand. `tageslicht-reicht-bis.md` schreibt, die Zuordnung Ort → Zeitzone sei „schon im Haus", weil Open-Meteo mit `timezone=auto` befragt wird. Der Antwort-Parser verwirft das Feld. Die Idee wäre damit nicht umsetzbar wie beschrieben — und sie ist der einzige neue Inhalt dieser Strecke.

## Neue Befunde

### N1. „Heute" wird in UTC bestimmt und als Ortsdatum am Reiseziel verwendet (hoch)

bug-004 („zeitzonenabhängige Programmpunkte", `delivery/bugs/done/`) ist behoben — in der Datenzugriffsschicht. `lib/db/sql-datetime.ts` liest die UTC-Getter und erklärt vollständig, warum; die letzte Review hat die Datei zu Recht gelobt. Was bug-004 **nicht** angefasst hat, ist die Stelle, an der die Anwendung entscheidet, welcher Tag heute ist.

Der Bugreport selbst formuliert den Maßstab (`bug-004...md`, „Warum das über die Tests hinaus zählt"):

> *„wegfara ist eine Reise-App. Ein Nutzer in Italien, ein Server in UTC und ein geplanter Programmpunkt um 13:30 müssen dieselbe Uhrzeit ergeben. Die Uhrzeit eines Programmpunkts ist eine Ortszeit am Reiseziel, kein Zeitpunkt auf einer absoluten Achse — sie darf sich nicht verschieben, egal wo Server oder Gerät stehen."*

Für Beginn und Ende gilt das jetzt. Für „heute" und „jetzt" gilt es nicht.

**Alle sechs Ableitungen, vollständig:**

```
$ grep -rn "toIsoDate(new Date())\|toISOString().slice(0, 10)" app lib --include=*.ts --include=*.tsx | grep -v '\.test\.'
app/page.tsx:40               today: new Date().toISOString().slice(0, 10)
app/go/page.tsx:30            const today = jetzt.toISOString().slice(0, 10)
app/plan/page.tsx:40          const today = new Date().toISOString().slice(0, 10)
app/api/positionen/route.ts:35    zeigtLiveStatus(trip, toIsoDate(new Date()))
app/api/positionen/route.ts:93    zeigtLiveStatus(trip, toIsoDate(jetzt))
app/api/live-status/route.ts:43   zeigtLiveStatus(trip, toIsoDate(jetzt))
```

Dazu die Uhrzeit selbst, `app/go/page.tsx:124`: `jetzt={lokaleZeit(jetzt)}` — serverseitig gerechnet, weil `app/go/page.tsx` eine Server-Komponente ist.

**Zwei verschiedene Mechanismen, dieselbe falsche Antwort.** Die drei `page.tsx` benutzen `toISOString()` und sind damit **unbedingt UTC**, egal wie der Server steht. Die drei Routen benutzen `toIsoDate()` (`lib/trips/date-utils.ts:1`, lokale Getter) und hängen damit an der Zeitzone des Containers — und `deploy/Dockerfile` setzt kein `TZ`, `node:22-alpine` läuft also in UTC:

```
$ grep -n "FROM\|ENV\|TZ" deploy/Dockerfile
4:FROM node:22-alpine AS deps
9:FROM node:22-alpine AS builder
15:FROM node:22-alpine AS runner
17:ENV NODE_ENV=production
18:ENV PORT=3000
19:ENV HOSTNAME=0.0.0.0
```

Heute liefern beide Wege dasselbe. Setzt irgendwann jemand `TZ=Europe/Berlin` auf dem Beelink, driften sie auseinander — und drei der sechs Stellen ändern ihr Verhalten, drei nicht.

**Es gibt keine Reisezeitzone, an der man es richtig machen könnte.** `grep -rn "timezone\|zeitzone" migrations/*.sql` liefert keine Spalte; `Trip` (`lib/trips/types.ts:11-19`) trägt `startDate`, `endDate` und `mainPlace {name, lat, lng}`, keine Zone. `lib/live-status/zeit.ts:4-5` sagt es selbst, ehrlich und an der richtigen Stelle:

> *„Gerechnet wird in der Zeitzone des Geraets bzw. des Servers; eine eigene Reisezeitzone gibt es (noch) nicht."*

Der Kommentar ist korrekt. Der Befund ist, was daran hängt.

**Woran es hängt** — alles, was `today` entgegennimmt:

| Stelle | Entscheidung |
|---|---|
| `lib/live-status/sichtbar.ts:12-16` `zeigtLiveStatus` | ob der Live-Status **überhaupt erscheint** (`go-view.tsx:296`, `:336`) |
| `lib/einstieg/ziel.ts:30-41` `laufendeReise` | welche Reise der Begleiter öffnet — und wohin `/` umleitet (`app/page.tsx:40`) |
| `lib/trips/select-default.ts:29-36` `defaultDay` | **welcher Reisetag angezeigt wird** |
| `app/api/positionen/route.ts:35` (GET) | ob die Positionen der Gruppe herausgegeben werden |
| `app/api/positionen/route.ts:93` (POST) | ob die eigene Position **überhaupt gespeichert** wird |
| `app/api/live-status/route.ts:43` | ob Ort und Verzug herausgegeben werden |

**Gemessen** (reine Rechnung, `node -e`, kein Zugriff auf die Anwendung):

```
Reise Italien 12.–19.05.   | UTC: 2027-05-11T23:30Z | today(app): 2027-05-11 | lokal am Ziel: 2027-05-12 01:30
Reise New York 12.–19.05.  | UTC: 2027-05-20T00:30Z | today(app): 2027-05-20 | lokal am Ziel: 2027-05-19 20:30
Reise Japan 12.–19.05.     | UTC: 2027-05-14T23:00Z | today(app): 2027-05-14 | lokal am Ziel: 2027-05-15 08:00
```

Was das für den Nutzer heißt, Zeile für Zeile:

1. **Italien, erste Nacht.** Ankunft spät, 01:30 Ortszeit, der Reisezeitraum beginnt heute. `today` ist der **Vortag**, also `< startDate` → `zeigtLiveStatus` ist `false`, `laufendeReise` liefert `null`. Der Begleiter öffnet nicht die laufende Reise, der Live-Status ist nicht da, und `POST /api/positionen` antwortet `{gespeichert: false}` — bei eingeschaltetem Schalter. Täglich zwischen 00:00 und 02:00 Ortszeit, aber nur am ersten Reisetag mit Folgen für die Sichtbarkeit.
2. **New York, letzter Abend.** 20:30 Ortszeit am Abreisetag. `today` ist schon **der Tag nach dem Reiseende** → die Reise gilt als beendet. Live-Status weg, Positionen weg, Ausgleichsübersicht und Tagesauswahl fallen auf `trip.startDate` zurück (`select-default.ts:35`). Jeden Abend nach 20:00 Ortszeit westlich von UTC verschiebt sich zusätzlich `defaultDay` um einen Tag nach vorn: der Begleiter springt auf den **Folgetag**, während die Gruppe noch unterwegs ist.
3. **Japan, jeder Morgen.** 08:00 Ortszeit, mitten im Reisezeitraum. `today` ist der **Vortag** → `defaultDay` öffnet den Vortag. Der Begleiter zeigt an jedem Reisemorgen bis 09:00 Ortszeit das Programm von gestern. Kein Hinweis, kein Fehler, nur der falsche Tag.

Richtung und Größe des Fehlers sind genau der Zonenversatz: östlich von UTC trifft es den Morgen, westlich den Abend — und in der Mitteleuropa-Sommerzeit, für die die App gebaut ist, sind es zwei Stunden nach Mitternacht.

**Die Uhrzeit ist derselbe Fall, eine Größenordnung kleiner.** `app/go/page.tsx:124` rechnet `lokaleZeit(jetzt)` auf dem Server (UTC) und übergibt sie als Startwert; `live-status.tsx:48` ersetzt sie im Browser mit der Gerätezeit, aber erst wenn der Takt läuft — `UHR_INTERVALL_MS = 20_000` (`:13`). Bis zu **zwanzig Sekunden** nach jedem Seitenaufbau rechnet der Begleiter den laufenden Programmpunkt mit einer um den Zonenversatz verschobenen Uhr. Der Kommentar dazu (`go/page.tsx:122-123`) ist in seiner Absicht richtig — *„beginnt beim Aufbau der Seite und laeuft danach im Geraet weiter"* —, nur überquert die Übergabe eine Zeitzonengrenze, die nirgends benannt ist.

**Kein Test hält das fest.** Die Domänenfunktionen sind sauber getestet (`sichtbar.test.ts`, `select-default.ts`, `status.ts` — alle nehmen das Datum als Parameter, genau richtig). Geprüft wird nie, **welches** Datum die sechs Aufrufstellen hineingeben.

**Empfehlung, in dieser Reihenfolge — die erste Hälfte ist klein, die zweite ist eine Entscheidung:**

1. **Sofort und ohne neue Daten: eine Stelle statt sechs.** `heutigesDatum()` nach `lib/trips/date-utils.ts`, neben `toIsoDate`, mit dem Kommentar, in welcher Zone sie gilt — und alle sechs Aufrufstellen darauf umstellen. Das behebt noch nichts, macht aber aus einem verteilten Befund einen einzeiligen. Dazu die Zusicherung nach dem Muster von `app/api/api-guard.test.ts:53`: „kein `toISOString().slice(0, 10)` und kein `toIsoDate(new Date())` außerhalb von `lib/trips/date-utils.ts`". Zehn Zeilen, und sie verhindert die siebte Stelle.
2. **Die Zeitzone der Reise erheben.** Open-Meteo liefert sie bereits mit — der Abruf schickt `timezone=auto` (`lib/weather/open-meteo-client.ts:15`), die Antwort trägt ein Feld `timezone`, und `parseOpenMeteoResponse` (`:35-74`) liest es nicht. Eine Zeile im Parser, ein Feld in `OpenMeteoForecast`, eine Spalte `time_zone text` an `trip` (nullable, nachgeholt beim nächsten Wetterabruf). Siehe N3 — die neue Idee braucht genau das.
3. **Mit der Zone rechnen.** `heutigesDatum(trip)` über `Intl.DateTimeFormat("sv-SE", {timeZone})` — das liefert direkt `YYYY-MM-DD` und braucht keine eigene Zonenrechnung. Dasselbe für `lokaleZeit`. Solange keine Zone bekannt ist, bleibt es beim heutigen Verhalten; dann ist der Fehler wenigstens auf eine Datenlücke zurückgeführt statt auf eine Annahme.
4. **Bis dahin die Lücke gegen den Nutzer entschärfen.** Die Tagesauswahl im Begleiter einmal im Browser nachziehen — `today` ist dort über `new Date()` korrekt in der Gerätezeit zu haben, und das Gerät eines Reisenden steht in der Zone des Reiseziels. Das trifft die Fälle 1 und 3 vollständig, ohne eine einzige neue Spalte. Es ist der kleinste Schritt mit sichtbarer Wirkung und unabhängig von 2 und 3 richtig.

### N2. Die Wahl in einer Options-Gruppe überlebt das Umplanen nicht, und die Zeile bleibt für immer (mittel-hoch)

Eine Options-Gruppe ist bewusst keine eigene Entität. `migrations/0005_activity_option_selection.sql` begründet das vollständig:

> *„Eine Gruppe ist keine eigene Entitaet -- sie ergibt sich rein daraus, dass mehrere Programmpunkte derselben Reise in Beginn und Ende exakt uebereinstimmen (siehe Constraints in req-004) -- daher referenziert der Schluessel trip_id/start_at/end_at statt einer Gruppen-ID."*

Die Entscheidung ist nachvollziehbar und `lib/activities/groups.ts` setzt sie konsequent um (`groupKey` an einer Stelle, `tripIdOfGroupKey` daneben, *„sein Aufbau soll an genau einer Stelle bekannt sein"*). Der Preis steht nirgends: **ändert sich Beginn oder Ende, ändert sich der Schlüssel — und die Wahl findet ihre Gruppe nicht mehr.**

`updateActivityTimes` (`lib/db/activities.ts:157-173`) schreibt nur `activity`:

```ts
`update activity set start_at = $2, end_at = $3
 where id = $1
 returning ${ACTIVITY_COLUMNS}`
```

Kein Nachziehen von `activity_option_selection`. `deleteActivity` macht es im Nachbarfall vorbildlich richtig und schreibt auch warum (`:180-184`: *„Was auf ihn zeigte, geht mit ihm … eine Wahl unter Alternativen (req-004) hat ohne ihn kein Ziel"*) — beim Verschieben fehlt derselbe Gedanke.

**Und Alternativen werden einzeln gezogen.** `app/plan/components/timeline-column.tsx:578` setzt `draggable` an **jeder Options-Zeile**, nicht an der Gruppe. Eine Gruppe auf eine andere Uhrzeit zu bringen heißt also: jede Alternative einzeln ziehen. Genau das habe ich gemessen.

**Messung** (Wegwerf-Testdatei unter `lib/db/`, danach entfernt; `git status` sauber):

```
VORHER wahl= Option B
ZEILEN in der Tabelle: {"<trip>|2026-07-21T13:30|2026-07-21T15:00":"<Option B>"}
NEUER Gruppenschluessel: <trip>|2026-07-21T16:00|2026-07-21T17:30
WAHL fuer die neue Gruppe: (keine -- faellt auf Option A zurueck)
VERWAISTE Zeile zeigt noch auf: Option B
```

Zwei Alternativen um 13:30, Option B gewählt, beide nach 16:00 gezogen — die Gruppe steht wieder zusammen, die Wahl ist weg, und die alte Zeile steht noch da.

**Drei Folgen, aufsteigend:**

1. **Die Wahl fällt still auf die erste Alternative zurück.** `gewaehlteActivity` (`lib/map/day-map.ts:188-199`) und `resolveGroupActivity` (`timeline-column.tsx:184-192`) nehmen beide `?? group.activities[0]`. Der Rückfall ist richtig gebaut — er fängt genau diesen Fall ab, statt abzustürzen. Aber er ist stumm: Marker, Linie, Pfeil und Kachel zeigen danach Option A, und der Nutzer hat B gewählt. Die Reihenfolge der Alternativen richtet sich dabei nach `order by a.start_at asc, a.id asc` (`lib/db/activities.ts:79`), also effektiv nach der UUID — welche Alternative „die erste" ist, ist für den Nutzer nicht erkennbar.
2. **Verwaiste Zeilen sammeln sich und werden mitgesichert.** Niemand räumt sie auf: die einzigen Löschstellen sind `deleteActivity` (über `selected_activity_id`) und `deleteTrip` (`lib/db/trips.ts:327`, über `trip_id`). Eine Zeile zu einem Zeitfenster, in dem keine Gruppe mehr liegt, bleibt bis zum Löschen der Reise — und `lib/backup/tables.ts:28` führt `activity_option_selection` in der Sicherung, trägt sie also in jedes Backup.
3. **Eine verwaiste Zeile kann eine fremde Gruppe stumm schalten.** Zieht später eine andere Alternative in dasselbe Zeitfenster, trifft sie auf eine Wahl, die auf einen Programmpunkt zeigt, der nicht mehr dazugehört. Im Planer fängt das der Rückfall. Im Begleiter nicht: `app/go/components/timeline.tsx:110-113` übergibt die gespeicherte Kennung **ungeprüft** als `selectedId` an `ActivityOptionGroup`, und dort vergleicht jede Karte und jeder Punkt `activity.id === selectedId` (`activity-option-group.tsx:62`, `:76-78`). Trifft keine, ist **keine** Alternative markiert und **kein** Punkt aktiv — während die Karte daneben Option A als gewählt zeichnet. Zwei Ansichten derselben Gruppe, zwei verschiedene Aussagen.

**Empfehlung — zwei kleine Schritte, dann eine Grundsatzfrage:**

1. **Die Wahl mitziehen.** `updateActivityTimes` kennt Alt- und Neuzeit; ein `update activity_option_selection set start_at = …, end_at = … where trip_id = … and start_at = … and end_at = … and selected_activity_id = $id` nach dem `update activity` hält die Wahl an ihrem Programmpunkt fest. Dazu der Test „die Wahl überlebt das Umplanen der Gruppe" — die Messung oben ist der Repro-Test, er ist heute rot. Achtung auf den Primärschlüssel: liegt am Ziel schon eine Zeile, gewinnt die neue (`on conflict … do update`), und die Funktion braucht dafür eine Transaktion (siehe 18.08. #7, derselbe Topf).
2. **Die ungeprüfte Kennung im Begleiter abfangen.** `timeline.tsx:110-113` auf dasselbe `.find(…) ?? activities[0]` umstellen, das `day-map.ts` und `timeline-column.tsx` schon benutzen — am besten indem `resolveGroupActivity` nach `lib/activities/groups.ts` wandert, wo `groupKey` schon liegt. Dann sagen alle drei Ansichten dasselbe, und `stack.md` (Conventions, geteilte Logik nach `lib/`) ist erfüllt statt dreifach kopiert.
3. **Die Grundsatzfrage festhalten, nicht lösen.** Dass eine Gruppe keine Entität ist, kostet jedes Mal eine Nachziehregel, wenn sich ihre Merkmale ändern. Das ist eine vertretbare Entscheidung — sie sollte aber in `migrations/0005…sql` den Satz dazubekommen, der heute fehlt: *jede Änderung von `start_at`/`end_at` muss die Wahl mitnehmen.* Die Datei begründet die Entscheidung; sie nennt ihre Pflicht nicht.

### N3. Die neue Idee stützt sich auf eine Zeitzone, die es im Repo nicht gibt (mittel)

`delivery/idea/tageslicht-reicht-bis.md` ist ein sorgfältiges Dokument. Es grenzt sich gegen drei vorhandene Ideen ab, nennt Quelle, Lizenz, Kosten und Speicherung ausdrücklich, begründet, warum Open-Meteo für diesen Zweck untauglich ist (`FORECAST_DAYS = 16` gegen eine drei Monate im Voraus geplante Reise — zutreffend, `lib/weather/open-meteo-client.ts:4`), und sagt bei den Sonderfällen Polartag und Polarnacht genau das Richtige. Auch die Abgrenzung am Schluss („goldene Stunde, Mondphasen: bewusst nicht") folgt dem Leitprinzip, auf das sie sich beruft.

Ein Satz in Schritt 1 trägt das Ganze — und er stimmt nicht:

> *„Die Zeitzone kommt aus dem Ort der Reise; Open-Meteo wird bereits mit `timezone=auto` befragt, die Zuordnung ist also schon im Haus."*

`timezone=auto` sagt Open-Meteo, in **welcher** Zone es die Zeitstempel seiner Antwort ausgeben soll. Die Zone selbst steht als Feld `timezone` in der Antwort — und `parseOpenMeteoResponse` (`lib/weather/open-meteo-client.ts:35-74`) liest sie nicht:

```ts
const current = (body as …)?.current …
const daily   = (body as …)?.daily …
```

Mehr nicht. `OpenMeteoForecast` hat kein Zonenfeld, `Trip` hat keins (`lib/trips/types.ts:11-19`), `migrations/` hat keine Spalte. Die Zuordnung ist nicht im Haus; sie wird einmal pro Wetterabruf geliefert und weggeworfen.

**Warum das die Idee trifft und nicht nur eine Fußnote ist.** Die Rechnung aus Schritt 1 (NOAA, `suncalc`) liefert zu Koordinate und Datum einen **absoluten Zeitpunkt**. Beginn und Ende eines Programmpunkts sind in wegfara ausdrücklich **keine** absoluten Zeitpunkte, sondern Ortszeit am Reiseziel ohne Zone — so steht es an jedem Feld (`lib/activities/types.ts:25-27`) und so hat bug-004 es festgelegt. Um „liegt dieser Programmpunkt im Dunkeln?" zu beantworten, muss der absolute Untergangszeitpunkt in genau diese Ortszeit umgerechnet werden, und dafür braucht es den Versatz. Ohne ihn vergleicht Schritt 3 („Licht reicht bis") einen UTC-Zeitpunkt mit einer Ortszeit-Wanduhr — in Italien im Sommer **zwei Stunden** daneben. Das ist mehr als die Reserve, um die es bei „schaffe ich den Rückweg noch im Hellen?" überhaupt geht.

Damit ist auch die Behauptung „braucht **gar keine** Datenquelle" zu scharf: die Himmelsmechanik braucht keine, die Zonenzuordnung schon — nur ist sie billig zu bekommen (eine Zeile im Parser, siehe N1 Schritt 2).

**Das ist dieselbe Fehlerart wie letzte Woche.** req-079 hat eine Anzeige auf vier Spalten gebaut, die die Anwendung nie schreibt (N1 der letzten Review, unverändert offen). Hier soll eine Idee auf ein Feld bauen, das die Anwendung verwirft. Beides entsteht nicht aus schlechtem Code, sondern daraus, dass ein Dokument eine Voraussetzung **behauptet**, statt sie zu prüfen. Nach zweimal in zwei Wochen ist das ein Muster, und es ist billig zu brechen: ein Grep pro Behauptung, bevor sie im Dokument landet.

**Empfehlung:**

1. Den Satz in `tageslicht-reicht-bis.md` (Skizze, Schritt 1) korrigieren und die Zonenerhebung ausdrücklich in die Idee aufnehmen: *eine Zeile im Open-Meteo-Parser, ein Feld an `OpenMeteoForecast`, eine Spalte `time_zone` an `trip`.* Damit ist die Idee wieder vollständig — und wird gleichzeitig zur Voraussetzung für N1 Schritt 2. Das ist kein Mehraufwand, sondern derselbe Aufwand an der richtigen Stelle.
2. „keine externe Quelle" zu „keine externe Quelle für die Rechnung; die Zonenzuordnung kommt aus dem Wetterabruf, der ohnehin läuft" schärfen.
3. Für künftige Ideen und Requirements: jede Behauptung über vorhandene Daten mit der Fundstelle belegen, an der sie **geschrieben** wird — nicht mit der, an der sie gelesen werden könnte. req-079 (`booked`, `bookingUrl`, …) und diese Idee (`timezone`) wären beide an diesem einen Grep gescheitert.

### N4. `delivery/datenbank.md` zählt 27 Tabellen, listet 26 und beschreibt 24 (niedrig)

`CLAUDE.md` verlangt: *„Sie ist eine Momentaufnahme; die Wahrheit sind die Migrationen in `migrations/`. Wird das Schema geaendert, ist sie nachzuziehen."* Die Datei sagt das über sich selbst auch (`datenbank.md:9-11`) — und sie ist in dieser Strecke unangetastet, weil es keine Schemaänderung gab. Beim Nachmessen fallen drei Abweichungen auf, die älter sind:

```
$ grep -hoE "create table [a-z_]+" migrations/*.sql | sed 's/create table //' | sort -u   # 29
  … minus guest_access, guest_session (0033), recovery_code (0046)                        # = 26 Tabellen
$ grep -cE "^### " … im Überblick der Datei                                               # = 26 genannt
$ Abschnitte mit eigener Beschreibung                                                     # = 24
```

- **Die Überschrift sagt „27 Tabellen"**, die Tabelle darunter listet 26 (4 + 4 + 14 + 2 + 2). Die 27. ist vermutlich eine der entfernten — `recovery_code` fiel mit req-066 am 19.09., also am Tag des Datei-Stands.
- **`rating_round_poi` und `rating_vote`** stehen im Überblick, haben aber keinen `###`-Abschnitt. Die Bewertungsrunden sind damit die einzige Gruppe, deren Spalten in der Momentaufnahme fehlen — und `lib/db/rating-rounds.ts` ist mit sieben Account-Filtern eines der dichter verzahnten Module.
- Der Stand (`2026-09-19`) ist derselbe Tag, an dem `0047_poi_foto_ki.sql` dazukam. Ob die KI-Foto-Spalten drin sind, ist damit Zufall, nicht Prüfung.

**Empfehlung:** Die Zahl aus der Liste rechnen statt sie zu schreiben, und die zwei fehlenden Abschnitte ergänzen. Darüber hinaus die einzige Maßnahme, die das dauerhaft löst: eine Zusicherung, die `create table`/`drop table` in `migrations/` gegen die Überschriften in `datenbank.md` abgleicht. Zwanzig Zeilen, nach dem Muster von `app/api/api-guard.test.ts:53`, und sie macht aus „ist nachzuziehen" eine Prüfung statt einer Bitte. Dasselbe Werkzeug beantwortet auch N1 Schritt 1 und N3 Punkt 3 — es ist dieselbe Sorte Befund dreimal: **eine bindende Vorgabe ohne Messpunkt.**

## Unverändert offen

Alle Befunde der Vorgänger-Reviews, einzeln am Stand 6162b77 nachgemessen. Der Quelltext ist zu b0a2cf7 identisch — die Spalte „Messung" ist das Ergebnis des Nachprüfens, nicht eine Wiederholung der Angabe.

| Herkunft | Befund | Messung am Stand 6162b77 |
|---|---|---|
| 29.09. N1 | req-079 zeigt einen Buchungszustand, den die App nicht erzeugen kann | ❌ `grep -iE "insert\|update\|set " lib/db/*.ts` auf die vier Spalten: **keine Schreibstelle** |
| 29.09. N2 | Quality-Gate ohne `testTimeout` | ❌ `grep testTimeout vitest.config.ts` leer; zwei Läufe 195,56 s / 124,04 s, beide grün — **58 % Streuung** |
| 15.09. N1 / 22.09. N2 / 29.09. N3 | Planungskarte meldet die Worker-Adresse nicht | ❌ **sechste Review** — `day-route-map.tsx:281` `new MapLibreMap(` ohne `ensureMapWorkerUrl`; die beiden anderen Karten haben es. `day-route-map.test.tsx:95-97` liest unverändert `getSource(…).data` |
| 29.09. N4 | Zoom und Reisetag überleben den Bereichswechsel nicht | ❌ `planung-view.tsx:143` `useState(ZOOM_GRUNDSTUFE_PX)` unverändert in der unmountenden Komponente; der falsche Kommentar (*„wie die Filter"*) steht noch |
| 29.09. N5 | „Mehr lesen" leert die Kachel ohne Langtext | ❌ `activity-card.tsx:94` `{expanded ? longText : shortText}`, `:136` Knopf unbedingt |
| 22.09. N5 / 29.09. N6 | Zwei Routen bitten um Zwischenspeicher, die middleware verbietet ihn | ❌ `poi-fotos/[id]/route.ts:43` und `dokumente/[id]/route.ts:45` unverändert `private, max-age=86400`; der matcher (`middleware.ts:120`) nimmt beide nicht aus |
| 15.09. N3 / 22.09. N4 / 29.09. N7 | Kein ausgehender Netzaufruf hat ein Zeitlimit | ❌ **fünfte Review** — `grep "AbortSignal.timeout\|timeout:" lib/{google,osm,weather,routing,ai}`: **kein Treffer** |
| 29.09. N8 | `normalizeWeb` prüft kein Schema | ❌ `lib/pois/validate.ts:122` unverändert `/^[a-z][a-z0-9+.-]*:\/\//i` |
| 22.09. N7 / 29.09. N9 | `readBody` fünfzehnmal, sieben nackte `request.json()` | ❌ `grep -rln "async function readBody" app \| wc -l` → **15** |
| 15.09. N2 | E2E-Bildschirmprüfung erreicht fünf Planer-Bereiche nie | ⚠️ halb — unverändert; `SWITCHABLE_PLAN_AREAS` und `planAreaPath()` liegen bereit, der `for`-Loop fehlt |
| 15.09. N4 / 22.09. N6 | Wiederherstellung leert die Bildablage nach dem `commit` | ❌ offen — `lib/backup/store.ts:316-321` Zeile für Zeile unverändert |
| 15.09. N5 / 22.09. N6 | `deleteTrip` ohne Transaktion | ❌ offen — `withDatabaseClient` hat unverändert **einen** Verwender (`app/api/backups/[id]/wiederherstellen/route.ts:78`) |
| 22.09. N3 | `setPoiStatuses` als Schleife, Route ohne `try/catch` | ❌ offen |
| 15.09. N6 / 29.09. N10 | POI-Nummer per Read-then-Write | ❌ offen — `lib/db/pois.ts:326` |
| 25.08. N1 | Trefferflächen der Eckpunkt-Griffe 22 statt 44 px | ❌ **siebte Review** — `poi-map.module.css:367-368` `width: 22px; height: 22px` |
| 25.08. N3 | Kommentare verweisen auf nicht existentes `bug-011` | ❌ offen — **neun Fundstellen** in sechs Dateien (5 in `.ts`/`.tsx`, 4 in CSS); `delivery/bugs/` kennt bug-011 nicht, auch nicht in `done/` |
| 25.08. N5 | Kein `.dockerignore` | ❌ **sechste Review** — `ls -a \| grep docker` leer; `deploy/Dockerfile` `COPY . .` |
| 18.08. #2 | Schreib-Debounce aus `stack.md:282` existiert nirgends | ❌ **neunte Review** — kein Verwender |
| 18.08. #4, #6, #9 | Anmeldelink per GET; Rate-Limiter O(n); Secure-Flag am `x-forwarded-proto` | ❌ offen (alle drei mit dokumentierter Begründung im Code) |
| 18.08. #7 | Mehrschrittige Schreibvorgänge ohne Transaktion | ❌ offen, fünf Fälle — N2 fügt einen sechsten hinzu |
| 18.08. #8 | Demo-Daten in den Schema-Migrationen | ❌ offen, und über req-079 unverändert **tragend** |
| 01.09. N4 | Open-Meteo fehlt in der Mock-Liste `stack.md:203` | ⚠️ halb — **fünfte Review**; N3 gibt ihr ein zweites Gesicht |
| 01.09. N5 | `OSM_STYLE` dreimal | ❌ offen — `go/map-view.tsx:25`, `plan/day-route-map.tsx:30`, `plan/poi-map.tsx:52` |
| 29.09. N10 | `updateKostenzeile` ohne `activity_id is null`; `startRatingRound` ohne `catch`; `toggleMapStatus` ohne Updater-Form; `CLAUDE.md:1` `# <Projektname>`; Pfeilname aus falscher Alternative; CSS-Kommentar; Anführungszeichen | ❌ alle offen; `head -1 CLAUDE.md` → `# <Projektname>` (**sechste Review**) |
| Security 30.09. | siehe `delivery/security/2026-09-30-security-wegfara-42b2d65.md` | nicht Gegenstand dieser Review |

**Ein Satz zur Lage:** Dass eine Woche ohne Codeänderung vergeht, ist für sich kein Befund — es gab in dieser Strecke keinen Requirement und keinen Bug abzuarbeiten. Was auffällt, ist die Verteilung der Arbeit, die **doch** stattgefunden hat: drei Dokumente, 858 Zeilen, davon 490 ein Bericht über eine Liste, deren erste drei Punkte zusammen *„unter einer Stunde"* dauern (letzte Review, Empfohlene Reihenfolge) und seit sechs Wochen offen sind. Punkt 1 dieser Liste — `ensureMapWorkerUrl()` in `day-route-map.tsx:281` — ist **eine Zeile plus Import**. Die Review darüber ist jetzt länger als jede einzelne Datei im `lib/map/`-Verzeichnis, über das sie berichtet.

## Was in Ordnung war

Weil der Code unverändert ist, nenne ich hier nur, was mir beim Nachmessen in den **neu betrachteten** Bereichen aufgefallen ist — nicht das, was die letzte Review schon gelobt hat.

- **Die Mandantentrennung hält auch dort, wo sie es am leichtesten nicht täte.** Ich habe `lib/db/` nach den Modulen mit den **wenigsten** `account_id`-Vorkommen durchsucht — die drei Verdächtigen (`activity-option-selections.ts` mit 1, `search-area.ts` mit 1, `activities.ts` mit 2) sind alle drei sauber: sie filtern über `join trip t on t.id = … where t.account_id = $1` beim Lesen und rufen `tripBelongsToAccount` vor jedem Schreiben. `setSearchArea` (`search-area.ts:47`) und `setActivityOptionSelection` (`:48`) tun es jeweils in der **ersten Zeile** und schreiben den Grund daneben: *„Der Account stammt aus der Anmeldung, die Reise aus der Anfrage — gehoert sie nicht zu diesem Account, passiert nichts."* Das ist die Vorgabe aus `stack.md` (req-024) nicht zitiert, sondern an der Außenkante jeder Funktion erzwungen. `lib/db/account-isolation.test.ts` prüft dasselbe eine Ebene höher, mit zwei echten Accounts und einem Gesamt-Admin, der dazwischen wechselt.
- **Die Gruppenkasse rechnet in Cent und beweist, dass die Summe stimmt.** `lib/expenses/money.ts` sagt in seinem Kopfkommentar, was es nie tut (*„Gerechnet wird nie mit Gleitkommazahlen"*) und warum (*„die Summe der Anteile muss den Gesamtbetrag exakt treffen"*). `lib/expenses/split.ts` löst den Rundungsrest nicht durch Wegsehen, sondern mit einer benannten Regel und einer Funktion dafür: `restTraeger` — der Zahler trägt den Rest, *„Ist der Zahler selbst nicht beteiligt, hat er nur ausgelegt; den Rest traegt dann die erste beteiligte Person, damit die Summe trotzdem stimmt."* Derselbe Gedanke zweimal, für die gleichmäßige und die einzeln erfasste Teilung, über **dieselbe** Hilfsfunktion. Und `computeBalances` (`balances.ts:44-58`) hängt Personen an, die in den Ausgaben vorkommen, aber nicht mehr Teilnehmer sind — mit der Begründung, die den Fall erst sichtbar macht: *„sein Saldo verschwaende sonst, und die Summe aller Salden ergaebe nicht mehr null."* Das ist eine Invariante, die sich selbst verteidigt.
- **`settlePayments` begründet seine Komplexitätsschranke mit einer Zahl.** `lib/expenses/settlement.ts:28-37`: *„Jede Zahlung gleicht damit mindestens eine Person vollstaendig aus, sodass bei n Personen hoechstens n-1 Zahlungen bleiben -- bei sechs Personen fuenf statt der fuenfzehn, die jeder-mit-jedem ergaebe."* Dazu `settlementDraft`, das eine abgehakte Rückzahlung als gewöhnliche Ausgabe ablegt, ausdrücklich statt einer zweiten Ablage — *„so laesst sich die Zahlung ueber die Ausgabenliste wieder entfernen, und der Vorschlag taucht dadurch von selbst wieder auf."* Eine Entscheidung, die eine ganze Tabelle und eine ganze Rückgängig-Funktion eingespart hat, mit dem Grund daneben.
- **Die Standortdaten halten das Leitprinzip im Schema, nicht in der Oberfläche.** `migrations/0035_teilnehmer_position.sql` erzwingt über den zusammengesetzten Primärschlüssel, dass je Teilnehmer und Reise **höchstens eine** Zeile existiert, und schreibt dazu: *„Jede neue Messung ueberschreibt die vorherige: es entsteht keine Historie und kein Bewegungsprofil (siehe delivery/vision.md, Leitprinzipien). Wer nicht mehr teilt, hat keine Zeile; das Vorhandensein der Zeile ist die Freigabe."* `0040_position_sharing.sql` trennt die **Freigabe** von der **letzten Messung** und begründet, warum das zwei Dinge sind (*„etwa waehrend die Reise noch in Planung ist und noch gar nichts geteilt werden darf"*). Die Vision sagt *„ohne Historie"*; hier ist es keine Regel, die man einhalten muss, sondern eine, die man nicht brechen kann. (Dass die Zeitprüfung darüber in UTC rechnet, ist N1 — die Ablage selbst ist vorbildlich.)
- **`app/api/ki-planung/route.ts` lässt die KI nichts tun, was ein Mensch nicht dürfte.** Die Übernahme eines KI-Vorschlags (`:133-162`) prüft jeden Punkt einzeln: gehört der Programmpunkt zu dieser Reise (`:139`), liegt die neue Zeit im Reisezeitraum — *„geprueft mit derselben Domaenenlogik wie das Umplanen von Hand"*, nämlich `movedActivityTimes` —, und ein neuer Punkt entsteht aus seinem POI, *„Titel, Typ, Texte und Dauer kommen von dort, nie aus der Anfrage (req-039)."* Die KI darf vorschlagen, wohin etwas gehört, und nichts weiter. Das ist das Leitprinzip *„vorschlagen statt selbst umbauen"* als Codepfad, und es ist die Stelle, an der ein KI-Feature üblicherweise eine Lücke lässt.
- **`lib/db/sql-datetime.ts` ist der Grund, dass N1 nur die halbe Zeitrechnung trifft.** Die Datei erklärt in sechs Zeilen, warum der Treiber `timestamp without time zone` als `Date` mit UTC-interpretierten Komponenten liefert und lokale Getter die Uhrzeit verschieben würden. Weil sowohl `activities.ts` als auch `activity-option-selections.ts` durch diese **eine** Funktion gehen, ist der Kern von bug-004 dauerhaft zu. Die Datei ist auch der Beweis, dass das Repo diese Fehlerklasse kennt und lösen kann — was N1 nicht entschuldigt, aber einordnet.
- **`app/api/health/route.ts` und `delivery/health.md` sagen dasselbe, und beide sagen auch, was sie *nicht* prüfen.** Die Route verzichtet bewusst auf die Datenbank (*„er soll auch dann antworten, wenn die DB gerade nicht erreichbar ist"*), prüft dafür die Bildablage und gibt bei einem Problem `503` samt der Begründung, warum der Pfad **nicht** in der Antwort steht: *„der Endpunkt ist oeffentlich … und gibt nur preis, dass etwas nicht stimmt, nicht wo."* `health.md` nennt dazu, warum `/` als Prüfung untauglich ist (`307` auf die Anmeldung) und warum die KI-Prüfung grün sein kann, während die Suche für einen Account nicht geht. Nachgemessen: `/api/health` steht in `PUBLIC_PATHS` (`middleware.ts:41`) — die Prüfung kommt also wirklich durch. Eine Health-Beschreibung, deren Grenzen mit aufgeschrieben sind, ist selten.

## Empfohlene Reihenfolge

Vorbemerkung, zum dritten Mal: Die Punkte 1 bis 3 der **letzten** Review waren zusammen *„unter einer Stunde"* und schlossen einen Befund ab, der inzwischen in der sechsten Review steht. Sie sind nicht angefasst worden. Ich stelle sie deshalb wieder an den Anfang und schiebe die neuen Befunde dahinter — **nicht**, weil sie weniger wichtig wären, sondern weil eine Liste, deren Spitze sich nicht bewegt, ihre Reihenfolge nicht mehr aussagt.

1. **Die drei Zeilen von letzter Woche, unverändert.** `linien()` in `day-route-map.test.tsx:95-97` auf `querySourceFeatures` (Repro-Test, schlägt fehl) → `ensureMapWorkerUrl()` in `day-route-map.tsx:281` (Fix, Test wird grün) → die Struktur-Zusicherung „jede Datei mit `new MapLibreMap(` enthält `ensureMapWorkerUrl(`". Zwei Zeilen Produktivcode, zehn Zeilen Test. Danach zeigt die Tageskarte ihre Linien, die Pfeile aus req-075 liegen auf etwas, der Kontrast aus bug-059 wirkt erstmals — und die Serie endet, statt verwaltet zu werden.
2. **`testTimeout: 15000` in `vitest.config.ts`.** Eine Zeile. Zwei Läufe mit 58 % Streuung, beide knapp grün, sagen dasselbe wie letzte Woche ein roter und ein grüner: das Gate vor dem prod-Deploy ist ein Münzwurf. Dazu die drei Tipptests auf `paste()`/`fill()`.
3. **N1 Schritt 1 und 4** — `heutigesDatum()` an **einer** Stelle in `lib/trips/date-utils.ts`, alle sechs Aufrufstellen darauf, die Zusicherung dagegen, und die Tagesauswahl im Begleiter einmal im Browser nachziehen. Ohne neue Spalte, ohne neue Datenquelle. Das trifft den Japan-Morgen und die Italien-Nacht vollständig und macht aus einem sechsfachen Befund einen einzeiligen. Vor allem anderen Neuen, weil es das Einzige auf dieser Liste ist, das der Nutzer **jeden Tag** merkt, sobald er die Zeitzone wechselt — und das ist der Zweck der App.
4. **N2 Schritt 1 und 2** — die Wahl beim Umplanen mitziehen (mit Transaktion), und `resolveGroupActivity` nach `lib/activities/groups.ts` heben, damit der Begleiter dieselbe Prüfung macht wie Karte und Planer. Die Messung aus N2 ist der Repro-Test. Zusammen unter einer Stunde, und es beendet eine stille Datenverfälschung in genau dem Bereich, in dem die letzte Strecke gearbeitet hat.
5. **N3** — den falschen Satz in `tageslicht-reicht-bis.md` korrigieren und die Zonenerhebung in die Idee aufnehmen. Fünf Minuten, und sie ist die Voraussetzung für N1 Schritt 2. Danach die Zeile im Open-Meteo-Parser und die Spalte `time_zone` an `trip` — das ist N1 Schritt 2+3 und die Grundlage für zwei Features statt eines.
6. **15.09. N2** — der E2E-Fluss `for (const area of SWITCHABLE_PLAN_AREAS) await seite.goto(planAreaPath(area))`. Sechs Zeilen, fünf bisher ungeprüfte Oberflächen bei drei Breiten, und er fängt Punkt 1 an der echten Anwendung.
7. **29.09. N1** — entscheiden, ob der Buchungszustand pflegbar wird oder die Anzeige zurückgenommen wird; bis dahin die Zusicherung „jedes gelesene Feld wird irgendwo geschrieben" und die falsche Zeile in req-079 korrigieren. Zusammen mit N3 ist das zweimal dieselbe Fehlerart in zwei Wochen; die Zusicherung bedient beide.
8. **29.09. N4 + N5** — Zoom und Reisetag nach `PlanView` heben und in die Sitzungsablage aufnehmen; „Mehr lesen" nur anbieten, wenn es etwas zu lesen gibt. Zwei Befunde, die der Nutzer sofort merkt.
9. **29.09. N6** — `/api/poi-fotos`, `/api/dokumente` und `ICON_BASIS_PFAD` in den matcher-Ausschluss, je eine Zusicherung dafür, und die E2E-Messung der Kopfzeile in `begleiter.e2e.ts`.
10. **29.09. N7** — Zeitlimits an den zehn Aufrufstellen plus zwei OpenAI-Zeilen, und die bis zu 160 Aufrufe in `poi-search` nebenläufig statt nacheinander. Fünfte Review; Schritt 3 ist der, den der Nutzer sofort merkt.
11. **22.09. N3 + N6** — `setPoiStatuses` auf ein `update … where id = any($1::uuid[])` und die Route den Fehler fangen lassen; `deleteTrip` in eine Transaktion; die Reihenfolge der Wiederherstellung umdrehen. Gemeinsam anzufassen, und N2 Schritt 1 braucht dasselbe Werkzeug.
12. **Ein Durchgang über die Kleinigkeiten** — `normalizeWeb` auf eine Positivliste; `readBody` und `istUuid` nach `lib/api/` und in alle einundzwanzig Routen; `and activity_id is null` in `aendere`; `catch` in `startRatingRound`; POI-Nummer per SQL; `toggleMapStatus` zurück auf die Updater-Form; `.dockerignore`; **`CLAUDE.md:1`**; die Mock-Liste in `stack.md`; `OSM_STYLE` nach `lib/map/`; die neun `bug-011`-Verweise; N4 (`datenbank.md`); der doppelte CSS-Kommentar; das Anführungszeichen.
13. **25.08. N1** — Trefferflächen der Griffe, siebte Review. Entweder das `border: 7px solid transparent`-Muster aus `.drawButton`, oder die Ausnahme in `stack.md` festhalten. Aber nicht weiter stumm gegen eine bindende Vorgabe verstoßen, die `seitenleiste.layout.test.ts` dreifach prüft.
14. **18.08. #2** (Schreib-Debounce) — neunte Review. Die Vorgabe `stack.md:282` hat keinen einzigen Verwender. Die Entscheidung ist, in welche Richtung sie aufgelöst wird; sie weiter mitzuschleppen entwertet den Rest einer guten Datei.

**Eine Beobachtung quer über 1, 3, 5, 7 und 12:** Fünf der vierzehn Punkte sind im Kern derselbe Befund — **eine bindende Vorgabe ohne Messpunkt**. „Jede Karte meldet die Worker-Adresse", „jedes gelesene Feld wird geschrieben", „kein eigenes Heute-Datum außerhalb von `date-utils`", „`datenbank.md` folgt den Migrationen", „geteilte Logik liegt in `lib/`". Alle fünf lassen sich als Struktur-Zusicherung nach dem Muster `app/api/api-guard.test.ts:53` schreiben — zehn bis zwanzig Zeilen pro Stück, und jede einzelne wäre **heute rot**. Das Repo hat dieses Werkzeug und benutzt es an genau einer Stelle. Es fünfmal mehr zu benutzen ist der einzige Vorschlag in diesem Bericht, der die Länge des nächsten verkürzt.

---

**Zur Arbeitsweise dieser Review:** Ausgeführt wurden `npm run types` (fehlerfrei), `npm run lint` (fehlerfrei) und `npm test` **zweimal** am Stand 6162b77. Lauf 1: 4366 Tests in 342 Dateien grün, 195,56 s. Lauf 2: identisch grün, 124,04 s. Lauf 1 lief nebenläufig zu nichts; Typprüfung und Lint waren vorher beendet. Die beiden Zahlen sind gemeinsam die Aussage zum Gate, nicht einzeln.

`npm run test:e2e` wurde **nicht** ausgeführt — aus demselben Grund wie letzte Woche: der erreichbare PostgreSQL (`db:5432`) ist der Server der laufenden dev-Umgebung, und ein autonomer Lauf legt dort keine Wegwerf-Datenbank an, solange er es nicht muss. Die E2E-Aussagen stammen aus dem Quelltext der Flüsse und der Fixture. Docker ist hier nicht installiert; die Aussage zum Abbild stammt aus `deploy/Dockerfile` und dem Workflow.

**Zwei Befunde habe ich empirisch bestätigt:**

| Befund | Messung |
|---|---|
| N2 | Wegwerf-Testdatei unter `lib/db/` (pg-mem über `tests/test-db`): zwei Alternativen um 13:30, Option B gewählt, beide per `updateActivityTimes` nach 16:00 → `WAHL fuer die neue Gruppe: (keine)`, `VERWAISTE Zeile zeigt noch auf: Option B`. Datei danach entfernt. |
| N1 | `node -e` gegen `Intl.DateTimeFormat` mit `Europe/Rome`, `America/New_York`, `Asia/Tokyo` — drei Fälle, in denen `toISOString().slice(0,10)` ein anderes Datum liefert als der Kalender am Reiseziel. Reine Rechnung, kein Zugriff auf die Anwendung. |

Der Stand aller Vorbefunde stammt aus gezielten Greps und dem Lesen der betroffenen Stellen, jeder einzeln am Stand 6162b77 nachgeschlagen — die Messwerte stehen in der Tabelle „Unverändert offen", nicht als Behauptung. Neu betrachtet und bisher in keiner Review geprüft wurden: `lib/expenses/` (Cent-Rechnung, Teilung, Ausgleich), `lib/positions/` und die beiden Positions-Migrationen, `lib/db/` auf Lücken in der Mandantentrennung, `lib/activities/groups.ts` samt `activity_option_selection`, die sechs Heute-Ableitungen, `app/api/ki-planung/route.ts` (Übernahme), `app/api/health` gegen `delivery/health.md`, und `delivery/datenbank.md` gegen `migrations/`.

`git status` ist sauber, es wurde nichts committet und nichts gepusht. Kein Zugriff auf prod, keine Datenbank der laufenden Umgebungen angefasst, kein Netzaufruf nach außen.
