---
type: security
repo: Wegfara
commit: e71a706
date: 2026-08-05
---

# Security: Wegfara (e71a706)

Automatisch erstellt vom appbaua-Worker am 2026-08-05.

Sicherheits-Check abgeschlossen. Da mehrere Findings vorliegen (darunter live verifizierte Datenexposition), folgt hier der vollständige Bericht:

---
project: wegfara
commit: e71a706
date: 2026-08-05
---

# Security-Check — 2026-08-05

## Kurz-Zusammenfassung

`delivery/security.md` liegt vor und wurde als SOLL herangezogen; ergänzend der letzte Security-Report vom 2026-07-29 (Commit 66e0c16) und der Code-Review-Bericht vom 2026-08-04 (Commit 4cd8278) zum Abgleich, was sich seither verändert hat. Ergebnis: **die beiden schwerwiegendsten Befunde von vor einer Woche bestehen unverändert fort**, obwohl der Funktionsumfang seither deutlich gewachsen ist (Planer, POI-Suche per KI, Kartenmodul, Startseite — req-007 bis req-015). `app/go` und jetzt zusätzlich `app/plan` liefern weiterhin ohne jede Anmeldung reale, personenbezogene Reisedaten aus — live bestätigt. Parallel dazu ist die Zahl der ungeschützten Schreib-Endpunkte von einem auf vier gewachsen, darunter einer, der kostenpflichtige KI-Anfragen auslöst. Das zugehörige Auth-Requirement (req-016) ist zwar inzwischen formuliert, liegt aber noch in `draft/` — nicht einmal in `ready/`. Backup ist weiterhin nicht als Anwendungsfunktion implementiert. Bei den Dependency-Schwachstellen hat sich die Lage leicht verbessert: ein sauberer, nicht-brechender Fix ist jetzt verfügbar.

Keiner der Befunde deutet auf Bösartigkeit hin. Weil die App aber weiterhin live auf einer öffentlich erreichbaren Domain mit echten Daten läuft und der Funktionsumfang seit dem letzten Check gewachsen ist, ohne dass Auth nachgezogen wurde, wiegt der unveränderte Zustand schwerer als vor einer Woche.

## Befunde

### 1. `/go` und `/plan` zeigen weiterhin reale Reisedaten ohne jede Authentifizierung (hoch)

Unverändert gegenüber dem 2026-07-29-Report: Es existiert im Repo weiterhin keine `middleware.ts`, keine Auth-Bibliothek, kein Session-Code. `app/go/page.tsx` und `app/plan/page.tsx` (letzterer ist seit req-009–011 neu hinzugekommen) rendern `listTrips`/`listPois`/`listActivities`/`listTransfers`/`listSearchAreas`/`listActivityOptionSelections` für den fest hinterlegten `ACCOUNT_ID` ohne jede Login- oder Sitzungsprüfung.

**Live verifiziert (05.08.2026):** `https://dev.wegfara.com/go` und `https://dev.wegfara.com/plan` liefern beide HTTP 200 ohne Login und zeigen die reale Wien-Reise des Betreibers (Zeitraum 9.–11. Oktober 2026, „Stephansdom", „Check-in Hotel Am Stephansplatz" mit Uhrzeiten) vollständig lesbar für jeden, der die URL kennt. `https://app.wegfara.com` (prod) antwortet weiterhin mit Cloudflare-Fehler 530 — dort liegt kein Datenleck vor, da prod laut Backlog noch nicht befüllt/deployt ist.

`delivery/security.md` fordert unter „Zugriffskreis": *„Login ist Pflicht. Jeder Zugriff auf Reisedaten setzt eine angemeldete Person voraus."* Das ist im IST weiterhin nicht erfüllt.

**Empfehlung:** `delivery/requirements/draft/req-016-anmeldung.md` ist bereits vollständig formuliert (Passkey, Magic Link, Notfallcodes, Sitzungsbindung) — als nächstes Requirement nach `ready` ziehen und vor jedem weiteren Feature-Ausbau umsetzen. Bis dahin ersatzweise: dev-Umgebung nicht mit echten personenbezogenen Reisedaten seeden, oder Zugriff temporär z. B. per Cloudflare Access vor der Anwendung einschränken.

### 2. Vier schreibende bzw. kostenauslösende API-Endpunkte ohne Auth- und Mandantenprüfung (hoch)

Der 2026-07-29-Report hatte einen Endpunkt (`activity-option-selection`) gemeldet; der Code-Review vom 2026-08-04 hatte bereits zwei weitere identifiziert. Aktueller Stand — alle vier weiterhin ungeschützt:

- `app/api/activity-option-selection/route.ts` (POST) — schreibt `setActivityOptionSelection` mit client-gelieferter `tripId`, keine Auth-/Ownership-Prüfung.
- `app/api/poi-status/route.ts` (POST) — schreibt `setPoiStatus` mit client-gelieferter `poiId`, keine Prüfung, ob der POI zum Account gehört.
- `app/api/search-area/route.ts` (POST/DELETE) — schreibt/löscht `search_area` mit client-gelieferter `tripId`, keine Prüfung.
- `app/api/poi-search/route.ts` (POST) — **neu seit dem letzten Security-Check** (req-014): löst ohne jede Anmeldung eine kostenpflichtige OpenAI-Anfrage (`searchPoisWithAi` → `openAiClient.complete`) sowie Overpass-API-Aufrufe aus und schreibt die Ergebnisse per `createPois` in die Datenbank. Dieser Endpunkt ist nicht nur ein Datenschutz-, sondern auch ein Kostenrisiko: jeder, der die URL kennt, kann beliebig oft KI-Anfragen auf Kosten des Betreibers auslösen.

