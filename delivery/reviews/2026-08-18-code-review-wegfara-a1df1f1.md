---
type: code-review
repo: Wegfara
commit: a1df1f1
date: 2026-08-18
---

# Code-Review: Wegfara (a1df1f1)

Automatisch erstellt vom appbaua-Worker am 2026-08-18.

I have a complete picture. Here is the report.

---
type: code-review
repo: Wegfara
commit: a1df1f1
date: 2026-08-18
---

# Code-Review: Wegfara (a1df1f1)

Automatisch erstellt vom appbaua-Worker am 2026-08-18.

## Kurz-Zusammenfassung

Das automatisierte Quality-Gate ist vollständig grün: `npx tsc --noEmit` fehlerfrei, `npm run lint` fehlerfrei (Befund 4 der Review vom 2026-08-04 ist behoben — `delivery/**` steht jetzt in den `ignores`), und alle 731 Tests in 86 Dateien laufen durch. Die mit req-016 dazugekommene Anmeldung ist handwerklich sauber gebaut: Geheimnisse liegen ausschließlich als Prüfsumme in der DB, Anmeldelinks und Notfallcodes werden serverseitig in der `where`-Bedingung des `UPDATE` entwertet (also auch bei gleichzeitigen Aufrufen genau einmal), die Rückmeldung verrät nicht, ob eine Adresse hinterlegt ist, und `safeRedirectTarget` deckt die üblichen Umleitungs-Tricks ab. `app/api/api-guard.test.ts` und `app/protected-pages.test.ts` sind gute strukturelle Absicherungen.

Der schwerwiegendste Befund ist eine Lücke, die genau zwischen diesen beiden Absicherungen hindurchfällt: `api-guard.test.ts` prüft, dass jede Schnittstelle `currentSession(` aufruft — also **Authentifizierung**. Ob sie danach den Mandanten *verwendet*, prüft nichts. Drei schreibende Endpunkte tun das bis heute nicht und schreiben mit einer client-gelieferten ID ohne jede Eigentumsprüfung. req-017 hat für Reisen mit `belongsToAccount` das richtige Muster eingeführt — die älteren Schreibpfade sind nicht nachgezogen worden, und der grüne Guard-Test verdeckt das.

Daneben zwei Befunde aus der Review vom 2026-08-04, die unverändert offen sind (fehlende Schreib-Debounce, Transfer-Linien bei Optionsgruppen), sowie ein durch req-016 neu entstandener stiller Datenverlust: die Schreibhelfer im Client prüfen den HTTP-Status nicht, und seit es eine Anmeldung gibt, ist `401` ein alltäglicher Ausgang.

## Befunde

### 1. Drei schreibende Endpunkte schreiben ohne Mandanten- oder Eigentumsprüfung (hoch)

`app/api/poi-status/route.ts:22`, `app/api/search-area/route.ts:36,51` und `app/api/activity-option-selection/route.ts:22` prüfen mit `currentSession()` nur, *dass* jemand angemeldet ist. Die anschließend verwendete `poiId` bzw. `tripId` stammt unverändert aus dem Request-Body und wird nirgends gegen `session.participant.accountId` geprüft — auch nicht im Datenzugriffs-Layer: `setPoiStatus` (`lib/db/pois.ts:50-56`), `setSearchArea`/`clearSearchArea` (`lib/db/search-area.ts:40-66`) und `setActivityOptionSelection` (`lib/db/activity-option-selections.ts:37-51`) nehmen gar keinen `accountId`-Parameter entgegen. Ein `grep accountId app/api/` trifft ausschließlich `trips/route.ts` und `poi-search/route.ts`.

**Konkretes Szenario:** Ein angemeldeter Teilnehmer sendet `POST /api/search-area` mit der `tripId` einer fremden Reise. `setSearchArea` löscht das dortige Suchgebiet (`delete from search_area where trip_id = $1`) und legt das mitgeschickte neu an — ohne Fehler, mit `{"status":"ok"}`. Dasselbe gilt für den Status jedes POI und für die gewählte Alternative jeder Options-Gruppe.

