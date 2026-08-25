---
type: code-review
repo: Wegfara
commit: 782c4a4
date: 2026-08-25
---

# Code-Review: Wegfara (782c4a4)

Automatisch erstellt vom appbaua-Worker am 2026-08-25.

Das Quality-Gate ist durchgelaufen (tsc 0 Fehler, ESLint 0 Fehler, 747 Tests in 87 Dateien grün), ich habe den Stand seit der letzten Review geprüft und die alten Befunde einzeln nachverifiziert. Hier ist der Bericht.

---
type: code-review
repo: Wegfara
commit: 782c4a4
date: 2026-08-25
---

# Code-Review: Wegfara (782c4a4)

Automatisch erstellt vom appbaua-Worker am 2026-08-25. Vorgänger:
[2026-08-18 (a1df1f1)](2026-08-18-code-review-wegfara-a1df1f1.md).

## Kurz-Zusammenfassung

Das automatisierte Quality-Gate ist vollständig grün: `npx tsc --noEmit` fehlerfrei, `npm run lint` fehlerfrei, 747 Tests in 87 Dateien bestanden (+16 Tests, +1 Datei gegenüber der letzten Review).

Seit a1df1f1 sind ausschließlich Fehlerbehebungen dazugekommen — bug-011 (Versatz beim Zeichnen, Einklappen der Liste) und bug-013 (Linie und Fläche werden nicht gezeichnet) — plus `delivery/datenbank.md`. Die Analyse von bug-013 ist die beste Arbeit in diesem Repo bisher: der Fehler (maplibre-gl errechnet seine Worker-Adresse aus `import.meta.url`, was im Bundle von Next ins Leere zeigt; GeoJSON-Quellen werden dadurch lautlos nie verarbeitet) ist bis zur Ursache durchdrungen, und die Absicherung ist auf drei Ebenen gebaut, die einander nicht ersetzen: der Nachbau in `tests/mocks/maplibre-gl.ts` unterscheidet jetzt "Daten gesetzt" von "Daten verarbeitet" und kann den Fehler überhaupt erst zeigen, `worker-assets.test.ts` prüft die Dateien auf der Platte, und `verify-standalone-bundle.mjs` prüft nach dem Build, was im Container landet. Genau die drei Stellen, an denen ein Test allein nichts gemerkt hätte.

Der schwerwiegendste neue Befund ist eine Nebenwirkung von bug-011: um den Klickversatz zu beheben, wurde `position: relative` vom Marker entfernt — und damit auch das Pseudo-Element, das die Trefferfläche der Eckpunkt-Griffe auf die 44 Pixel gebracht hatte, die **bug-009 ausdrücklich als Fix eingeführt hatte**. Die Griffe sind jetzt 22 Pixel groß (der Schließ-Punkt 30, die Kanten-Griffe 9). bug-009 war der Bug "Polygon schließen am iPad" — sein Fix ist damit auf demselben Gerät wieder zurückgenommen, ohne dass ein Test das bemerkt.

Daneben ein neuer, empirisch bestätigter Befund zum Kartenausschnitt, eine Lücke in der Nachvollziehbarkeit (drei Bug-Dokumente fehlen im Repo, obwohl zwölf Code-Kommentare auf sie verweisen) — und **alle dreizehn Befunde der Review vom 2026-08-18 sind unverändert offen**, einschließlich der fehlenden Mandantenprüfung auf drei Schreib-Endpunkten. Ich habe jeden einzeln nachgeprüft; die Nachweise stehen unten.

## Neue Befunde

### N1. Der Fix von bug-011 nimmt den Fix von bug-009 zurück: Trefferflächen von 44 auf 22 Pixel geschrumpft (hoch)

`app/plan/components/poi-map.module.css:158-160` setzt `.vertexHandle` auf 22 × 22 Pixel, `:180-182` `.vertexHandleFirst` auf 30 × 30. Der Kommentar daneben hält den Tausch offen fest:

> *"Die Trefferflaeche kommt jetzt aus der sichtbaren Groesse (22px, erster Punkt 30px) statt aus einem Pseudo-Element — das brauchte `position: relative` am Marker und verschob ihn (bug-011)."*

Das Pseudo-Element, das ersetzt wurde, stammt aus dem Fix von bug-009. Dessen Dokument (`delivery/bugs/done/bug-009-polygon-schliessen-am-ipad.md:30-31,42-43`) benennt es als eine von zwei Ursachen und als Teil der Lösung:

> *"**2. Die Trefferfläche war 14 Pixel groß.** Die Design-Vorlage nennt mindestens 44 Pixel als Mindestmaß für Berührungen."*
> *"Die sichtbare Größe bleibt klein, die Trefferfläche wächst per Pseudo-Element auf 44 × 44 Pixel."*

22 Pixel sind die Hälfte dieses Mindestmaßes. Für den Schließ-Punkt — den einzigen Weg, eine Fläche zu Ende zu zeichnen — sind es 30. Noch deutlicher betroffen ist `.midpointHandle` (`:190-192`): 9 × 9 Pixel für die Schaltfläche "Eckpunkt einfügen", ohne jede Vergrößerung, also ein Fünftel des Mindestmaßes. Der wurde von bug-011 nicht verkleinert, sondern war nie vergrößert worden — er fällt hier nur auf, weil derselbe Maßstab gilt.

**Konkretes Szenario:** Der Nutzer zeichnet auf dem iPad ein Suchgebiet — genau der Ablauf aus bug-009. Er setzt vier Punkte und tippt den grünen Schließ-Punkt an. Trifft er ihn um mehr als 15 Pixel daneben, greift nicht der `pointerup`-Handler des Markers, sondern der `touchend`-Handler der Karte (`poi-map.tsx:497-504`): die Bewegung liegt unter `TOUCH_TAP_TOLERANCE_PX`, also gilt es als Tipp und **setzt einen fünften Punkt**, statt die Fläche zu schließen. Das ist wörtlich der in bug-009 beschriebene Fehlausgang. Bei einem Fingerkuppen-Durchmesser von rund 45 Pixeln ist das kein Ausnahmefall.

Kein Test deckt das ab. `poi-map.layout.test.ts` prüft am CSS nur `touch-action: none` für die Kartenfläche (bug-005). Eine Zusicherung für das 44-Pixel-Maß existierte nie — der Fix von bug-009 war ausschließlich durch den Kommentar im CSS geschützt, und der wurde mit der Regel zusammen entfernt.

Anmerkung zur Begründung: dass `position: relative` am Marker den Versatz verursacht hat, ist plausibel und offenbar am Gerät verifiziert; darum geht es hier nicht. Der Punkt ist, dass die Trefferfläche *mit* dem `position: relative` verschwunden ist, obwohl sie nicht dessen Ursache war — sie hing nur daran.

**Empfehlung:** Die Trefferfläche zurückholen, ohne den Marker zu positionieren. Zwei Wege ohne `position: relative` am Marker-Element selbst:

- Den sichtbaren Punkt als Kind-Element (`<span>`) in den Marker-Knopf legen — so wie es `renderPois` (`poi-map.tsx:244-254`) für die POI-Marker bereits macht (`markerDrop`/`markerNumber`). Der Knopf ist dann 44 × 44 Pixel und transparent, der Punkt darin 22. Das ist im Repo vorhandenes Muster und ändert an der Positionierung durch die Kartenbibliothek nichts.
- Oder `.vertexHandle` auf 44 Pixel vergrößern und den sichtbaren Kreis über `background: radial-gradient(...)` bzw. `border` erzeugen, ohne zusätzlichen Knoten.

`.midpointHandle` sollte mitziehen. Und die Zusicherung gehört in `poi-map.layout.test.ts`, wo sie hätte greifen müssen: eine Prüfung, dass die Griff-Regeln mindestens 44 Pixel Trefferfläche ergeben. Sonst geht der Fix beim nächsten CSS-Umbau erneut verloren — dann zum dritten Mal.

### N2. Jede Zustandsänderung im Planer setzt den Kartenausschnitt zurück (mittel)

`app/plan/components/pois-view.tsx:66-70` berechnet `mapPois` bei **jedem** Rendern neu:

```js
const mapPois = tripPois.filter(
  (poi) => (typeFilter === "alle" || poi.type === typeFilter) &&
           visibleMapStatuses.includes(poi.status),
);
```

`tripPois` ist per `useMemo` stabil, das anschließende `.filter(...)` erzeugt aber jedes Mal ein neues Array. Dieses Array geht als `pois` an `PoiMap`, wo es in der Abhängigkeitsliste eines Effekts steht (`poi-map.tsx:462-464`, `[map, styleReady, sized, pois, mainPlace]`). Der Effekt ruft `renderPois`, das alle Marker abräumt, neu aufbaut und am Ende `map.fitBounds(bounds, { padding: 48, maxZoom: 16, duration: 0 })` aufruft (`:268-270`) — ein sofortiger Sprung ohne Übergang.

