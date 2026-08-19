---
type: security
repo: Wegfara
commit: a07a8b9
date: 2026-08-19
---

# Security: Wegfara (a07a8b9)

Automatisch erstellt vom appbaua-Worker am 2026-08-19.

Ich habe nichts im Repo geändert (`git status` ist weiterhin sauber); alle Prüfungen waren lesend, die Live-Abfragen gingen nur gegen `dev.wegfara.com`.

---
project: wegfara
commit: a07a8b9
date: 2026-08-19
---

# Security-Check — 2026-08-19

## Kurz-Zusammenfassung

`delivery/security.md` lag vor und war das SOLL; ergänzend herangezogen wurden `CLAUDE.md`, `delivery/stack.md`, `delivery/devops.md` und die drei vorherigen Berichte (2026-07-29, 08-05, 08-12).

**Die beiden bisherigen hoch-Findings sind erledigt.** Mit req-016 gibt es jetzt eine echte Anmeldung: `middleware.ts` schützt alles außer Startseite, Anmeldung und Health-Endpunkt; die Seiten `/go`, `/plan`, `/konto` verlangen `requireSession()` und lesen den Mandanten aus `session.participant.accountId` statt aus der festen `ACCOUNT_ID`. Live bestätigt: `/go`, `/plan`, `/konto` leiten unangemeldet auf `/anmeldung` um, und alle sechs Fach-Schnittstellen (`poi-status`, `search-area`, `activity-option-selection`, `poi-search`, `trips`, `place-search`) antworten ohne Sitzung mit `401`. Das kostenauslösende `poi-search` ist damit ebenfalls dicht. Passkeys, Anmeldelinks, Notfallcodes und Sitzungs-Token liegen ausschließlich als SHA-256-Prüfsumme in der DB.

Neu und gravierend ist dafür ein Transport-Befund: **`dev.wegfara.com` liefert die Anwendung auch über unverschlüsseltes `http://` aus, ohne Weiterleitung auf HTTPS und ohne HSTS — und setzt in diesem Fall das Sitzungs-Cookie ohne `Secure`-Flag.** Damit ist die HTTPS-Pflicht aus `delivery/security.md` nicht erfüllt und ein Anmeldevorgang über ein fremdes WLAN gibt das Sitzungs-Token im Klartext preis. Dazu kommen vier schreibende Pfade ohne Besitzprüfung, die weiterhin fehlende Backup-Funktion (dritter Bericht in Folge) und unverändert vier High-Schwachstellen in Abhängigkeiten.

Nicht prüfbar in dieser Sitzung: kein SSH-Zugang zum Beelink hinterlegt (`~/.ssh` leer) — Infrastruktur, Tunnel-Konfiguration und tatsächlicher Backup-Bestand konnten deshalb nur aus Code/Config beurteilt werden. `app.wegfara.com` (prod) antwortet weiterhin mit HTTP 530, dort war kein Live-Test möglich.

## Befunde

### 1. Anwendung über unverschlüsseltes HTTP erreichbar, Sitzungs-Cookie dann ohne `Secure` (hoch)

**Live verifiziert (19.08.2026):**

- `http://dev.wegfara.com/` → **200** mit vollständigem App-HTML. Keine Weiterleitung auf `https://`.
- `http://dev.wegfara.com/anmeldung` → **200**, die Anmeldeseite ist also im Klartext benutzbar.
- Auf der HTTPS-Antwort fehlt jeder `Strict-Transport-Security`-Header — der Browser hat keinen Anlass, von sich aus auf HTTPS zu wechseln.
- Entscheidend: `POST http://dev.wegfara.com/api/auth/abmelden` antwortet mit
  `wegfara_sitzung=; Path=/; Max-Age=0; HttpOnly; SameSite=lax` — **ohne `Secure`**,
  während dieselbe Anfrage über HTTPS `... Max-Age=0; Secure; HttpOnly; SameSite=lax` liefert.

Ursache im Code: `lib/auth/cookies.ts` leitet das `Secure`-Flag aus `connectionIsSecure(x-forwarded-proto, url)` ab (`middleware.ts:36`, `lib/auth/cookie-store.ts:24`). Der Fallback ohne `Secure` ist für die lokale Entwicklung gedacht, greift hinter dem Cloudflare Tunnel aber genauso, sobald jemand `http://` aufruft. Wer sich dann über Anmeldelink oder Notfallcode anmeldet, bekommt ein Sitzungs-Token, das jeder im selben Hotel-/Café-WLAN mitlesen und für 90 Tage weiterverwenden kann.

`delivery/security.md` fordert: *„HTTPS: Pflicht für beide Umgebungen … Kein unverschlüsselter Zugriff."* Nicht erfüllt.