Praktisch ist das heute nicht ausnutzbar, weil genau ein Account und ein Teilnehmer existieren. `delivery/security.md` schließt diese Argumentation aber ausdrücklich aus: *"Auch solange nur ein Mandant existiert, ist ein fehlender Mandantenfilter ein Sicherheitsmangel — er fällt erst auf, wenn es zu spät ist."* Mit req-016 ist der Zugriffskreis zudem laut Vorgabe auf *"Familie und Freunde"* erweitert — der zweite Teilnehmer macht daraus einen echten Fund.

Verschärfend: `app/api/api-guard.test.ts:53` prüft ausschließlich `expect(source).toContain("currentSession(")`. Alle drei Routen bestehen diesen Test. Ein Test, der die Mandantenbindung schreibender Routen absichert, existiert nicht — der grüne Guard-Test liest sich wie eine Freigabe, die er nicht ist.

**Empfehlung:** Die drei Schreibfunktionen in `lib/db/` um einen `accountId`-Parameter erweitern und die Zugehörigkeit dort prüfen — `belongsToAccount` aus `lib/db/trips.ts:55-65` ist das bereits vorhandene Muster und ließe sich in ein eigenes Modul ziehen. `poi-search` sollte mitziehen: dort ist die `tripId` heute nur indirekt abgesichert (die Suchgebiets-Abfrage in `route.ts:42-49` ist account-gefiltert und läuft für fremde IDs ins Leere), das ist eine Nebenwirkung und keine Prüfung. Zusätzlich `api-guard.test.ts` um eine zweite Erwartung für schreibende Routen ergänzen, damit die Lücke nicht erneut unbemerkt bleibt.

### 2. Die Schreib-Debounce aus stack.md existiert weiterhin nirgends (hoch, unverändert seit 2026-08-04)

`delivery/stack.md` fordert wörtlich, dass schreibende Zugriffe im Datenzugriffs-Layer gebündelt und mit 15 Sekunden Verzögerung ausgeführt werden. Ein Repo-weiter Grep nach `debounce`, `setTimeout` und `15000` über `app/`, `lib/` und `components/` liefert außerhalb von Tests **genau einen** Treffer: `app/plan/components/trip-form.tsx:66` — und das ist die 350-ms-Entprellung der Nominatim-Ortssuche, also ein *lesender* Zugriff und ausdrücklich nicht der geforderte Mechanismus.

Unverändert sofort schreibend: `handleStatusChange` (`app/plan/components/pois-view.tsx:72-75`), `handleSearchAreaChange` (ebd. 81-88) und `selectOption` (`app/go/go-view.tsx:99-107`). Ebenfalls unverändert reagiert `handleScroll` in `app/go/components/activity-option-group.tsx:22-30` auf **jedes** native `scroll`-Event der Wischgeste statt auf `scrollend` und löst pro Geste mehrere Schreibvorgänge aus — genau der Fall, den die in stack.md genannte Begründung ("unterwegs im Mobilnetz sollen Tippen und Umschalten keine Schreiblast pro Tastendruck erzeugen") verhindern soll.

Der Befund steht damit in der dritten Review in Folge unverändert. Seit dem letzten Bericht sind mit req-017 drei weitere Schreibpfade dazugekommen (`createTrip`, `updateTrip`, `deleteTrip`) — die fallen zwar unter die dokumentierte Ausnahme (Anlegen/Löschen/Bestätigung erwartet, siehe stack.md), zeigen aber, dass der Datenzugriffs-Layer weiter wächst, ohne dass der Sammelpunkt für die Verzögerung entsteht.

**Empfehlung:** Vor dem nächsten schreibenden Requirement eine gemeinsame Schreib-Warteschlange in `lib/db/` bauen, inklusive des in stack.md geforderten Sicherns ausstehender Schreibvorgänge bei `visibilitychange`/`pagehide`. `handleScroll` unabhängig davon auf `scrollend` umstellen. Alternativ: falls die Regel aus stack.md nach drei Reviews nicht mehr gewollt ist, sie dort streichen — der jetzige Zustand, in dem eine bindende Vorgabe dauerhaft unerfüllt bleibt, ist die schlechteste der beiden Möglichkeiten.

### 3. Client-Schreibhelfer ignorieren HTTP-Fehler — nach Sitzungsablauf gehen Änderungen still verloren (hoch)