`PoisView` rendert bei jeder Änderung von `statusOverrides`, `currentSearchArea`, `addedPois`, `typeFilter` oder `highlightedPoiId` neu. `highlightedPoiId` wird vom Marker-Klick gesetzt (`pois-view.tsx:111`, `onSelectPoi={setHighlightedPoiId}`).

**Ich habe das mit einem Wegwerf-Test gegen `PoisView` bestätigt** (danach wieder entfernt, das Repo ist unverändert):

```
Marker-Klick        — fitBounds vorher: 1  nachher: 2
Suchgebiet schliessen — fitBounds vorher: 2  nachher: 3
```

**Konkretes Szenario:** Der Nutzer zoomt auf die Altstadt von Neapel, um dort ein Suchgebiet zu zeichnen. Er tippt einen POI-Marker an, um zu sehen, welcher es ist — die Karte springt sofort auf den Ausschnitt zurück, der alle POIs der Reise umfasst, also zurück auf Süditalien. Er zoomt wieder heran, zeichnet die Fläche und schließt sie — im Moment des Schließens springt die Karte erneut heraus, und das gerade gezeichnete Gebiet ist ein kleines Viereck irgendwo im Bild.

Der Befund gewinnt durch bug-011 an Gewicht: das Einklappen der Liste wurde eingeführt, damit die Karte zum Zeichnen die ganze Breite bekommt. Der Zeichenvorgang ist damit der Hauptanwendungsfall der Karte — und genau er endet mit einem Sprung.

Nebeneffekt derselben Ursache: sämtliche POI-Marker werden bei jedem Rendern zerstört und neu erzeugt, einschließlich des gerade angeklickten. Das ist verschwendete Arbeit und dieselbe Konstellation, die in bug-013 zum Abbruch der Ziehgeste geführt hat ("die Kartenbibliothek meldet beim Entfernen eines Markers alle Zuhoerer der laufenden Geste ab"). Bei den POI-Markern gibt es heute keine Geste — bei der nächsten (verschiebbare POIs?) gäbe es sie.

**Empfehlung:** Zwei kleine, unabhängige Eingriffe:

1. `mapPois` in `pois-view.tsx` in ein `useMemo` mit `[tripPois, typeFilter, visibleMapStatuses]` fassen. Damit entfällt der Effektlauf bei `highlightedPoiId` und `currentSearchArea` vollständig.
2. `fitBounds` in `renderPois` vom Marker-Aufbau trennen: die Marker sollen bei geänderten POIs neu gezeichnet werden, der Ausschnitt aber nur beim ersten Aufbau und beim Reisewechsel. Ein `useRef` mit der zuletzt eingepassten `tripId` bzw. ein zweiter Effekt mit `[map, styleReady, sized, mainPlace]` genügt.

Beides ist mit dem vorhandenen Test-Double prüfbar: `MapLibreMap.fitBoundsCalls` zählt die Aufrufe bereits mit — die Zusicherung fehlt nur.

### N3. Zwölf Code-Kommentare verweisen auf drei Bug-Dokumente, die es im Repo nicht gibt (mittel)

`delivery/bugs/done/` enthält bug-001 bis bug-009 sowie bug-013. bug-010, bug-011 und bug-012 fehlen — nicht nur in `done/`, sondern in `ready/` und `in-progress/` ebenso (beide enthalten nur `.gitkeep`), und sie sind nie im Repo gewesen (`git log --diff-filter=A -- 'delivery/bugs/**'` findet keinen Anlegevorgang).

Behoben wurden sie trotzdem: d9c1dca (bug-010, nodemailer fehlte im Container), fbd88a4 und 8c9df39 (bug-011, Versatz beim Zeichnen). bug-012 hat nicht einmal einen eigenen Commit — der Fix steckt in `middleware.ts:66-81`.

Der Code verweist an zwölf Stellen auf diese drei Dokumente als Begründung:

| Verweis | Stellen |
|---|---|
| bug-010 | `next.config.ts:15`, `scripts/verify-standalone-bundle.mjs:17` |
| bug-011 | `poi-map.tsx` (3×), `poi-map.module.css` (2×), `split-view.tsx`, `split-view.module.css`, `poi-map.test.tsx`, `plan-view.test.tsx`, `tests/setup.ts` |
| bug-012 | `middleware.ts:69`, `middleware.test.ts` |

