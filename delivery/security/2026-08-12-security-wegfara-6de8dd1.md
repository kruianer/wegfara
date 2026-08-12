---
type: security
repo: Wegfara
commit: 6de8dd1
date: 2026-08-12
---

# Security: Wegfara (6de8dd1)

Automatisch erstellt vom appbaua-Worker am 2026-08-12.

---
project: wegfara
commit: 6de8dd1
date: 2026-08-12
---

# Security-Check — 2026-08-12

## Kurz-Zusammenfassung

`delivery/security.md` liegt vor und wurde als SOLL herangezogen, ergänzend die letzten beiden Security-Reports (2026-08-05, Commit e71a706, und davor 2026-07-29, Commit 66e0c16). Seit dem letzten Check am 05.08. gab es **keine Code-Änderung** im Repo — nur zwei neue Berichtsdateien wurden abgelegt (Code-Review, Security-Bericht). Alle vier damaligen Findings bestehen daher unverändert fort, live erneut bestätigt: `/go` liefert weiterhin ohne jede Anmeldung reale, personenbezogene Reisedaten des Betreibers aus, und dieselben vier Schreib-/KI-Endpunkte sind weiterhin ohne Auth- und Mandantenprüfung erreichbar. Neu ist lediglich, dass `npm audit` zusätzlich zu `postcss`/`sharp` jetzt auch eine High-Schwachstelle in `nanoid` meldet — weiterhin ohne Breaking Change behebbar.

Der unveränderte Zustand über nunmehr zwei Wochen bei weiterhin lauffähiger, öffentlich erreichbarer dev-Instanz mit echten Daten wiegt schwerer als beim letzten Check.

## Befunde

### 1. `/go` liefert weiterhin reale Reisedaten ohne jede Authentifizierung (hoch)

Unverändert: keine `middleware.ts`, keine Auth-Bibliothek, kein Session-Code im Repo. `app/go/page.tsx` und `app/plan/page.tsx` rendern Trips/Aktivitäten/POIs für den fest hinterlegten `ACCOUNT_ID` ohne Login- oder Sitzungsprüfung.