`lib/pois/save-status.ts:13-21`, `lib/pois/save-search-area.ts:34-42,47-55` und `lib/activities/save-option-selection.ts:69-77` umschließen den `fetch`-Aufruf mit `try/catch`, prüfen aber `response.ok` nicht. Ein `catch` greift nur bei einem Netzwerkfehler; **jede** Antwort des Servers — auch `401` und `500` — durchläuft die Funktion als Erfolg. Die aufrufenden Komponenten verwerfen den Rückgabewert ohnehin (`void savePoiStatus(...)`) und haben die Änderung optimistisch bereits übernommen.

Die Kommentare ("Netzwerkfehler bewusst verschluckt … da die UI ihn bereits optimistisch übernommen hat") stammen aus der Zeit vor der Anmeldung. Mit req-016 ist `401` kein Ausnahmefall mehr: `middleware.ts:47-49` antwortet auf `/api/*` ohne Sitzungs-Cookie mit `401`, und `currentSession()` liefert für eine abgelaufene oder anderswo abgemeldete Sitzung `null`.

**Konkretes Szenario:** Der Planer steht seit dem Vortag offen, die Sitzung ist inzwischen abgelaufen (oder auf einem anderen Gerät wurde abgemeldet). Der Nutzer stuft zwölf POIs auf "Gesetzt" und zeichnet ein neues Suchgebiet. Jeder Aufruf endet mit `401`; die Oberfläche zeigt durchgehend den neuen Zustand. Beim nächsten Neuladen springt die Seite auf die Anmeldung, und nach dem Anmelden ist alles davon weg — ohne dass zu irgendeinem Zeitpunkt ein Hinweis erschienen wäre.

`lib/trips/save-trip.ts:99` macht es richtig (`if (!response.ok) return null;`), und `TripForm` wertet das aus — die drei älteren Helfer sind nur nicht nachgezogen worden.

**Empfehlung:** `response.ok` in allen drei Helfern prüfen und einen Fehlschlag an den Aufrufer melden. Bei `401` gehört der Nutzer auf die Anmeldeseite (`loginUrlFor` liegt bereits in `lib/auth/redirect-target.ts` und merkt das Ziel), bei anderen Fehlern mindestens ein Hinweis plus Rücknahme der optimistischen Änderung. Das ist zudem die Voraussetzung dafür, dass eine spätere Schreib-Warteschlange (Befund 2) fehlgeschlagene Schreibvorgänge überhaupt wiederholen kann.

### 4. Der Anmeldelink wird per GET eingelöst und dabei entwertet (mittel)

`app/anmeldung/link/route.ts:20-58` löst den Link in einem `GET`-Handler ein: `redeemLoginLink` setzt `used_at` und macht den Link damit unwiderruflich wertlos, noch bevor ein Mensch etwas angeklickt hat.

Ein GET auf eine URL aus einer E-Mail wird aber nicht nur von Menschen ausgelöst. Postfach-seitige Link- und Virenprüfungen sowie Vorschau-Funktionen rufen Links beim Zustellen automatisch ab. Passiert das, ist der Link verbraucht, bevor die Mail im Posteingang sichtbar wird — der Nutzer klickt und landet auf `/anmeldung?fehler=link` mit der Meldung "Dieser Anmeldelink ist abgelaufen oder wurde bereits verwendet". Da `requestLoginLink` (`lib/auth/login.ts:94`) jeden neuen Link den vorherigen entwerten lässt, führt auch "einfach nochmal anfordern" zum selben Ergebnis: eine Anmeldeschleife, aus der der Nutzer nicht herauskommt.

Betroffen ist genau der Weg, der laut `delivery/security.md` die Alternative für Geräte ohne Passkey-Unterstützung ist — also der Rückweg für die Person, die schon nicht den bequemen Weg nehmen kann. Ob es im konkreten Postfach auftritt, hängt vom Anbieter ab und lässt sich am Repo nicht entscheiden; der Ausfall ist aber vollständig und für den Nutzer nicht diagnostizierbar. Kein Test deckt einen doppelten Aufruf desselben Links aus Nutzersicht ab (`app/anmeldung/link/route.test.ts` prüft die Entwertung als gewolltes Verhalten).

**Empfehlung:** Der `GET` sollte den Link nicht verbrauchen, sondern eine Zwischenseite mit einer Schaltfläche ausliefern, die per `POST` einlöst — automatische Abrufe folgen keinem `POST`. Der Aufwand ist gering, weil `redeemLoginLink` und die Cookie-Behandlung unverändert bleiben können.

