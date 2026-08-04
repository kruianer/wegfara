---
type: code-review
repo: Wegfara
commit: 4cd8278
date: 2026-08-04
---

# Code-Review: Wegfara (4cd8278)

Automatisch erstellt vom appbaua-Worker am 2026-08-04.

Hier der vollständige Bericht.

---
type: review
repo: Wegfara
commit: 4cd8278
date: 2026-08-04
---

# Code-Review: Wegfara (4cd8278)

Automatisch erstellt vom appbaua-Worker am 2026-08-04.

## Kurz-Zusammenfassung

Der Codestand ist insgesamt sauber: `npx tsc --noEmit` läuft ohne Fehler, alle 411 Tests (54 Dateien) sind grün, keine rohen SQL-/pg-Aufrufe außerhalb von `lib/db/`, keine Cross-Importe zwischen `app/go` und `app/plan`, und alle lesenden DB-Funktionen filtern konsequent nach `account_id`. Der schwerwiegendste Befund ist aber ein systematischer: die in `stack.md` bindend vorgeschriebene 15-Sekunden-Debounce für schreibende Zugriffe existiert im gesamten Repo nicht — kein einziger Treffer für `debounce`/`setTimeout` außerhalb von Tests. Jede POI-Statusänderung, jede Suchgebiets-Änderung und jede Alternativen-Wahl im Begleiter löst sofort einen Schreibvorgang aus, bei der Alternativen-Wahl sogar mehrfach pro Wischgeste. Das widerspricht direkt der in `stack.md` genannten Begründung (Schreiblast im Mobilnetz vermeiden) und ist im aktuellen Ausbaustand am ehesten unterwegs im `/go`-Bereich spürbar. Daneben ein funktionaler Bug in der Kartendarstellung von Transfers bei Optionsgruppen (req-008 wird nicht immer eingehalten), fehlende Mandanten-/Ownership-Prüfung auf mehreren Schreib-Endpunkten (bekanntes Muster aus dem Security-Report vom 2026-07-29, hier um zwei weitere Instanzen ergänzt) sowie ein defektes `npm run lint` durch Design-Mockup-Dateien, die nicht vom App-Code getrennt sind.

## Befunde

### 1. Schreib-Debounce aus stack.md ist im gesamten Code nicht implementiert (hoch)

`stack.md` fordert wörtlich: schreibende Zugriffe werden im Datenzugriffs-Layer gebündelt und mit 15 Sekunden Verzögerung ausgeführt, außer bei Anlegen/Löschen/Abmelden. Ein Repo-weiter Grep nach `debounce`, `setTimeout`, `15000` liefert außerhalb von Tests keinen einzigen Treffer.

Konkret sofort schreibend, obwohl es sich um normale Bearbeitungen (kein Anlegen/Löschen/Abmelden) handelt:

- `lib/db/pois.ts:50-56` (`setPoiStatus`) — aufgerufen aus `app/plan/components/pois-view.tsx` (`handleStatusChange`), jede Statusänderung eines POI löst sofort `fetch` → `POST /api/poi-status` aus.
- `lib/db/search-area.ts:40-66` (`setSearchArea`/`clearSearchArea`) — aufgerufen aus `handleSearchAreaChange` in `pois-view.tsx`, jede Änderung am gezeichneten Suchgebiet schreibt sofort.
- `lib/db/activity-option-selections.ts:37-51` (`setActivityOptionSelection`) — aufgerufen über `POST /api/activity-option-selection`.

Verschärft wird das bei der Alternativen-Wahl im Begleiter: `app/go/components/activity-option-group.tsx:22-30` (`handleScroll`) reagiert auf **jedes native `scroll`-Event** während der Wischgeste (kein `scrollend`, kein Debounce/Throttle) und ruft `onSelect` auf, sobald der berechnete Index vom aktuell gewählten abweicht. Beim Durchwischen von drei Alternativen entstehen so mehrere Zwischen-Aufrufe statt eines einzigen für die tatsächlich eingerastete Karte — genau das Szenario, das die Debounce-Regel laut Begründung ("Tippen und Umschalten sollen keine Schreiblast pro Tastendruck erzeugen") verhindern soll, hier sogar verschärft durch mehrere Schreibvorgänge pro Geste im Mobilnetz.