Diese Kommentare sind durchweg gut gemacht — sie erklären das Warum und verweisen für die Einzelheiten weiter. Nur läuft der Verweis ins Leere. Wer bei `poi-map.module.css:163` liest *"das brauchte position: relative am Marker und verschob ihn (bug-011)"* und wissen will, wie groß der Versatz war und auf welchem Gerät, findet nichts. Genau das ist der Grund, warum N1 überhaupt unbemerkt bleiben konnte: bug-009 ist dokumentiert und nennt das 44-Pixel-Maß; bug-011 ist es nicht, und so stand beim Umbau nur eine Seite der Abwägung zur Verfügung.

`middleware.ts:66-81` ist der härteste Fall: der Kommentar beschreibt einen Fehler, bei dem nach einem Deploy ein Jahr lang die alte Seite ausgeliefert wurde — ein Betriebsvorfall, dessen einzige Aufzeichnung im Repo dieser Kommentar ist.

**Empfehlung:** Die drei Dokumente nachziehen und in `delivery/bugs/done/` ablegen; Symptom, Ursache und Fix stehen in den Commit-Nachrichten und Kommentaren bereits vollständig, es ist reine Übertragungsarbeit. Für die Zukunft ist die Regel, die bug-001 bis bug-009 und bug-013 befolgt haben, offensichtlich die richtige: kein Fix ohne Dokument. Ein `capture-bug`-Lauf hätte sie erzeugt — die drei sind vermutlich an dem Skill vorbei direkt gefixt worden.

### N4. Das Einklappen der Liste wirft den Zustand der KI-Suche weg (niedrig-mittel)

`split-view.tsx:56-64` hängt die linke Spalte bei `collapsed` per `&&` aus dem Baum aus, statt sie per CSS zu verbergen. Damit unmountet der gesamte Teilbaum, einschließlich `AiPoiSearch` (`ai-poi-search.tsx:26-27`) mit seinen beiden Zuständen `wish` und `state`.

**Konkretes Szenario:** Der Nutzer tippt "ruhige Strände, gut mit Kindern" in das Wunschfeld, merkt, dass sein Suchgebiet zu klein ist, klappt die Liste weg, um die Fläche auf der ganzen Breite nachzuzeichnen (genau der Ablauf, für den bug-011 die Schaltfläche eingeführt hat), und klappt sie wieder ein. Das Wunschfeld ist leer. Genauso verschwindet die Ergebnismeldung "12 neue POIs angelegt, 4 Vorschläge verworfen" (`:75-79`), sobald man zwischendurch einmal auf die Karte umschaltet.

Ein laufender Suchlauf geht dabei nicht verloren: `onPoisAdded` zeigt auf `handlePoisAdded` in `PoisView` (`pois-view.tsx:77-79`), und die bleibt gemountet — die angelegten POIs erscheinen also. Nur `setState({ kind: "done", ... })` läuft auf eine abgeräumte Komponente und verpufft: die Suche meldet nach dem Wiedereinblenden nicht mehr, dass und mit welchem Ergebnis sie gelaufen ist. `typeFilter` und `highlightedPoiId` überleben, weil sie in `PoisView` liegen — das Muster ist also im Repo schon bewusst angewandt worden (siehe der Kommentar zu `visibleMapStatuses`, `pois-view.tsx:27-29`: *"Lebt in PlanView, da PoisView beim Bereichswechsel unmountet und die Auswahl die Sitzung ueberdauern muss"*).

Kein Test deckt das ab: `plan-view.test.tsx` prüft nur, dass die Spalte verschwindet und wiederkommt, nicht was sie dabei mitnimmt.

**Empfehlung:** Die einfachste Lösung ist, die Spalte nicht auszuhängen, sondern per CSS zu verbergen (`display: none` auf `.pane`), und die Breite auf 0 zu setzen. Der `ResizeObserver` in `PoiMap` (`poi-map.tsx:443`) reagiert darauf genauso. Alternativ `wish` und das Suchergebnis nach `PoisView` hochziehen — dem Kommentar zu `visibleMapStatuses` folgend, der dieselbe Frage schon einmal entschieden hat.

### N5. Kein `.dockerignore`: der Build-Kontext überschreibt die frisch installierten Abhängigkeiten (niedrig)

`deploy/Dockerfile:11-12` kopiert erst die in der `deps`-Stufe per `npm ci` installierten Module und danach den gesamten Kontext darüber:

```dockerfile
COPY --from=deps /app/node_modules ./node_modules
COPY . .
```

Ein `.dockerignore` existiert nicht (`ls .dockerignore` → nicht vorhanden). Enthält der Build-Kontext ein `node_modules` oder ein `.next`, überschreibt `COPY . .` also genau das, was die `deps`-Stufe erzeugt hat.

Über den Deploy-Weg geht das heute gut: `actions/checkout` räumt den Arbeitsbereich des self-hosted Runners mit `git clean -ffdx` auf, ignorierte Verzeichnisse eingeschlossen. `delivery/devops.md` dokumentiert die Compose-Aufrufe aber ausdrücklich als von Hand ausführbar. Ruft der Nutzer `docker compose -p wegfara-dev ... up -d --build` in seiner eigenen Arbeitskopie auf, wandern deren `node_modules` in das Image — und `delivery/stack.md` hält fest, dass das Repo unter OneDrive liegt, die Module also von einem anderen Betriebssystem stammen. Native Bestandteile (`pg`) passen dann nicht zu `node:22-alpine`, und der Fehler zeigt sich erst zur Laufzeit im Container.

Unabhängig davon wird bei jedem Build der komplette Kontext an den Daemon übertragen, einschließlich `.git`, `.next` und `delivery/` mit den Design-PNGs.

**Empfehlung:** Ein `.dockerignore` im Repo-Wurzelverzeichnis mit mindestens `node_modules`, `.next`, `.git`, `delivery`, `tsconfig.tsbuildinfo`, `coverage`. Das ist eine Datei und macht die Reihenfolge im Dockerfile robust, statt sich auf das Aufräumverhalten von `actions/checkout` zu verlassen.

### N6. Kleinigkeiten (niedrig)

- **`delivery/datenbank.md:16`** sagt *"14 Tabellen in vier Gruppen"*, die Gruppentabelle darunter (`:20-23`) listet aber 13 (2 + 4 + 5 + 2), und `schema_migrations` wird in `:25-26` gesondert als "dazu" genannt. Die Migrationen enthalten 13 `create table` plus `schema_migrations` — die Zahl 14 stimmt also nur, wenn man die Migrationstabelle mitzählt, die laut Text nicht zu den Gruppen gehört. Inhaltlich habe ich die Datei gegen `migrations/` stichprobenartig geprüft (Tabellenliste, `poi` samt `number` aus 0014, Kaskade an `search_area_point`) — sie stimmt. Es ist nur die Einleitungszahl.
- **`tests/mocks/maplibre-gl.ts:46-53`**: `getWorkerUrl` und `resetWorkerUrl` werden von keinem Test aufgerufen. `resetWorkerUrl` ist dabei nicht nur ungenutzt, sondern eine Falle: es setzt den Zustand des Nachbaus zurück, aber nicht das Modul-weite `pinned` in `lib/map/worker-url.ts:4`. Wer es benutzt, bekommt eine Karte, die nie wieder eine Worker-Adresse meldet — der Nachbau verhält sich dann dauerhaft wie im Fehlerzustand von bug-013, ohne dass die Ursache im Test sichtbar wäre. Entweder entfernen oder `worker-url.ts` eine passende Rücksetz-Möglichkeit geben.

## Unverändert offen aus der Review vom 2026-08-18

Alle dreizehn Befunde stehen unverändert. Ich habe jeden am aktuellen Stand nachgeprüft; die Belege stehen jeweils dabei. Die ausführliche Begründung, die konkreten Szenarien und die Empfehlungen stehen im [Vorgängerbericht](2026-08-18-code-review-wegfara-a1df1f1.md) und werden hier nicht wiederholt.