### 5. Transfer-Linien und Tagessummen ignorieren die gewählte Alternative (mittel, unverändert seit 2026-08-04)

Unverändert: `lib/transfers/timeline.ts:9-13` prüft bei einer Options-Gruppe mit `group.activities.some(...)`, ob *irgendeine* Alternative zum `fromActivityId`/`toActivityId` eines Transfers passt — nicht die gewählte. `lib/map/day-map.ts:138-146` setzt den Marker korrekt auf die per `optionSelections` gewählte Alternative, verwendet für den Linien-Endpunkt in Zeile 161 aber `entry.toActivity` aus dem Transfer-Datensatz. Die Linie kann damit zu einem Ort führen, an dem kein Marker steht — `req-008-kartenansicht.md:37` verlangt ausdrücklich, dass nur die gewählte Alternative auf der Karte erscheint.

`dayTransferTotals` (`lib/transfers/day-totals.ts:61-64`) nimmt weiterhin keinen `optionSelections`-Parameter; der Aufruf in `app/plan/components/day-route-map.tsx:198` lautet unverändert `dayTransferTotals(activities, transfers)`. Die angezeigte Tagessumme kann also einen Transfer zu einer nie gewählten Alternative einrechnen. Weder `day-map.test.ts` noch `day-totals.test.ts` kombinieren eine Gruppenauswahl mit einem Transfer auf ein nicht gewähltes Gruppenmitglied.

Durch req-018 hat der Befund an Gewicht gewonnen: An- und Abreise sind jetzt gewöhnliche Transfers (`migrations/0017_seed_an_und_abreise.sql`), Transfers also nicht mehr nur Nebensache innerhalb eines Tages, sondern Klammer der gesamten Reise.

**Empfehlung:** Wie gehabt — `entryContains` für Gruppen auf die gewählte Alternative einschränken (die Logik steht schon in `day-map.ts:138-146` und ließe sich als Hilfsfunktion herausziehen) und `dayTransferTotals` denselben Parameter geben.

### 6. Der Rate-Limiter wächst unbegrenzt und räumt pro Anfrage über alle Schlüssel auf (mittel)

`lib/auth/rate-limit.ts:22-38`: bei jedem Aufruf von `allow` läuft eine Schleife über **alle** bisher gesehenen Schlüssel, um abgelaufene zu entfernen. Der Schlüssel ist die vom Client gelieferte, lediglich normalisierte E-Mail-Adresse, und `createRateLimiter` wird aufgerufen, bevor irgendeine Plausibilitätsprüfung greift — `isPlausibleEmail` steht erst in `requestLoginLink` (`lib/auth/login.ts:87`), also hinter der Bremse.

Jede Anfrage mit einer neuen Zeichenkette legt damit einen Eintrag an, der 15 Minuten lang nicht abgeräumt werden kann. Die Aufräumschleife, die laut Kommentar verhindern soll, dass "die Ablage unbegrenzt wächst", macht das Verhalten dabei schlechter statt besser: sie ist O(n) pro Anfrage über die gesamte Map, das Gesamtverhalten damit quadratisch.

**Konkretes Szenario:** `POST /api/auth/anmeldelink` ist ohne Anmeldung über den Cloudflare Tunnel aus dem Internet erreichbar. Ein Aufrufer sendet fortlaufend Anfragen mit jeweils neuer, syntaktisch beliebiger Adresse. Nach 100.000 Anfragen liegen 100.000 Einträge im Speicher, und *jede weitere* Anfrage — auch die eines echten Nutzers — läuft vor der Antwort über alle davon. Die Bremse selbst wird zum Engpass, während sie nichts bremst, weil jeder Schlüssel nur einmal vorkommt.

Die Tests (`lib/auth/rate-limit.test.ts`) decken das Verhalten bei wenigen Schlüsseln vollständig ab, aber keinen Fall mit vielen verschiedenen Schlüsseln.

**Empfehlung:** `isPlausibleEmail` vor `limiter.allow` ziehen, damit offensichtlicher Unsinn gar nicht erst einen Schlüssel anlegt; die Aufräumschleife durch ein Abräumen nur des betroffenen Schlüssels plus eine Obergrenze für die Map-Größe ersetzen (bei Überschreitung ältesten Eintrag verwerfen oder pauschal ablehnen); zusätzlich nach Aufrufer-IP begrenzen, denn die Adresse allein ist ein vom Angreifer frei wählbarer Schlüssel.