**Empfehlung:** Debounce zentral im Datenzugriffs-Layer (`lib/db/`) oder in einer gemeinsamen Schreib-Warteschlange bauen, bevor weitere Schreibfunktionen hinzukommen — sonst wird die Nachrüstung mit jeder neuen Funktion teurer. Zusätzlich `handleScroll` auf `scrollend` umstellen oder intern entprellen, unabhängig vom Debounce im Datenzugriffs-Layer.

### 2. Transfer-Linien auf der Karte ignorieren die gewählte Alternative einer Options-Gruppe (mittel-hoch)

`lib/transfers/timeline.ts:9-13` (`entryContains`) prüft bei einer Options-Gruppe, ob **irgendeine** ihrer Alternativen (`group.activities.some(...)`) zum `fromActivityId`/`toActivityId` eines Transfers passt — nicht die tatsächlich gewählte. `lib/map/day-map.ts:47-58` zeichnet den Marker korrekt nur für die gewählte Alternative (`optionSelections`), verwendet für den Linien-Endpunkt in `day-map.ts:69-77` aber `entry.toActivity`, also die im Transfer-Datensatz referenzierte Aktivität — unabhängig davon, ob sie die gewählte Alternative ist.

**Konkretes Szenario:** Eine Gruppe mit drei Restaurant-Alternativen 13:30–15:00; der Nutzer hat auf Alternative 2 gewechselt. Existiert ein `Transfer`-Datensatz mit `toActivityId` = Alternative 3, zeigt die Karte den Marker bei Alternative 2, die Linie führt aber zu Alternative 3 — einem Ort ohne sichtbaren Marker. `req-008-kartenansicht.md:37` fordert ausdrücklich, dass nur die gewählte Alternative auf der Karte erscheint; das ist für Transfer-Endpunkte nicht eingehalten.

Zusätzlich nimmt `lib/transfers/day-totals.ts:12-20` (`dayTransferTotals`) gar keinen `optionSelections`-Parameter entgegen — die angezeigte Tagessumme (Distanz/Fahrzeit) kann also einen Transfer zu einer nie gewählten Alternative einrechnen, ohne dass das UI das erkennen könnte.

`day-map.test.ts` und `day-totals.test.ts` kombinieren nirgends eine Options-Gruppen-Auswahl mit einem Transfer, der auf ein nicht gewähltes Gruppenmitglied verweist — der Fall ist ungetestet.

**Empfehlung:** `entryContains` für Gruppen auf die per `optionSelections` gewählte Alternative einschränken (analog zur Marker-Logik in `day-map.ts`) und `dayTransferTotals` um denselben `optionSelections`-Parameter ergänzen.

### 3. Weitere schreibende Endpunkte ohne Mandanten-/Ownership-Prüfung (mittel)

Der Security-Report vom 2026-07-29 hatte bereits `app/api/activity-option-selection` als ungeprüften Schreib-Endpunkt gemeldet. Dasselbe Muster gilt für zwei weitere, dort nicht erfasste Routen:

- `app/api/poi-status/route.ts` — nimmt `poiId` direkt aus dem Body und ruft `setPoiStatus` auf, ohne zu prüfen, ob der POI zum aktuellen Account gehört.
- `app/api/search-area/route.ts` — analog für `tripId` bei `setSearchArea`/`clearSearchArea`.
- `app/api/poi-search/route.ts` — `createPois` schreibt mit einer client-gelieferten `tripId`, die an der Schreibstelle selbst nicht gegen den Account geprüft wird (funktioniert aktuell nur, weil die vorgelagerte Suchgebiets-Abfrage für fremde `tripId`s ins Leere läuft).

Solange nur ein Account existiert, ist das praktisch folgenlos — `stack.md` sieht aber keine Ausnahme für Schreibzugriffe vor ("jede Abfrage auf Nutzerdaten filtert nach Mandant"), und es existiert noch keine Ownership-Prüfung, auf der ein zweiter Mandant aufsetzen könnte.