**Empfehlung** — dreifach absichern:
1. In Cloudflare für beide Zonen **„Always Use HTTPS"** einschalten und **HSTS** aktivieren (`max-age` ≥ 6 Monate, `includeSubDomains`). Das ist der eigentliche Fix und kostet keine Codeänderung.
2. Als zweite Absicherung in `middleware.ts`: bei `x-forwarded-proto !== "https"` per 308 auf `appUrl()` + Pfad umleiten.
3. `sessionCookieOptions()` darf im Betrieb nie ohne `Secure` ausliefern — `secure: process.env.NODE_ENV === "production" ? true : connectionIsSecure(...)`. Der Dev-Komfort bleibt, das Produktionsrisiko verschwindet.

### 2. Vier schreibende Endpunkte prüfen die Anmeldung, aber nicht den Besitz (mittel)

Aus Code erschlossen (nicht live ausgelöst, um keine echten Daten zu verändern). Alle vier verlangen inzwischen eine Sitzung, geben die vom Client gelieferte ID danach aber ungeprüft an den Datenzugriff weiter:

| Route | Datenzugriff | Fehlt |
|---|---|---|
| `app/api/poi-status/route.ts:22` | `setPoiStatus(db, poiId, status)` — `lib/db/pois.ts:55`: `update poi set status = $2 where id = $1` | kein `account_id`-Bezug |
| `app/api/search-area/route.ts:36,51` | `setSearchArea`/`clearSearchArea(db, tripId, …)` — `lib/db/search-area.ts:45,65` | kein `account_id`-Bezug |
| `app/api/activity-option-selection/route.ts:22` | `setActivityOptionSelection(db, tripId, …)` — `lib/db/activity-option-selections.ts:44` | kein `account_id`-Bezug, zusätzlich `selected_activity_id` nicht gegen dieselbe Reise geprüft |

`delivery/security.md` ist hier ausdrücklich: *„Auch solange nur ein Mandant existiert, ist ein fehlender Mandantenfilter ein Sicherheitsmangel — er fällt erst auf, wenn es zu spät ist."* Genau diese Situation liegt vor: heute gibt es einen Account und einen Teilnehmer, aber `delivery/security.md` plant Familie und Freunde als Teilnehmer ein. Ab dem zweiten Teilnehmer kann jeder Angemeldete mit einer fremden POI- oder Reise-ID Bewertungsstatus, Suchgebiet und Options-Wahl einer fremden Reise überschreiben.

Positiv und als Vorlage direkt vorhanden: `lib/db/trips.ts:55` hat mit `belongsToAccount()` genau das richtige Muster, und `poi-search` erzwingt den Besitz implizit, weil das Suchgebiet über `listSearchAreas(db, accountId)` aufgelöst wird.

**Empfehlung:** Die drei Datenzugriffs-Funktionen um `accountId` erweitern und den Filter in die SQL-Bedingung ziehen (z. B. `update poi set status = $3 from trip t where poi.id = $1 and t.id = poi.trip_id and t.account_id = $2`), Rückgabe `false`/`404` statt stillem `ok`, wenn nichts getroffen wurde. Bei der Options-Wahl zusätzlich prüfen, dass `selected_activity_id` zur selben Reise gehört. Je ein Test „fremde ID wird abgewiesen" pro Route.

### 3. Backup weiterhin nicht als Anwendungsfunktion vorhanden — und weiterhin nicht im Backlog (mittel)

Aus Code/Config erschlossen; ein Live-Blick auf `~/wegfara-backups/` war mangels SSH-Zugang nicht möglich.

`delivery/security.md` fordert tägliches, automatisches Backup von DB **und** Bilddateien in einem gemeinsamen Lauf, ein Ziel **außerhalb** des Beelink und eine **getestete** Wiederherstellung. Der Stand: in `lib/` und `scripts/` existiert keine Backup-Implementierung. Einzige Sicherung bleibt der Schritt „Backup vor dem Deploy" in `.github/workflows/deploy-prod.yml` — er legt `db.sql` und `images.tar.gz` unter `~/wegfara-backups/` auf **derselben Maschine** ab und läuft nur bei einem manuell ausgelösten prod-Deploy, nicht täglich. Nach der eigenen Vorgabe (*„Ein Backup, das nur auf derselben Maschine liegt, gilt als nicht vorhanden"*) ist damit kein Backup vorhanden.

`delivery/requirements/{draft,ready,in-progress}/` enthalten ausschließlich `.gitkeep` — es gibt zu diesem Thema weiterhin nicht einmal einen Entwurf. Das ist der dritte Bericht in Folge mit demselben Befund, während die Anwendung inzwischen echte Anmeldedaten, Passkeys und Reisedaten führt.