### 7. Mehrschrittige Schreibvorgänge laufen ohne Transaktion (mittel)

`lib/db/queryable.ts` bietet nur `query` — es gibt kein Konstrukt für eine Transaktion, und entsprechend nutzt keine Funktion in `lib/db/` eine. Mehrere Vorgänge bestehen aber aus voneinander abhängigen Schritten:

- `deleteTrip` (`lib/db/trips.ts:143-167`) führt sieben `DELETE` nacheinander aus. Der Kommentar verspricht "keine verwaisten Daten" (req-017, Constraints); bricht der Vorgang nach dem dritten ab, bleiben POIs und Suchgebiet an einer teilweise entkernten Reise hängen — genau der Zustand, den der Constraint ausschließt.
- `setSearchArea` (`lib/db/search-area.ts:40-58`) löscht das alte Gebiet, legt das neue an und fügt die Eckpunkte einzeln ein. Ein Abbruch dazwischen hinterlässt ein `search_area` ohne oder mit unvollständigen Punkten — `listSearchAreas` liefert dann eine Fläche mit zu wenigen Ecken zurück.
- `replaceRecoveryCodes` (`lib/db/recovery-codes.ts:10-26`) löscht **alle** Codes und fügt danach acht einzeln ein. Bricht es nach dem `DELETE` ab, hat der Teilnehmer keine Notfallcodes mehr — bei einem Aufruf über "Neuen Satz erzeugen" mit gleichzeitigem Verlust der alten. Das kollidiert mit der Vorgabe aus `security.md`: *"Niemand darf unterwegs dauerhaft ausgesperrt bleiben."*
- `beginSession` (`lib/auth/login.ts:46-58`) legt die Sitzung an und erzeugt danach die Notfallcodes. Scheitert der zweite Schritt, ist der Nutzer angemeldet, `hasRecoveryCodes` bleibt aber `false` — beim nächsten Anmelden wird erneut ein Satz erzeugt und angezeigt, was in Ordnung ist, den Zwischenzustand aber unbemerkt lässt.

`scripts/migrate.mjs:31-41` zeigt, dass das Muster im Projekt bekannt ist: dort ist jede Migration sauber in `begin`/`commit`/`rollback` gefasst.

**Empfehlung:** `Queryable` um eine `transaction(fn)`-Hilfe erweitern (mit `pg.Pool.connect()` in der echten Umsetzung, im Test-Double als Durchreichung) und die vier genannten Funktionen darauf umstellen. `replaceRecoveryCodes` ist der dringendste Fall, weil dort ein Abbruch eine Aussperrung erzeugt.

### 8. Demo-Daten liegen in denselben Migrationen wie das Schema und landen zwangsläufig auf prod (mittel)

Sechs der siebzehn Migrationen enthalten reine Beispieldaten: `0002_seed_demo_data.sql`, `0004_seed_activities.sql`, `0006_seed_option_group.sql`, `0009_seed_transfers.sql`, `0011_seed_pois.sql` und — neu mit req-018 — `0017_seed_an_und_abreise.sql` mit der Süditalien-Rundreise und der Wien-Städtereise.

`scripts/migrate.mjs` wendet alle noch nicht verzeichneten `.sql`-Dateien an, ohne Unterscheidung nach Umgebung, und läuft laut Kommentar in Zeile 2-3 vor jedem App-Start. `delivery/devops.md` sieht für prod eine eigene Datenbank vor und verlangt, dass Migrationen über die Promotion nach prod gelangen. Damit ist die produktive Datenbank zwangsläufig mit Demo-Reisen vorbefüllt, die dem einzigen echten Teilnehmer gehören und in seinem Planer stehen — löschen kann er sie zwar (req-017), beim nächsten frischen Aufbau sind sie wieder da.

Der Kommentar in `0017` benennt den Zweck selbst als "Zur Erprobung von req-018" — das ist dev-Zweck in einem Artefakt, das devops.md unteilbar nach prod trägt.

**Empfehlung:** Seed-Migrationen von Schema-Migrationen trennen — etwa ein Unterverzeichnis `migrations/seed/`, das `migrate.mjs` nur anwendet, wenn eine Umgebungsvariable (z.B. `SEED_DEMO_DATA=1` in `dev.env`) es verlangt. Die bereits angewendeten Seeds bleiben über `schema_migrations` verzeichnet, der Umbau betrifft also nur künftige Läufe und leere Datenbanken.

