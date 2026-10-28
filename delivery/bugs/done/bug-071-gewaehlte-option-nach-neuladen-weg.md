---
id: bug-071
app: wegfara
req: req-004
priority: hoch
created: 2026-10-28
---

# Observed

Im Begleiter wird bei einer Options-Gruppe die zweite Alternative
gewählt. Nach dem Neuladen der Seite steht wieder die **erste** da.

Aufgefallen beim Prod-Deploy am 28.10.2026 (Lauf 40661379363): Der
E2E-Test „Begleiter: nach dem Neuladen steht die gewählte Option noch"
(`tests/e2e/begleiter.e2e.ts:19`) schlug fehl, 67 andere Tests liefen
durch. **Der Deploy wurde dadurch abgebrochen — auf prod ist nichts
ausgeliefert worden.**

Aus dem Protokoll: Playwright wartete 33-mal auf
`aria-pressed="true"` an „Option 2 von 2" und sah durchgehend `"false"`.
Es ist also kein knappes Verfehlen einer Wartezeit, sondern ein Zustand,
der sich nicht einstellt.

# Expected

Die gewählte Alternative übersteht ein Neuladen — auch ein sofortiges,
bevor der Schreibvorgang beim Server angekommen ist. Genau das war die
Behebung von bug-060.

# Steps

1. Begleiter öffnen, Reise mit einer Options-Gruppe
2. Die zweite Alternative antippen — sie wird sofort als gewählt gezeigt
3. Seite neu laden
4. Es steht wieder die erste Alternative da

# Ursache

Noch nicht abschliessend bestimmt. Was gesichert ist:

**Die Behebung von bug-060 ist im Quelltext vorhanden.** Das damals
ursächliche `void saveOptionSelection(...)` ist weg; das Ergebnis wird
ausgewertet (`app/go/go-view.tsx:249` mit `.then`, Zeile 263 mit
`await`). Es ist also kein Rückfall auf den alten Stand.

**Dev hat es nicht gefunden, weil dev keine E2E-Tests fährt.**
`.github/workflows/deploy-dev.yml` enthält keinen Playwright-Schritt —
„E2E" und „playwright" kommen darin nicht vor. Die drei Dev-Deploys vom
27. und 28.10. sind grün, ohne diesen Test je ausgeführt zu haben. Der
Fehler konnte deshalb unbemerkt nach `main` wandern.

**Verdacht: das Echo aus bug-060 und sein Nachholen stehen sich im Weg.**
`lib/activities/option-selection-echo.ts` legt die Wahl synchron in den
`localStorage`, bevor der Schreibvorgang losgeht. Beim Laden wird das
Echo über den Server-Stand gelegt
(`go-view.tsx:157-160`), und ein Effekt holt einen verlorenen
Schreibvorgang nach (`go-view.tsx:242-253`).

Zwei Stellen sind dabei verdächtig:

1. **`selectOption` verwirft das Echo auch bei Erfolg sofort**
   (`vergissOptionSelectionEcho(key)` in Zeile 269, vor der Prüfung von
   `ok`). Lädt die Seite in dem Moment zwischen Antwort und Neuladen neu
   und war die Antwort ein Erfolg, der aber noch nicht sichtbar ist, gibt
   es kein Echo mehr, das den alten Server-Stand überdeckt.
2. **Der Vergleich beim Laden** (Zeile 244) wirft das Echo weg, sobald
   `initialOptionSelections[key] === activityId`. Kommt der Server-Stand
   aus einem Zwischenspeicher oder aus einem Vorab-Rendern, kann dieser
   Vergleich zu früh zutreffen.

Beides ist zu prüfen, bevor etwas geändert wird. Die Richtung ist nicht
„mehr Echo", sondern: Die Wahl muss **eine** Quelle der Wahrheit haben.

# Erwartete Behebung

1. Den Fehler zuerst örtlich nachstellen — der E2E-Test ist vorhanden und
   schlägt zuverlässig fehl, also gibt es einen klaren Prüfstein.
2. Die Ursache beheben, nicht die Wartezeit im Test verlängern. 33
   Versuche über mehrere Sekunden sind kein Zeitproblem.
3. **Dev muss die E2E-Tests fahren.** Ohne das findet die nächste
   Änderung an dieser Stelle denselben Weg nach `main`. Das ist der
   eigentliche Mangel hinter diesem Bug und gehört in ein eigenes
   Requirement, wenn es den Rahmen hier sprengt.

# Notes

Der Prod-Deploy vom 17.10. scheiterte an **demselben Test an derselben
Zeile** (damals bug-060). Dass es nun ein zweites Mal genau hier
klemmt, ist ein Hinweis: Die Lösung mit dem Echo im `localStorage` hat
die Wahl auf zwei Quellen verteilt — Server und Gerät — und muss sie bei
jedem Laden abgleichen. Solche Abgleiche sind die Stelle, an der es
wieder klemmt.

Es lohnt die Frage, ob der einfachere Weg nicht der bessere ist: die
Wahl **vor** dem Neuladen zu Ende schreiben (der Schreibvorgang ist
schnell und das Antippen eine bewusste Handlung), statt sie auf dem
Gerät zwischenzulagern.

Zum Stand: `main` steht auf `8fa1318` (Merge von req-084 bis req-093),
prod läuft weiterhin auf `f2bd1a9` vom 23.10. Alle Unit-Tests sind grün
(5259 in 383 Dateien), `tsc` fehlerfrei, Build erfolgreich — der Mangel
zeigt sich nur im echten Browser.

# Behebung

**Ursache: die Zeitzone, nicht das Echo.** Der Treiber `pg` las
`timestamp without time zone` (`start_at`/`end_at`) als Date in der
Ortszeit des Prozesses; `toIsoDateTimeString` las davon die UTC-Getter.
Im UTC-Container von dev und prod hebt sich das auf — auf dem Runner am
Beelink (Europe/Berlin, seit dem 25.10. UTC+1) wurde aus 14:00 eine 13:00.
Der Begleiter schickte die Wahl unter diesem verschobenen Schlüssel
zurück, gespeichert wurde sie für 13:00, und beim Neuladen wurde daraus
12:00, während die Gruppe bei 13:00 stand: Die Wahl passte zu keiner
Gruppe mehr. Örtlich in UTC lief der Fluss grün; mit `TZ=Europe/Berlin`
scheiterte er zuverlässig, dazu drei weitere Flüsse mit Uhrzeiten.

- `lib/db/pg-typen.ts`: `timestamp` bleibt die Zeichenkette aus
  PostgreSQL; die Pools der Anwendung und der E2E-Seeds nutzen das.
  Repro-Test `lib/db/pg-typen.test.ts` (unter Europe/Berlin).
- `scripts/e2e.mjs`: Der Anwendungsserver der E2E-Tests läuft fest in
  `Europe/Berlin`, damit so etwas auf jeder Maschine auffällt.
- `.github/workflows/deploy-dev.yml`: dev fährt vor dem Deploy jetzt
  `npm test` und `npm run test:e2e` (Punkt 3), `delivery/devops.md`
  nachgezogen.

Das Echo aus bug-060 blieb unverändert — es war nicht die Ursache.