| # | Befund | Nachweis am Stand 782c4a4 |
|---|---|---|
| 1 | **Drei Schreib-Endpunkte ohne Mandanten- oder Eigentumsprüfung** (hoch) | `grep accountId app/api/` trifft weiterhin nur `trips/route.ts` und `poi-search/route.ts`. `poi-status/route.ts:22`, `search-area/route.ts:34,51` und `activity-option-selection/route.ts:22` geben die client-gelieferte `poiId`/`tripId` ungeprüft weiter; `belongsToAccount` existiert unverändert nur in `lib/db/trips.ts:55`. |
| 2 | **Schreib-Debounce aus stack.md existiert nirgends** (hoch) | Grep nach `debounce`, `15000`, `15_000` über `app/`, `lib/`, `components/` ohne Testdateien: **null Treffer**. Der 350-ms-Treffer in `trip-form.tsx` ist inzwischen ebenfalls nicht mehr als `debounce` benannt. Vierte Review in Folge. |
| 3 | **Client-Schreibhelfer ignorieren HTTP-Fehler** (hoch) | `lib/pois/save-status.ts:13-21`, `lib/pois/save-search-area.ts` (beide Helfer) und `lib/activities/save-option-selection.ts` prüfen `response.ok` unverändert nicht. Die Kommentare ("Netzwerkfehler bewusst verschluckt") stehen wörtlich noch da. |
| 4 | **Anmeldelink wird per GET eingelöst und entwertet** (mittel) | `app/anmeldung/link/route.ts:20` ist unverändert ein `GET`-Handler mit `redeemLoginLink` darin. |
| 5 | **Transfer-Linien und Tagessummen ignorieren die gewählte Alternative** (mittel) | `lib/transfers/timeline.ts:9-13` prüft unverändert `group.activities.some(...)`; `dayTransferTotals` nimmt weiterhin keinen `optionSelections`-Parameter. |
| 6 | **Rate-Limiter wächst unbegrenzt, räumt pro Anfrage über alle Schlüssel auf** (mittel) | `lib/auth/rate-limit.ts:26-30` enthält die O(n)-Schleife unverändert. `app/api/auth/anmeldelink/route.ts:32` ruft `limiter.allow(normalizeEmail(email), now)` weiterhin *vor* `requestLoginLink`, in dem `isPlausibleEmail` erst greift (`lib/auth/login.ts:87`). |
| 7 | **Mehrschrittige Schreibvorgänge ohne Transaktion** (mittel) | Grep nach `transaction`/`begin` über `lib/db/*.ts`: kein Treffer außerhalb eines Testnamens. `setSearchArea` (`lib/db/search-area.ts:40-58`) ist unverändert `delete` + `insert` + N Einzel-Inserts. `replaceRecoveryCodes` bleibt der dringendste Fall. |
| 8 | **Demo-Daten in denselben Migrationen wie das Schema** (mittel) | Unverändert sechs Seed-Migrationen (`0002`, `0004`, `0006`, `0009`, `0011`, `0017`), die `scripts/migrate.mjs` ohne Umgebungsunterscheidung anwendet. |
| 9 | **Secure-Flag hängt allein am `x-forwarded-proto`-Kopf** (niedrig-mittel) | `lib/auth/cookies.ts:34-42` unverändert; der Rückfall auf `requestUrl.startsWith("https://")` liefert hinter dem Tunnel garantiert `false`. `middleware.ts:61` schreibt das Cookie weiterhin bei jeder Anfrage neu. |
| 10 | **Notfallcodes reisen fünf Minuten im Klartext bei jeder Anfrage mit** (niedrig) | `lib/auth/cookies.ts:69-77`: `path: "/"`, Laufzeit `WEBAUTHN_CHALLENGE_DURATION_MS`. `writeRecoveryCookie` legt sie unverändert als JSON ab. |
| 11 | **Overpass-Anfrage bricht bei `"` im Ortsnamen** (niedrig) | `lib/osm/overpass-client.ts:15-16`: `escapeRegex` maskiert `"` unverändert nicht. |
| 12 | **`extractRequestedCount` nimmt die erste beliebige Zahl** (niedrig) | `lib/pois/ai-search.ts:54-59`: `wish.match(/\d+/)` unverändert. |
| 13 | **Backup-Funktion aus stack.md existiert im Code nicht** (niedrig, Hinweis) | Grep nach `backup`/`sicherung` über `lib/`, `app/`, `scripts/`: null Treffer. Gesichert wird weiterhin nur in `deploy-prod.yml` nach `~/wegfara-backups/`, also auf dieselbe Maschine. |

Zu Befund 2 eine Ergänzung, die durch bug-011 an Gewicht gewonnen hat: `PoiMap` ruft `onSearchAreaChange` jetzt bei **jedem** `dragend` eines Eckpunkts und bei **jedem** eingefügten Kanten-Punkt auf (`poi-map.tsx:364,381,396`). Jeder dieser Aufrufe landet ungebremst in `setSearchArea`, das ein `DELETE`, ein `INSERT` und ein `INSERT` je Eckpunkt absetzt — bei acht Ecken also zehn Datenbankvorgänge, ohne Transaktion (Befund 7). Ein Nutzer, der eine Fläche nachjustiert, erzeugt in wenigen Sekunden mehrere Dutzend Schreibvorgänge. Genau diese Last sollte die Debounce-Regel aus `stack.md` verhindern.