### 9. Das Secure-Flag der Cookies hängt allein an einem Header und fällt sonst auf "unsicher" zurück (niedrig-mittel)

`lib/auth/cookies.ts:34-42`: fehlt `x-forwarded-proto`, entscheidet `requestUrl.startsWith("https://")`. Der Kommentar zu bug-008 in `app/anmeldung/link/route.ts:29-34` hält fest, dass `request.url` hinter dem Cloudflare Tunnel die interne Container-Adresse ist (`HOSTNAME=0.0.0.0, PORT=3000`) — der Fallback liefert im Betrieb also garantiert `false`.

Das Secure-Flag sämtlicher Anmelde-Cookies hängt damit vollständig daran, dass `cloudflared` den Header setzt. Verschärfend schreibt `middleware.ts:56-57` das Sitzungs-Cookie bei **jeder** Anfrage neu — ein einziger Durchlauf ohne den Header genügt, um einem bestehenden, korrekt gesetzten Cookie das Secure-Flag zu nehmen. Es gibt keine Zusicherung, die das bemerken würde: `middleware.test.ts:9` setzt den Header in jedem Testfall.

`delivery/security.md` erklärt HTTPS für beide Umgebungen zur Pflicht — die Ableitung müsste also gar nicht aus der Anfrage kommen.

**Empfehlung:** `secure` aus `APP_URL` ableiten statt aus dem Anfrage-Header, analog zu dem, was bug-008 für die Zieladresse bereits getan hat: `appUrl().startsWith("https://")`. Das ist fail-closed, umgebungsrichtig (lokal bleibt `http://localhost:3000`) und macht das Verhalten unabhängig von der Konfiguration des Tunnels.

### 10. Notfallcodes reisen fünf Minuten lang im Klartext bei jeder Anfrage mit (niedrig)

`writeRecoveryCookie` (`lib/auth/cookie-store.ts:71-81`) legt die frisch erzeugten Codes als JSON in ein Cookie mit `path: "/"` und der Laufzeit von `WEBAUTHN_CHALLENGE_DURATION_MS`, also fünf Minuten (`lib/auth/cookies.ts:69-77`). Bis sie abgeholt werden, schickt der Browser die vollständigen Codes im Klartext an **jede** Adresse der Anwendung mit — jeden Seitenaufruf, jeden `/api/*`-Aufruf, jedes Kartenkachel-Nachladen unter derselben Domain.

`httpOnly` und (siehe Befund 9) `Secure` begrenzen den Schaden, und die Begründung im Kommentar ist nachvollziehbar (der Anmeldelink endet mit einer Weiterleitung, die Codes müssen sie überdauern). Trotzdem ist es das breiteste denkbare Transportmittel für das Geheimnis, das die Anmeldung vollständig ersetzt: acht Codes, die jeweils einmal als kompletter Zugang taugen.

Kleiner Nebeneffekt derselben Konstruktion: der `GET` in `app/api/auth/notfallcodes/route.ts:18-31` löscht das Cookie beim Ausliefern, also bevor der Nutzer in `NotfallcodesView` bestätigt hat, sie verwahrt zu haben. Bricht die Anzeige dazwischen ab, sind die Codes endgültig weg, während `hasRecoveryCodes` weiterhin `true` liefert und deshalb nie wieder automatisch welche erzeugt werden. `RECOVERY_CODES_GONE_NOTICE` weist immerhin den Weg zu `/konto`, wo sich ein neuer Satz erzeugen lässt — der Ausweg existiert also, er ist nur nicht offensichtlich.

**Empfehlung:** Die Codes serverseitig kurzlebig an die Sitzungs-ID hängen (Tabelle oder In-Memory-Ablage) statt sie durch den Browser zu schicken; das Cookie trüge dann nur noch eine Referenz. Wenn das zu viel ist, mindestens `path` auf `RECOVERY_CODES_PATH` und den API-Pfad einschränken, damit sie nicht bei jeder Anfrage mitlaufen.

### 11. Overpass-Anfrage bricht bei Anführungszeichen im Ortsnamen (niedrig, unverändert seit 2026-08-04)