**Empfehlung:** Ein Requirement „Backup und Wiederherstellung" formulieren und vor dem nächsten Feature einlasten: täglicher automatischer Lauf, DB + Bilder in einem zueinander passenden Stand, Übertragung an ein Ziel außerhalb des Beelink, dazu ein einmal durchgeführter und dokumentierter Restore-Test.

### 4. Sitzungen: feste 90 Tage statt Reisezeitraum, und kein Fernwiderruf bei Geräteverlust (mittel)

Aus Code erschlossen.

- `lib/auth/lifetime.ts:10` setzt `SESSION_DURATION_MS = 90 Tage` und verlängert bei jeder Nutzung (`current-session.ts:26`). Eine regelmäßig genutzte Sitzung läuft damit praktisch nie ab. `delivery/security.md` verlangt dagegen eine aus dem Reisezeitraum abgeleitete Dauer, die *„danach automatisch abläuft"*. Die Abweichung ist in `lifetime.ts:4-9` bewusst dokumentiert und für req-016 ausgeklammert — sie steht aber in keinem Backlog-Eintrag und läuft damit Gefahr, dauerhaft zu bleiben.
- `delivery/security.md` verlangt außerdem: *„Sitzungen lassen sich aus der Ferne beenden: bei Geräteverlust kann der betroffene Teilnehmer — und der Organisator — alle Sitzungen des Kontos widerrufen."* Implementiert ist nur `deleteSessionByToken` (`lib/db/sessions.ts:89`), und `app/konto/konto-view.tsx:217` sagt es selbst: *„Das Abmelden beendet die Sitzung sofort — auf diesem Gerät."* Ein verlorenes Smartphone behält bis zu 90 Tage Zugriff auf alle Reisedaten, und es gibt keinen Weg, das zu unterbinden.
- Nebenbefund: `deleteExpiredSessions` (`lib/db/sessions.ts:99`) wird außerhalb der Tests nirgends aufgerufen — abgelaufene Sitzungszeilen bleiben unbegrenzt liegen.

**Empfehlung:** Ein Folge-Requirement zu req-016: „Alle Sitzungen dieses Kontos beenden" auf `/konto` (ein `delete from session where participant_id = $1`, plus Wirkung auf die eigene laufende Sitzung), dazu der Aufruf von `deleteExpiredSessions` beim Start oder in einem täglichen Lauf. Die Bindung der Sitzungsdauer an den Reisezeitraum entweder einlasten oder die Abweichung in `delivery/security.md` bewusst festschreiben — der jetzige Schwebezustand ist die schlechteste der drei Möglichkeiten.

### 5. Vier High-Schwachstellen in Abhängigkeiten, unverändert seit drei Wochen (mittel)

Aus `npm audit --omit=dev` erschlossen. Installiert: `next 16.2.12`, `sharp 0.34.5`, `postcss 8.4.31`.

- `postcss` ≤ 8.5.22 — XSS über unescaptes `</style>`, dazu drei Path-Traversal-/Arbitrary-File-Read-Advisories über `sourceMappingURL` (GHSA-qx2v-qp2m-jg93, -6g55-p6wh-862q, -fxqj-rqcc-2cmp, -r28c-9q8g-f849)
- `sharp` < 0.35.0 — libvips-CVEs 2026-33327/33328/35590/35591
- `nanoid` < 3.3.18 — Endlosschleife bei Größe 0 (GHSA-2v37-7h3g-55p8)
- `next` ist über `postcss` und `sharp` mitbetroffen

`npm audit fix --dry-run` löst alle vier ohne `--force` und ohne Major-Wechsel (`next` → ≥ 16.3.0). Betroffen ist überwiegend der Build-Weg, nicht direkt Nutzereingaben aus dem Internet — der Aufwand ist aber so gering, dass das kein Grund zum Warten ist.

**Empfehlung:** `npm audit fix` einspielen, danach `npm test`, `npm run build` und `npx tsc --noEmit` grün ziehen und über den normalen dev-Deploy abnehmen.

### 6. Keine Sicherheits-Header gesetzt (niedrig)

Live verifiziert: die Antworten von `dev.wegfara.com` enthalten weder `Content-Security-Policy` noch `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy` oder `Permissions-Policy`. `next.config.ts` definiert keine `headers()`.

Konkret relevant hier: ohne `frame-ancestors`/`X-Frame-Options` lässt sich die angemeldete Anwendung in einen fremden Rahmen einbetten (die schreibenden Aktionen in `/plan` sind per Klick auslösbar; `SameSite=lax` schützt davor nicht, weil die Anfragen aus dem eingebetteten, gleichnamigen Ursprung kämen). Und `Permissions-Policy` ist das passende Werkzeug für eine App, die laut `delivery/stack.md` Kamera und Standort nutzt.

