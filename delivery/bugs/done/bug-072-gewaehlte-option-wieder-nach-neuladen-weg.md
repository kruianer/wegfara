---
id: bug-072
app: wegfara
req: req-004
priority: hoch
created: 2026-10-28
---

# Observed

Im Begleiter wird bei einer Options-Gruppe die zweite Alternative
gewählt. Nach dem Neuladen steht wieder die **erste** da.

Dasselbe Verhalten wie bug-071, das heute Morgen behoben wurde — und
derselbe Test an derselben Zeile.

**Der Prod-Deploy ist daran abgebrochen** (Lauf 40774676177, 28.10.
21:52). 79 Tests grün, einer rot: `tests/e2e/begleiter.e2e.ts:19`.
Auf prod ist nichts ausgeliefert worden; dort läuft weiterhin der Stand
von heute Morgen.

Aus dem Protokoll: Playwright wartete 34-mal auf `aria-pressed="true"`
an „Option 2 von 2" und sah durchgehend `"false"`.

# Expected

Die gewählte Alternative übersteht ein Neuladen. Das war die Behebung
von bug-060 und von bug-071.

# Steps

1. Begleiter öffnen, Reise mit einer Options-Gruppe
2. Die zweite Alternative antippen — sie wird sofort als gewählt gezeigt
3. Seite neu laden
4. Es steht wieder die erste Alternative da

# Ursache

**Noch nicht gefunden.** Was gesichert ist:

**Die Behebung von bug-071 ist vollständig vorhanden.** Die Dateien, die
sie anfasste, sind seither unverändert: `lib/db/pool.ts`,
`lib/db/pg-typen.ts`, `lib/db/sql-datetime.ts`, `scripts/e2e.mjs`. Der
Pool setzt die eigenen Typ-Wandler (`types: PG_TYPEN`), und `e2e.mjs`
erzwingt weiterhin `TZ: "Europe/Berlin"`, damit der Fehler überhaupt
auftreten kann.

**Es ist kein Rückfall auf bug-060.** `saveOptionSelection` wird in
`app/go/go-view.tsx` weiterhin ausgewertet, nicht mit `void` verworfen.

**Eingegrenzt auf req-101.** Die Dev-Deploys zeigen es genau:

| Commit | Requirement | Dev-Deploy |
|---|---|---|
| `66c31a2` | req-100 | **grün** |
| `17f7636` | **req-101** | **rot** |
| `18c7b17` | req-102 | rot |
| `23983f9` | req-103 | rot |

Seit req-101 scheitert jeder Lauf an diesem Test.

**Was req-101 geändert hat**, passt aber nicht offensichtlich dazu:
`lib/db/pois.ts` (eine Längenprüfung der Gegend, die bei `null` nicht
greift), `lib/pois/gegenden.ts`, `lib/pois/types.ts`,
`lib/pois/validate.ts`, `app/plan/components/poi-list.tsx`. **Der
Begleiter und der Pfad der Programmpunkte sind unberührt** —
`git diff` über `app/go/`, `lib/activities/`, `lib/db/activities.ts`
zeigt zwischen req-100 und req-101 keine Änderung.

**Ausgeschlossen:** Störung durch den neuen Test `poi-liste.e2e.ts`. Er
läuft als Test 23 bis 25, `begleiter.e2e.ts` als Test 9 — also vorher.
Playwright läuft serieller mit einem Worker (`workers: 1`).

# Erwartete Behebung

1. **Örtlich nachstellen.** Der Test ist vorhanden und schlägt
   zuverlässig fehl. Wichtig: `TZ=Europe/Berlin` setzen, sonst tritt der
   Fehler im UTC-Container nicht auf (siehe `scripts/e2e.mjs`).
2. **Den Unterschied zwischen `66c31a2` und `17f7636` eingrenzen** —
   `git bisect` über die sechs Commits von req-101, oder die Änderungen
   einzeln zurücknehmen.
3. Die Ursache beheben, nicht die Wartezeit verlängern. 34 Versuche über
   15 Sekunden sind kein Zeitproblem.

Ein Verdacht, der zu prüfen ist: `listActivityOptionSelections`
(`lib/db/activity-option-selections.ts:31`) baut den Schlüssel aus
`toIsoDateTimeString(row.start_at)`. Der Typ-Wandler aus bug-071 greift
nur im **Text**-Format (`format !== "binary"`, `lib/db/pg-typen.ts:22`).
Kommt derselbe Wert in einem Fall binär zurück, wandelt der Treiber ihn
doch in ein `Date` — und der Schlüssel verschiebt sich wieder. Ob req-101
daran etwas geändert hat, ist offen.