`lib/osm/overpass-client.ts:14-16`: `escapeRegex` maskiert Regex-Metazeichen, aber kein `"`. Der Wert wird in `buildQuery` (Zeile 24) direkt in einen doppelt gequoteten Overpass-QL-String eingesetzt. Ein von der KI vorgeschlagener Name mit `"` erzeugt damit eine fehlerhafte Abfrage; im günstigen Fall antwortet Overpass mit einem Fehler und `findPlace` verwirft den Vorschlag still (`discardedCount` steigt), im ungünstigen verschiebt sich die Abfragesemantik. Kein Test deckt einen Namen mit `"` ab.

**Empfehlung:** `"` mit maskieren bzw. den Namen für die Overpass-Abfrage gesondert escapen.

### 12. `extractRequestedCount` nimmt die erste beliebige Zahl im Freitext als Trefferzahl (niedrig, unverändert seit 2026-08-04)

`lib/pois/ai-search.ts:53-59` sucht mit `/\d+/` die erste Zahl im Wunsch-Freitext und behandelt sie als Obergrenze. Ein Wunsch wie "mit 2 Kindern, gerne historische Orte" begrenzt die Suche damit auf zwei Treffer, ohne dass für den Nutzer erkennbar wäre, warum so wenig zurückkommt. `ai-search.test.ts:39-51` deckt saubere Zahl-Phrasen und Text ohne Zahl ab, aber keinen Wunsch mit kontextfremder führender Zahl.

**Empfehlung:** Die Zahl nur übernehmen, wenn sie in erkennbarem Kontext steht ("X Treffer", "höchstens X"), sonst auf den Default zurückfallen.

### 13. Die in stack.md geforderte Backup-Funktion existiert im Code nicht (niedrig, Hinweis)

`delivery/stack.md` legt fest: *"Backup ist Teil der Anwendung, nicht der Infrastruktur: wegfara sichert DB-Inhalt und Bilddateien selbst, in einem gemeinsamen Lauf."* Ein Grep nach `backup`/`sicherung` über `lib/`, `app/` und `scripts/` liefert null Treffer. Gesichert wird ausschließlich in `.github/workflows/deploy-prod.yml:31-40` — vor dem Deploy, durch die Infrastruktur, nach `~/wegfara-backups/` und damit auf dieselbe Maschine, was `security.md` ausdrücklich als "nicht vorhanden" wertet.

Das ist primär Sache des Security-Tasks (req-014) und kein Fehler im vorhandenen Code; es steht hier nur, weil stack.md für den Code bindend ist und die Lücke sich mit jedem Requirement vergrößert, das Daten hinzufügt. Solange es keine Bilddateien gibt (`IMAGE_DIR` wird von keiner Zeile Anwendungscode gelesen), ist der praktische Verlust auf den DB-Inhalt begrenzt.

## Was in Ordnung war