**Empfehlung:** Gemeinsam mit dem noch ausstehenden Auth-Requirement (siehe Security-Report) einen einheitlichen Ownership-Check für alle schreibenden Routen einführen, nicht nur für `activity-option-selection`.

### 4. `npm run lint` ist nicht grün — Design-Mockup-Dateien werden als App-Code gelintet (mittel)

`eslint.config.mjs` ignoriert nur `.next/**` und `node_modules/**`. Dadurch lintet `npm run lint` auch `delivery/design/planer/*.js` und `*.jsx` — offensichtlich Referenz-/Mockup-Assets, keine Anwendungslogik — und liefert dort 3 Errors (`react/jsx-no-undef`, `react/no-deprecated`, `@next/next/no-assign-module-variable`) plus 11 Warnings. Der Lint-Befehl, den `stack.md` vor jedem Fertigmelden vorschreibt und der laut devops.md Teil des automatisierten Quality-Gates ist, terminiert damit aktuell mit Exit-Code ≠ 0 aus Gründen, die mit dem eigentlichen App-Code nichts zu tun haben.

**Empfehlung:** `delivery/**` (oder gezielt `delivery/design/**`) in die `ignores` von `eslint.config.mjs` aufnehmen.

### 5. Overpass-Anfrage bricht bei Anführungszeichen im Ortsnamen (niedrig-mittel)

`lib/osm/overpass-client.ts:15-17` (`escapeRegex`) escaped Regex-Metazeichen, aber kein `"`. Der escapte Name wird direkt in einen doppelt gequoteten Overpass-QL-String eingesetzt (`["name"~"^...$",i]`). Enthält ein von der KI vorgeschlagener Ortsname ein `"`, wird die generierte Abfrage fehlerhaft; im günstigsten Fall liefert Overpass einen Fehler und `findPlace` verwirft die Anfrage still (erhöht `discardedCount`), im ungünstigen Fall verändert sich die Abfragesemantik. Kein Test deckt einen Namen mit `"` ab.

**Empfehlung:** `"` in `escapeRegex` mit escapen bzw. den Namen für die Overpass-Query gesondert escapen.

### 6. `extractRequestedCount` interpretiert die erste beliebige Zahl im Freitext als gewünschte Trefferzahl (niedrig)

`lib/pois/ai-search.ts:54-59` sucht mit `/\d+/` die erste Zahl im Freitext-Wunsch und behandelt sie als Obergrenze. Für Wünsche wie "mit 2 Kindern, gerne historische Orte" würde das die Suche unbeabsichtigt auf 2 Treffer begrenzen, ohne dass für den Nutzer ersichtlich wäre, warum so wenige POIs zurückkommen. `ai-search.test.ts:39-51` deckt nur saubere Zahl-Phrasen und reinen Text ohne Zahl ab, keinen Wunsch mit einer kontextfremden führenden Zahl.

**Empfehlung:** Die Zahl nur übernehmen, wenn sie in einem erkennbaren Kontext steht (z. B. "X Treffer", "X POIs", "höchstens X"), sonst auf den Default zurückfallen.

## Was in Ordnung war

- `npx tsc --noEmit` läuft ohne Fehler.
- Vollständige Testsuite grün: 411 Tests in 54 Dateien.
- Keine rohen SQL-/`pg`-Aufrufe außerhalb von `lib/db/` — der Datenzugriffs-Layer ist konsequent gekapselt.
- Keine Cross-Importe zwischen `app/go` und `app/plan` (nur Kommentare verweisen zur Dokumentation aufeinander, keine `import`-Anweisungen).
- Alle lesenden DB-Funktionen filtern konsequent nach `account_id` bzw. darüber verknüpfter `trip_id` — die Mandantentrennung ist beim Lesen sauber durchgehalten.
- Domänenlogik liegt durchgehend in `lib/`, ohne laufendes Next.js testbar; UI-Komponenten binden im Wesentlichen nur an.
- Naming folgt den Konventionen (kebab-case Dateien, PascalCase-Komponenten, camelCase-Funktionen) und den Glossarbegriffen aus `stack.md`.
- KI-Zugriff läuft ausschließlich über `lib/ai/`, kein direkter SDK-Aufruf aus der Anwendungslogik.