## Was in Ordnung war

- **Quality-Gate vollständig grün:** `npx tsc --noEmit` fehlerfrei, `npm run lint` fehlerfrei, 747 Tests in 87 Dateien bestanden (37 s). Keine übersprungenen Tests, keine Warnungen.
- **bug-013 ist bis zur Ursache durchgedrungen und auf drei Ebenen abgesichert.** Der Fehler war lautlos — `setData()` nimmt die Daten entgegen, ohne Worker entsteht nur nie eine Kachel, ohne Konsolenfehler. Der Nachbau bildet jetzt genau diesen Unterschied ab (`tests/mocks/maplibre-gl.ts:60-86`: `data` gegen `processedFeatures`) und macht ihn über `querySourceFeatures()` prüfbar. Das ist der seltene Fall, in dem ein Test-Double nicht die Bibliothek *ersetzt*, sondern ihre entscheidende Eigenschaft *nachbildet* — vorher hätte kein Test den Fehler zeigen können, egal wie gründlich.
- **Die Absicherung greift dort, wo der Test prinzipiell nicht hinkommt.** `scripts/verify-standalone-bundle.mjs` prüft nach dem Build sowohl die Pakete im Standalone-Bundle als auch die Worker-Dateien unter `public/maplibre` und läuft als `postbuild` automatisch mit — auch im Container-Build. `lib/map/worker-assets.test.ts` prüft, dass die Kopie byteweise dem installierten Paket entspricht *und* dass die vom Worker relativ nachgeladene zweite Datei mitkopiert wird. Letzteres ist genau der Fehler, den man beim nächsten `maplibre-gl`-Update machen würde.
- **Die Adresse steht an genau einer Stelle.** `lib/map/worker-assets.ts` ist die einzige Quelle für Verzeichnis, Dateinamen und URL; `scripts/copy-map-worker.mjs` und `middleware.ts` beziehen sich darauf, und der Test prüft die Übereinstimmung. Dieselbe Disziplin wie beim Modellnamen in `lib/ai/`.
- **Die Ausnahme in der middleware ist doppelt begründet und beides stimmt.** Der Worker ist im `matcher` ausgenommen (sonst trüge er `no-store` und der Browser lüde bei jedem Kartenaufruf ein halbes Megabyte neu) *und* in `PUBLIC_PREFIXES` (falls die middleware doch einmal darüberliefe). `middleware.test.ts` prüft beide Seiten. Der Zugriffskreis wächst dadurch nicht: ausgeliefert wird eine unveränderte Kopie einer offenen Bibliothek ohne Nutzerdaten.
- **Der Kommentar zu `position: relative`** (`poi-map.module.css:163-168`) erklärt eine Ursache, die man ohne ihn beim nächsten Umbau garantiert erneut einbaut. Dass er die Trefferfläche mit weggenommen hat, ist Befund N1 — die Erklärung selbst ist mustergültig.
- **Die Drag-Behandlung ist richtig aufgeteilt.** `marker.on("drag")` zeichnet nur (`paintDraft`/`paintArea`), `dragend` ändert erst den Zustand (`poi-map.tsx:333-342, 389-398`). Der Kommentar begründet es aus der Bibliothek heraus: eine Zustandsänderung während der Geste baut die Marker neu auf, und beim Entfernen meldet die Bibliothek alle Zuhörer ab — das Ziehen bräche nach dem ersten Pixel ab. Der Nachbau setzt das nach (`Marker.simulateDragTo` verweigert die Arbeit an einer toten Karte), sodass ein Rückfall auffliegt.
- **Der `ResizeObserver` ist die richtige Antwort auf den Klickversatz.** Die Kartenfläche ändert sich beim Ziehen des Trenners und beim Einklappen ohne Fensterereignis; ohne Größenkorrektur rechnet die Bibliothek mit der alten Breite weiter. `tests/setup.ts:5-15` legt den in jsdom fehlenden `ResizeObserver` mit einer Begründung nach, warum ein leerer Nachbau hier genügt.
- **Das gemeinsame Muster für externen Zustand ist konsequent angewandt.** Sowohl `PoiMap` (`:224-228`) als auch `PoisView` (`:47-52`) übernehmen von außen geänderte Daten während des Renderns statt in einem Effekt, mit Verweis auf react.dev. Das ist an beiden Stellen die richtige Wahl und vermeidet den zusätzlichen Renderdurchlauf samt Flackern.
- **`delivery/datenbank.md` ist eine gute Ergänzung** und ordnet sich richtig ein: sie sagt selbst, dass sie eine Momentaufnahme ist und im Konfliktfall die Migrationen gelten. Meine Stichproben gegen `migrations/` stimmten (Tabellenliste, Wertebereiche von `poi.type` und `poi.status`, `number` aus 0014, `on delete cascade` an `search_area_point`).
- **Alle Architekturvorgaben aus `stack.md` eingehalten:** kein SQL außerhalb von `lib/db/`, keine Importe zwischen `app/plan/` und `app/go/` (die beiden Kartenansichten bleiben getrennte Umsetzungen — `poi-map.tsx:176-179` benennt es ausdrücklich), KI-Zugriff nur über `lib/ai/`, Mailversand nur über `lib/mail/mailer.ts`, Domänenlogik in `lib/` ohne Next.js testbar, Secrets ausschließlich aus Umgebungsvariablen. Die neuen Dateien fügen sich ein: `lib/map/` ist UI-freie Logik, `scripts/` sind Build-Werkzeuge.
- **Die `.gitignore`/`.prettierignore`/`eslint.config.mjs`-Ergänzungen für `public/maplibre/` sind vollständig und jeweils begründet** — die kopierte Fremddatei wird weder eingecheckt noch formatiert noch gelintet. An genau einer dieser drei Stellen zu vergessen ist der übliche Fehler; hier ist keine ausgelassen.
- **Der prod-Workflow hält `devops.md` unverändert ein:** ausschließlich `workflow_dispatch` mit Tipp-Bestätigung, kein Push- oder Merge-Trigger, Backup vor dem Deploy. Der dev-Workflow deployt vollautomatisch bei Push auf `dev`, mit `concurrency`-Gruppe gegen überlappende Läufe.