- **Quality-Gate vollständig grün:** `npx tsc --noEmit` fehlerfrei, `npm run lint` fehlerfrei, 731 Tests in 86 Dateien bestanden. Befund 4 der letzten Review (Design-Mockups blockierten den Lint) ist mit `ignores: ["delivery/**"]` in `eslint.config.mjs:11` sauber behoben.
- **Umgang mit Geheimnissen in der Anmeldung:** Sitzungs-Token, Anmeldelink-Token und Notfallcodes liegen ausschließlich als SHA-256-Prüfsumme in der DB; die Klartextwerte existieren nur im Moment ihrer Erzeugung. `createToken` zieht 256 Bit Zufall, das Notfallcode-Alphabet vermeidet verwechselbare Zeichen und ist mit 32 Zeichen exakt 5 Bit breit — beim Ziehen aus Zufallsbytes entsteht damit keine Schieflage.
- **Einmalverwendung ist race-sicher gelöst:** `consumeLoginLink` und `consumeRecoveryCode` entwerten in der `where`-Bedingung des `UPDATE` mit `returning`, nicht in zwei Schritten — zwei gleichzeitige Aufrufe können denselben Link bzw. Code nicht beide einlösen.
- **Keine Auskunft über hinterlegte Adressen:** `requestLoginLink` liefert bei bekannter und unbekannter Adresse dasselbe zurück, `/api/auth/anmeldelink` antwortet auch bei greifender Bremse mit derselben Meldung, und der Grund eines fehlgeschlagenen Mailversands geht ins Log statt in die Antwort.
- **`safeRedirectTarget`** (`lib/auth/redirect-target.ts:12-27`) deckt die üblichen Umleitungs-Tricks ab: `//host`, `/\host`, Steuerzeichen für Header-Injection und die Rückumleitung auf die Anmeldeseite selbst.
- **Strukturelle Absicherungen als Test:** `app/api/api-guard.test.ts` und `app/protected-pages.test.ts` prüfen an der Quelle, dass keine neue Schnittstelle bzw. Seite die Sitzungsprüfung vergisst, und dass `/plan` und `/go` den Mandanten aus dem angemeldeten Konto statt aus `ACCOUNT_ID` lesen. Diese Bauart fängt genau die Fehler, die beim Hinzufügen einer Route entstehen (zur Grenze siehe Befund 1).
- **Alle lesenden Zugriffe filtern nach Mandant:** `listActivities`, `listPois`, `listSearchAreas`, `listTransfers`, `listActivityOptionSelections` und `listTrips` sind durchgehend über `t.account_id = $1` bzw. direkt gefiltert — beim Lesen ist die Mandantentrennung lückenlos.
- **req-017 hat das richtige Muster eingeführt:** `belongsToAccount` in `lib/db/trips.ts:55-65`, konsequent in `updateTrip` und `deleteTrip` verwendet, mit `404` statt `403` in der Route ("Eine Reise eines anderen Accounts existiert für diese Sitzung nicht") — sauber gedacht bis in die Statuscodes.
- **`deleteTrip` räumt vollständig auf:** die Löschreihenfolge deckt alle fünf Tabellen mit `references trip (id)` plus `search_area_point` ab und folgt korrekt den Fremdschlüsseln (Programmpunkte vor POIs wegen `activity.poi_id`).
- **Architekturvorgaben eingehalten:** kein SQL und kein `pg`-Aufruf außerhalb von `lib/db/`, keine Importe zwischen `app/plan/` und `app/go/`, KI-Zugriff ausschließlich über `lib/ai/` mit dem Modellnamen an genau einer Stelle und per `OPENAI_MODEL` übersteuerbar, Mailversand analog hinter `lib/mail/mailer.ts` gekapselt. Domänenlogik liegt durchgehend in `lib/` und ist ohne laufendes Next.js testbar.
- **SMTP-Transport ist korrekt abgesichert:** `secure` bei Port 465, `requireTLS` sonst — unverschlüsselt wird nie versandt.
- **Keine Secrets im Repo:** ein gezielter Scan über `app/`, `lib/`, `components/`, `scripts/`, `deploy/`, `migrations/` und `.github/` findet keine eingebetteten Zugangsdaten; alle Werte kommen aus Umgebungsvariablen.
- **Der prod-Workflow hält devops.md ein:** ausschließlich `workflow_dispatch` mit Tipp-Bestätigung, kein Push- oder Merge-Trigger, Backup vor dem Deploy mit `set -e`.
- **Der `postbuild`-Check aus bug-006** (`scripts/verify-standalone-bundle.mjs`) ist eine gute Antwort auf einen Fehler, den die Testsuite prinzipiell nicht finden kann — er prüft im Bundle nach, was der Mock im Test ersetzt.
- **Kommentare erklären durchgehend das Warum, nicht das Was** und verweisen auf das auslösende Requirement bzw. den Bug. `lib/db/sql-datetime.ts` und die Constraint-Umbenennung in `migrations/0016` sind Beispiele für Wissen, das ohne den Kommentar bei der nächsten Änderung verloren ginge.

## Empfohlene Reihenfolge

1. **Befund 1** (Mandantenprüfung auf den drei Schreib-Endpunkten) — kleiner Eingriff, das Muster liegt fertig in `trips.ts`, und es ist der einzige Befund, den `security.md` ausdrücklich als Mangel benennt.
2. **Befund 3** (`response.ok` prüfen) — wenige Zeilen, verhindert stillen Datenverlust, und Voraussetzung für Befund 2.
3. **Befund 4** (Anmeldelink per POST einlösen) — betrifft den Rückweg für Geräte ohne Passkey.
4. **Befund 7** (Transaktionen), zuerst `replaceRecoveryCodes`.
5. **Befund 2** (Schreib-Debounce) — oder die bewusste Entscheidung, die Vorgabe aus `stack.md` zu streichen.