**Empfehlung:** In `next.config.ts` eine `headers()`-Sektion für alle Pfade: `X-Frame-Options: DENY` bzw. CSP mit `frame-ancestors 'none'`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: geolocation=(self), camera=(self)`. Eine vollständige CSP kann später folgen — die vier einfachen Header sind ohne Risiko sofort setzbar.

### 7. `cloudflared:latest` ist nicht festgenagelt (niedrig)

Aus `deploy/docker-compose.yml:69` erschlossen: Während `postgres:17-alpine` und `node:22-alpine` gepinnt sind, zieht der Tunnel-Container `cloudflare/cloudflared:latest`. Jeder Deploy kann damit unbemerkt eine andere Version der Komponente hochziehen, die den einzigen Weg von außen in das Heimnetz aufbaut — und ein Rollback wird zum Ratespiel.

**Empfehlung:** Auf eine konkrete Version pinnen (z. B. `cloudflare/cloudflared:2026.8.0`) und beim Dependency-Update mitziehen.

## Was in Ordnung war

- **Anmeldung greift, live bestätigt:** `/go`, `/plan`, `/konto` → 307 auf `/anmeldung?weiter=…`; `poi-status`, `search-area`, `activity-option-selection`, `poi-search`, `trips`, `place-search` und `auth/passkey/registrierung` → 401 `{"error":"nicht angemeldet"}`. Die zwei hoch-Findings der letzten drei Berichte sind damit geschlossen.
- **Geheimnisse:** kein hartkodiertes Secret im Repo gefunden. `DATABASE_URL`, `AUTH_SECRET`, `OPENAI_API_KEY`, `SMTP_*` und `CLOUDFLARE_TUNNEL_TOKEN` stehen nur als `${VAR}`-Referenzen in `deploy/docker-compose.yml`; die Werte liegen laut `devops.md` in `~/wegfara-env/*.env` mit Rechten 600 außerhalb des Repos. `.gitignore` schließt `.env*` aus, keine `.env`-Datei im Arbeitsbaum, keine im Git-Index.
- **Umgang mit Geheimnissen im Code:** Sitzungs-Token, Anmeldelink-Token und Notfallcodes werden nur als SHA-256-Prüfsumme gespeichert (`lib/auth/tokens.ts`, `lib/db/{sessions,login-links,recovery-codes}.ts`); vom Passkey wird ausschließlich der öffentliche Schlüssel abgelegt. Entwertet wird serverseitig in der `WHERE`-Bedingung des `UPDATE` (`consumeLoginLink`, `consumeRecoveryCode`) — auch bei gleichzeitigen Versuchen.
- **Anmeldung im Detail:** einheitliche Antwort bei bekannter und unbekannter Adresse; Rate-Limits auf beiden offenen Endpunkten (5/15 min für Anmeldelinks, 10/15 min für Notfallcodes); Anmeldelink 15 min gültig und einmal verwendbar; ein neuer Link entwertet den vorherigen; WebAuthn-Challenge 5 min und genau einmal beantwortbar; Notfallcodes mit ~60 Bit Entropie. `safeRedirectTarget()` blockt `//host`, `/\host` und Steuerzeichen — offene Weiterleitung nicht möglich.
- **Mandantentrennung auf den Lesepfaden:** `listTrips`, `listPois`, `listSearchAreas`, `listActivities`, `listTransfers`, `listActivityOptionSelections` filtern durchgängig nach `account_id`; `updateTrip`/`deleteTrip` prüfen den Besitz über `belongsToAccount()`.
- **Erreichbarkeit der Infrastruktur:** PostgreSQL ohne Portfreigabe, nur im Compose-Netz; die App an `127.0.0.1:${APP_PORT}` gebunden; Zugang von außen ausschließlich über den Cloudflare Tunnel; keine Portfreigabe im Router. Entspricht `delivery/security.md`.
- **Container:** Mehrstufiger Build, Laufzeit als unprivilegierter Nutzer `nextjs` (UID 1001), Bildverzeichnis als Host-Volume außerhalb des Containers.
- **Deploy:** `deploy-prod.yml` hat unverändert keinen Push- oder Merge-Trigger, nur `workflow_dispatch` mit Bestätigungswort `deploy`.
- **Externe Dienste:** Der KI-Aufruf liegt hinter der austauschbaren Schnittstelle in `lib/ai/`; an OpenAI, Nominatim und Overpass gehen Suchgebiet, Typfilter und Wunschtext — keine Teilnehmerdaten, keine Kennungen.
- **`robots.txt`** schließt weiterhin alles aus (`User-agent: *` / `Disallow: /`), live bestätigt.

Der Bericht wird als Datei unter `delivery/security/` abgelegt.