Aus Code erschlossen, nicht live gegen die Endpunkte getestet, um keine echten Daten zu verändern und keine realen OpenAI-Kosten auszulösen. Solange nur ein Account existiert, ist der Mandantenbezug praktisch nicht verletzbar; alle vier Endpunkte sind aber schon jetzt ohne jede Anmeldung von außen erreichbar.

**Empfehlung:** Zusammen mit req-016 einen einheitlichen Auth-Check (Middleware) einführen, der alle vier Routen abdeckt, plus serverseitige Ownership-Prüfung (`tripId`/`poiId` gegen `account_id`) nach demselben Muster wie die lesenden Funktionen. `poi-search` sollte zusätzlich unabhängig von Auth ein Rate-Limit bekommen, da ein einzelner kompromittierter/geleakter Zugang sonst unbegrenzt Kosten verursachen kann.

### 3. Backup weiterhin nicht als Anwendungsfunktion implementiert (mittel)

`delivery/security.md` fordert: täglich, automatisch, durch die Backup-Funktion der Anwendung, DB und Bilddateien gemeinsam, mit einem zweiten, externen Ziel außerhalb des Beelink, und eine getestete Wiederherstellung. `delivery/stack.md` bestätigt: „Backup ist Teil der Anwendung, nicht der Infrastruktur."

Im Code (`lib/`, `scripts/`) existiert weiterhin keine Backup-Implementierung — unverändert seit dem letzten Check. Die einzige Sicherung bleibt der Schritt „Backup vor dem Deploy" in `.github/workflows/deploy-prod.yml`: läuft nur unmittelbar vor einem manuellen prod-Deploy, nicht täglich/automatisch, und legt den Dump unter `~/wegfara-backups/` auf **derselben** Maschine ab (kein zweites, externes Ziel). Es existiert im Requirements-Backlog (`delivery/requirements/`) noch kein einziges Requirement zum Thema Backup — auch nicht als Entwurf.

Aus Code/Config erschlossen, kein SSH-Zugang zum Beelink in dieser Session.

**Empfehlung:** Backup als eigenständiges Requirement einlasten (bisher fehlt selbst der Entwurf): täglicher, automatischer Lauf, DB + Bilder gemeinsam, Übertragung an ein Ziel außerhalb des Beelink, plus dokumentierter/automatisierter Restore-Test.

### 4. Transitive Dependency-Schwachstellen — jetzt ohne Breaking Change behebbar (niedrig-mittel)

`npm audit --production` meldet weiterhin 3 „high"-Findings über transitive Next.js-Abhängigkeiten: `postcss` (XSS im CSS-Stringify-Output, Path Traversal/Info-Disclosure über `sourceMappingURL`) und `sharp` (libvips-CVEs, u. a. CVE-2026-33327/33328/35590/35591).

**Verbesserung gegenüber dem 2026-07-29-Report:** Damals war nur `npm audit fix --force` mit einem Downgrade auf `next@9.3.3` (Breaking Change) verfügbar. Aktuell (`npm audit fix --dry-run`) reicht ein einfaches `npm audit fix`: `next` 16.2.12 → 16.3.0 (Minor-Update), `sharp` 0.34.5 → 0.35.3, `postcss` 8.4.31 → 8.5.23 — keine Force-Option, kein Major-Wechsel nötig.

Aus `npm audit`-Output erschlossen. `postcss`/`sharp` werden im Next-Build-Prozess verwendet, nicht direkt zur Laufzeit mit Nutzereingaben aus dem Internet konfrontiert — das Risiko ist eher build-seitig.

**Empfehlung:** `npm audit fix` zeitnah einspielen und Testsuite/Build danach verifizieren — der Fix ist jetzt risikoarm und sollte nicht länger aufgeschoben werden.

## Was in Ordnung war

- Secrets (DB-Zugang, `AUTH_SECRET`, `OPENAI_API_KEY`, `CLOUDFLARE_TUNNEL_TOKEN`, künftiger SMTP-Zugang) liegen ausschließlich in env-Dateien/Compose-Variablen außerhalb des Repos; kein hartkodiertes Secret im Code gefunden.
- Alle lesenden DB-Funktionen filtern weiterhin konsequent nach `account_id` — die Mandantentrennung ist beim Lesen sauber durchgehalten (auch für die neuen Module Planer/POIs).
- PostgreSQL und Bildverzeichnis sind laut `docker-compose.yml` nicht portfreigegeben, App nur `127.0.0.1` gebunden — Zugriff ausschließlich über den Cloudflare Tunnel.
- `dev.wegfara.com` live per HTTPS erreichbar, kein Zertifikatsfehler (live verifiziert).
- `robots.txt` schließt Suchmaschinen und KI-Crawler weiterhin explizit aus (live verifiziert, inkl. GPTBot/ClaudeBot/Google-Extended).
- Der prod-Deploy-Workflow hat weiterhin korrekt keinen Push-Trigger, nur `workflow_dispatch` mit Bestätigungswort, und sichert vor jedem Deploy.
- `app.wegfara.com` (prod) liefert weiterhin HTTP 530 — kein Datenleck, da prod noch nicht befüllt ist (live verifiziert).
- Standort-/Bewegungsdaten (die in security.md als besonders sensibel benannten „nur letzte bekannte Position") sind laut Code noch nicht implementiert — dieser Teil der Datenschutz-Vorgabe ist aktuell nicht verletzbar, weil die Funktion fehlt, nicht weil sie korrekt umgesetzt wäre.