## Empfohlene Reihenfolge

1. **N1** (Trefferflächen zurück auf 44 Pixel, plus Zusicherung in `poi-map.layout.test.ts`) — reines CSS plus ein Test, und es nimmt eine Regression zurück, die einen bereits abgenommenen Bugfix auf dem Zielgerät aufhebt. Ohne die Zusicherung passiert es ein drittes Mal.
2. **Befund 1** (Mandantenprüfung auf den drei Schreib-Endpunkten) — seit zwei Reviews offen, kleiner Eingriff, das Muster liegt fertig in `trips.ts`, und `security.md` benennt es ausdrücklich als Mangel. Bitte gleich mit einer zweiten Erwartung in `api-guard.test.ts` absichern, sonst deckt der grüne Guard-Test die Lücke weiter zu.
3. **Befund 3** (`response.ok` prüfen) — wenige Zeilen, verhindert stillen Datenverlust nach Sitzungsablauf, und Voraussetzung dafür, dass eine Schreib-Warteschlange fehlgeschlagene Vorgänge überhaupt wiederholen kann.
4. **N2** (`useMemo` für `mapPois`, `fitBounds` vom Marker-Aufbau trennen) — zwei kleine Eingriffe, und sie machen die Karte im Hauptanwendungsfall erst benutzbar.
5. **N3** (bug-010/011/012 nachdokumentieren) — reine Übertragungsarbeit aus Commits und Kommentaren, aber sie ist die Voraussetzung dafür, dass Abwägungen wie die aus N1 beim nächsten Mal vollständig auf dem Tisch liegen.
6. **Befund 7** (Transaktionen), zuerst `replaceRecoveryCodes` — dort erzeugt ein Abbruch eine Aussperrung, was `security.md` ausdrücklich ausschließt.
7. **Befund 2** (Schreib-Debounce) — oder die bewusste Entscheidung, die Vorgabe aus `stack.md` zu streichen. Nach vier Reviews ohne Umsetzung ist der jetzige Zustand, in dem eine bindende Vorgabe dauerhaft unerfüllt bleibt, die schlechteste der beiden Möglichkeiten.

---

**Zur Arbeitsweise dieser Review:** Ausgeführt wurden `npx tsc --noEmit`, `npm run lint` und `npm test` am Stand 782c4a4. Befund N2 habe ich mit einem Wegwerf-Test gegen `PoisView` empirisch bestätigt; die Datei ist wieder entfernt, das Repo ist unverändert (`git status` sauber). Es wurde nichts committet oder gepusht. Kein Zugriff auf prod, keine Datenbank angefasst.