# Notes

**Dies ist das dritte Mal, dass derselbe Test den Prod-Deploy
blockiert** — bug-060 (17.10.), bug-071 (28.10. früh), nun bug-072. Die
Stelle ist offensichtlich fragil: Die Wahl einer Options-Gruppe hängt an
einem Schlüssel aus Reise, Startzeit und Endzeit, der an mehreren Stellen
unabhängig gebaut wird. Nach der Behebung wäre zu überlegen, ob der
Schlüssel nicht **einmal** entstehen sollte, statt dreimal richtig
gebaut werden zu müssen.

**Gut ist:** Dev fährt inzwischen E2E-Tests. Deshalb war der Fehler schon
um 16:55 sichtbar und nicht erst beim Prod-Deploy um 21:52 — anders als
bei bug-071, wo dev noch ohne E2E lief. Die drei roten Dev-Deploys hätten
auffallen können.

Stand: `main` steht auf `56a8883` (Merge von req-097 bis req-103), prod
läuft auf `569e1c6`. Unit-Tests sind grün (5648 in 404 Dateien, bis auf
drei Zeitüberschreitungen in `poi-form.test.tsx`, die einzeln grün sind),
`tsc` fehlerfrei, Build erfolgreich — der Mangel zeigt sich nur im echten
Browser mit Europe/Berlin.

# Behebung

**Ursache: ein Wettlauf zwischen Speichern und Neuladen — weder req-101
noch die Zeitzone.** Die Eingrenzung auf req-101 war ein Zufall: Die
Dev-Deploys des 28.10. wechselten den ganzen Tag zwischen grün und rot
(rot an `begleiter.e2e.ts:19` auch schon bei `1d9e9f0`, `efc613c` und
`b6493e5`, also vor req-101; grün danach bei `d96c264`). Der Fluss
scheiterte ab und an, nicht seit einem bestimmten Commit. Örtlich war er
auch mit `TZ=Europe/Berlin` und verstellter Server-Uhr grün — dort ist der
Server schnell genug.

Der Test lädt die Seite sofort nach dem Tipp neu. Ist der Schreibvorgang
dann noch unterwegs, bricht der Browser ihn ab (`net::ERR_ABORTED`).
`saveOptionSelection` liefert `false`, und `selectOption` in
`app/go/go-view.tsx` hat daraufhin **das Echo gelöscht** — noch in der
alten Seite, bevor die neue startete. Die neue Seite fand die Wahl weder
beim Server noch im Echo und zeigte die erste Alternative. Das Echo aus
bug-060 wurde also genau in dem Fall verworfen, für den es gebaut wurde.
Nachgewiesen mit einem E2E-Fluss, der den ersten Schreibvorgang bis zum
Neuladen festhält: Vor dem Neuladen lag das Echo im localStorage, beim
Start der neuen Seite war es leer.

Der Verdacht mit dem Binärformat (`pg-typen.ts:22`) war es nicht: Der
fehlgeschlagene Lauf schickte gar keinen Schreibvorgang mehr nach.

- `app/go/go-view.tsx`: Bricht das Verlassen der Seite (`pagehide`) das
  Speichern ab, bleibt das Echo liegen und die Wahl wird nicht
  zurückgenommen; die nächste Seite holt den Schreibvorgang nach.
- `app/go/go-view.tsx`: Das Echo wird erst nach dem Mounten übernommen,
  nicht schon im ersten Rendern. Der Server rendert ohne localStorage;
  mit dem Echo wich der Browser bei der Hydration vom Server-HTML ab.
- `lib/activities/save-option-selection.ts`: Der Schreibvorgang geht mit
  `keepalive`, damit er ein Neuladen überdauern darf.
- Tests: neuer E2E-Fluss „die gewählte Option steht auch, wenn das
  Neuladen dem Speichern zuvorkommt“ (scheiterte vor der Behebung
  zuverlässig), Unit-Tests für Echo beim Abbruch, Hydration ohne
  Abweichung und `keepalive`.

Offen bleibt die Anregung aus den Notes, den Gruppen-Schlüssel nur an
einer Stelle entstehen zu lassen — der Schlüssel war diesmal nicht die
Ursache.