**Live verifiziert (12.08.2026):** `https://dev.wegfara.com/go` liefert ohne Login die reale Wien-Reise des Betreibers (9.–11.10.2026, „Stephansdom", „Hotel Am Stephansplatz", „Figlmueller" mit konkreten Uhrzeiten wie 10:00–11:30 und 19:00–20:30) vollständig lesbar für jeden, der die URL kennt. `https://app.wegfara.com` (prod) antwortet weiterhin mit HTTP 530 — dort liegt kein Leck vor, da prod noch nicht befüllt ist.

`delivery/security.md` fordert: *„Login ist Pflicht. Jeder Zugriff auf Reisedaten setzt eine angemeldete Person voraus."* Weiterhin nicht erfüllt.

**Empfehlung:** `delivery/requirements/draft/req-016-anmeldung.md` liegt seit mindestens zwei Wochen fertig formuliert in `draft/`, noch nicht einmal in `ready/`. Als nächstes vor jedem weiteren Feature-Ausbau nach `ready` ziehen und umsetzen. Bis dahin ersatzweise: dev nicht mit echten personenbezogenen Daten seeden, oder Zugriff temporär per Cloudflare Access vorschalten.

### 2. Vier schreibende bzw. kostenauslösende API-Endpunkte weiterhin ohne Auth- und Mandantenprüfung (hoch)

Unverändert seit 2026-08-05, aus Code bestätigt (nicht live gegen die Endpunkte getestet, um keine echten Daten zu verändern oder OpenAI-Kosten auszulösen):

- `app/api/activity-option-selection/route.ts` (POST) — schreibt mit client-gelieferter `tripId`, keine Ownership-Prüfung.
- `app/api/poi-status/route.ts` (POST) — schreibt mit client-gelieferter `poiId`, keine Prüfung.
- `app/api/search-area/route.ts` (POST/DELETE) — schreibt/löscht mit client-gelieferter `tripId`, keine Prüfung.
- `app/api/poi-search/route.ts` (POST) — löst ohne Anmeldung eine kostenpflichtige OpenAI-Anfrage sowie Overpass-Aufrufe aus und schreibt Ergebnisse in die DB. Kosten- und Datenschutzrisiko zugleich: jeder, der die URL kennt, kann beliebig oft KI-Anfragen auf Kosten des Betreibers auslösen.

**Empfehlung:** Zusammen mit req-016 eine einheitliche Auth-Middleware für alle vier Routen einführen, plus serverseitige Ownership-Prüfung (`tripId`/`poiId` gegen `account_id`). `poi-search` zusätzlich unabhängig von Auth mit einem Rate-Limit versehen.

### 3. Backup weiterhin nicht als Anwendungsfunktion implementiert, nicht einmal als Requirement erfasst (mittel)

`delivery/security.md`/`delivery/stack.md` fordern täglichen, automatischen Backup von DB + Bilddateien gemeinsam durch die Anwendung, mit externem Zweitziel und getesteter Wiederherstellung. In `lib/` und `scripts/` existiert weiterhin keine Backup-Implementierung. Einzige Sicherung bleibt der Schritt „Backup vor Deploy" im prod-Deploy-Workflow — legt den Dump unter `~/wegfara-backups/` auf **derselben** Maschine ab, läuft nur bei einem manuell ausgelösten prod-Deploy, nicht täglich. Im Requirements-Backlog (`draft/`, `ready/`, `in-progress/`) existiert weiterhin kein einziges Backup-Requirement, auch nicht als Entwurf.

Aus Code/Config erschlossen, kein SSH-Zugang zum Beelink in dieser Session genutzt (Backup-Task ist autonom laufend; Live-Zugriff auf den Server war für diesen Check nicht erforderlich, da die Repo-Lage eindeutig ist).

**Empfehlung:** Backup als eigenständiges Requirement einlasten — täglicher automatischer Lauf, DB + Bilder gemeinsam, Übertragung an ein Ziel außerhalb des Beelink, dokumentierter Restore-Test.

### 4. Transitive Dependency-Schwachstellen — jetzt vier statt drei, weiterhin ohne Breaking Change behebbar (niedrig-mittel)

`npm audit --production` meldet aktuell **4** High-Findings (vorheriger Check: 3): neu hinzugekommen `nanoid` (<3.3.17, GHSA-2v37-7h3g-55p8, kann bei Größe 0 endlos loopen), weiterhin `postcss` (XSS/Path-Traversal über `sourceMappingURL`) und `sharp` (libvips-CVEs 2026-33327/33328/35590/35591), transitiv über `next`.

`npm audit fix --dry-run` löst weiterhin alle vier ohne Force/Major-Wechsel: `next` → 16.3.0, `sharp` → 0.35.3, `postcss` → 8.5.23, `nanoid` → 3.3.17 bzw. entsprechende Minor-Anhebung.

Aus `npm audit`-Output erschlossen. Betrifft primär den Next-Build-Prozess, nicht direkt Laufzeit-Nutzereingaben aus dem Internet.

**Empfehlung:** `npm audit fix` zeitnah einspielen, danach Testsuite/Build verifizieren.

## Was in Ordnung war

- Secrets (`DATABASE_URL`, `AUTH_SECRET`, `OPENAI_API_KEY`, `CLOUDFLARE_TUNNEL_TOKEN`, DB-Zugangsdaten) liegen ausschließlich in `deploy/docker-compose.yml` als `${VAR}`-Referenzen bzw. env-Dateien außerhalb des Repos; kein hartkodiertes Secret gefunden. `.gitignore` schließt `.env`/`.env.local` korrekt aus.
- Alle lesenden DB-Funktionen filtern weiterhin konsequent nach `account_id`.
- PostgreSQL laut `docker-compose.yml` ohne Portfreigabe, App nur `127.0.0.1:${APP_PORT}` gebunden — Zugriff ausschließlich über den Cloudflare Tunnel.
- `dev.wegfara.com` live per HTTPS erreichbar, kein Zertifikatsfehler (live verifiziert).
- `robots.txt` schließt Suchmaschinen und KI-Crawler weiterhin explizit aus, inklusive abschließendem `Disallow: /` (live verifiziert).
- `app.wegfara.com` (prod) liefert weiterhin HTTP 530 — kein Datenleck, da prod noch nicht befüllt ist (live verifiziert).
- Der prod-Deploy-Workflow hat weiterhin keinen Push-Trigger, nur `workflow_dispatch` mit Bestätigungswort.

Der Bericht wird als Datei unter `delivery/security/` abgelegt.
