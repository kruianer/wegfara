---
type: security
repo: Wegfara
commit: 40a680b
date: 2026-08-26
---

# Security: Wegfara (40a680b)

Automatisch erstellt vom appbaua-Worker am 2026-08-26.

Repo ist unverändert (`git status` sauber), alle Prüfungen waren lesend; Live-Abfragen gingen ausschließlich gegen `dev.wegfara.com`. Ich habe mindestens ein Finding — hier der Bericht.

---
project: wegfara
commit: 40a680b
date: 2026-08-26
---

# Security-Check — 2026-08-26

## Kurz-Zusammenfassung

`delivery/security.md` lag vor und war das SOLL; ergänzend herangezogen wurden `CLAUDE.md`, `delivery/stack.md`, `delivery/devops.md` und die vier vorherigen Berichte (2026-07-29, 08-05, 08-12, 08-19).

Seit dem letzten Bericht (`a07a8b9`) wurden neun Commits geliefert — bug-010, bug-011, bug-013, die Schema-Beschreibung und ein Code-Review. **Kein einziger davon adressiert ein Security-Finding.** Alle sieben Befunde des Vorberichts bestehen unverändert fort, einschließlich des hoch eingestuften Transport-Befunds. Der Diff berührt zwar `middleware.ts` und `next.config.ts`, aber nur für Caching (bug-012) und die Auslieferung des Karten-Workers.

Das hoch-Finding ist **live erneut bestätigt**: `dev.wegfara.com` liefert die Anwendung weiterhin über unverschlüsseltes `http://` aus (Status 200, keine Weiterleitung), es fehlt jeder `Strict-Transport-Security`-Header, und in diesem Fall setzt die Anwendung das Sitzungs-Cookie **ohne `Secure`-Flag** — direkt gegenübergestellt:

```
http : set-cookie: wegfara_sitzung=; Path=/; Max-Age=0; HttpOnly; SameSite=lax
https: set-cookie: wegfara_sitzung=; Path=/; Max-Age=0; Secure; HttpOnly; SameSite=lax
```

Damit ist die HTTPS-Pflicht aus `delivery/security.md` weiterhin nicht erfüllt. Neu hinzugekommen ist ein kleiner Regressions-Befund: die `robots.txt` der Anwendung (`Disallow: /`) wird von Cloudflares „Managed content" überschrieben und liefert jetzt `Allow: /`.

Positiv: die Anmeldung greift unverändert zuverlässig. `/go`, `/plan`, `/konto` leiten unangemeldet mit 307 auf `/anmeldung` um; `trips`, `poi-search` und `place-search` antworten mit `401 {"error":"nicht angemeldet"}`. Kein Secret im Arbeitsbaum, im Git-Index oder in der Git-Historie. Der neu öffentlich gestellte Pfad `/maplibre/*` (bug-013) wurde geprüft und ist unbedenklich — er liefert nur die unveränderte Kartenbibliothek, und ein Traversal-Versuch (`/maplibre/../middleware.ts`) wird normalisiert und läuft in die Anmelde-Weiterleitung.

**Nicht prüfbar in dieser Sitzung:** Kein SSH-Zugang zum Beelink hinterlegt (`~/.ssh` existiert nicht) — Infrastruktur, Tunnel-Konfiguration und tatsächlicher Backup-Bestand konnten deshalb nur aus Code/Config beurteilt werden. `app.wegfara.com` (prod) antwortet über http **und** https mit **HTTP 530** (Cloudflare erreicht den Ursprung nicht). Das ist nun der dritte Bericht in Folge mit 530 auf prod — die prod-Umgebung wurde damit **noch nie live sicherheitsgeprüft**. Sollte prod tatsächlich dauerhaft nicht laufen, ist das eine betriebliche Feststellung, die Sie kennen sollten; sollte sie laufen, ist der Tunnel defekt.

## Befunde

### 1. Anwendung über unverschlüsseltes HTTP erreichbar, Sitzungs-Cookie dann ohne `Secure` (hoch)

**Live verifiziert (26.08.2026)** — unverändert gegenüber dem 19.08.:

- `http://dev.wegfara.com/` → **200** mit vollständigem App-HTML, kein `Location`, keine Weiterleitung auf `https://`.
- `http://dev.wegfara.com/anmeldung` → **200**, die Anmeldeseite ist im Klartext benutzbar.
- Weder die http- noch die https-Antwort trägt `Strict-Transport-Security`. Der Browser hat keinen Anlass, von sich aus auf HTTPS zu wechseln.
- `POST http://dev.wegfara.com/api/auth/abmelden` liefert das Sitzungs-Cookie **ohne `Secure`**, dieselbe Anfrage über HTTPS **mit** (Gegenüberstellung siehe Zusammenfassung).

Ursache im Code: `lib/auth/cookies.ts:36` leitet das `Secure`-Flag aus `connectionIsSecure(x-forwarded-proto, url)` ab (`middleware.ts:38`). Der Fallback ohne `Secure` ist laut Kommentar für die lokale Entwicklung gedacht, greift hinter dem Cloudflare Tunnel aber genauso, sobald jemand `http://` aufruft. Wer sich dann über Anmeldelink oder Notfallcode anmeldet, bekommt ein Sitzungs-Token, das jeder im selben Hotel- oder Café-WLAN mitlesen und — wegen der 90-Tage-Sitzung aus Finding 4 — drei Monate lang weiterverwenden kann. Genau das Szenario, für das `delivery/security.md` den Begleiter im Mobilnetz vorsieht.

`delivery/security.md` fordert: *„HTTPS: Pflicht fuer beide Umgebungen … Kein unverschluesselter Zugriff, keine Zertifikatswarnung."* Nicht erfüllt.

**Empfehlung** — dreifach absichern, in dieser Reihenfolge:
1. In Cloudflare für beide Zonen **„Always Use HTTPS"** einschalten und **HSTS** aktivieren (`max-age` ≥ 6 Monate, `includeSubDomains`). Das ist der eigentliche Fix, kostet keine Codeänderung und wirkt sofort für beide Umgebungen.
2. Als zweite Absicherung in `middleware.ts`: bei `x-forwarded-proto !== "https"` per 308 auf `appUrl()` + Pfad umleiten.
3. `sessionCookieOptions()` darf im Betrieb nie ohne `Secure` ausliefern — `secure: process.env.NODE_ENV === "production" ? true : connectionIsSecure(...)`. Der Dev-Komfort bleibt, das Produktionsrisiko verschwindet.

### 2. Drei schreibende Endpunkte prüfen die Anmeldung, aber nicht den Besitz (mittel)

Aus Code erschlossen (nicht live ausgelöst, um keine echten Daten zu verändern). Alle verlangen inzwischen eine Sitzung, geben die vom Client gelieferte ID danach aber ungeprüft an den Datenzugriff weiter — der Mandant aus `session.participant.accountId` wird gar nicht erst benutzt:

| Route | Datenzugriff | Fehlt |
|---|---|---|
| `app/api/poi-status/route.ts:22` | `lib/db/pois.ts:55` — `update poi set status = $2 where id = $1` | kein `account_id`-Bezug |
| `app/api/search-area/route.ts:36,51` | `lib/db/search-area.ts:45,65` — `delete from search_area where trip_id = $1` | kein `account_id`-Bezug |
| `app/api/activity-option-selection/route.ts:22` | `lib/db/activity-option-selections.ts:44` | kein `account_id`-Bezug; zusätzlich wird `selected_activity_id` nicht gegen dieselbe Reise geprüft |

`delivery/security.md` ist hier ausdrücklich: *„Auch solange nur ein Mandant existiert, ist ein fehlender Mandantenfilter ein Sicherheitsmangel — er faellt erst auf, wenn es zu spaet ist."* Genau diese Situation liegt vor: heute gibt es einen Account, aber `delivery/security.md` plant Familie und Freunde als Teilnehmer ein. Ab dem zweiten Teilnehmer kann jeder Angemeldete mit einer fremden POI- oder Reise-ID Bewertungsstatus, Suchgebiet und Options-Wahl einer fremden Reise überschreiben — `clearSearchArea` löscht dabei ohne Rückfrage.

Das richtige Muster liegt im selben Repo direkt daneben: `lib/db/trips.ts:55` prüft mit `belongsToAccount()`, und `app/api/trips/route.ts` gibt konsequent `404 unknown trip` zurück, wenn die Reise einem anderen Account gehört. `poi-search` erzwingt den Besitz implizit über `listSearchAreas(db, accountId)`.

**Empfehlung:** Die drei Datenzugriffs-Funktionen um `accountId` erweitern und den Filter in die SQL-Bedingung ziehen (z. B. `update poi set status = $3 from trip t where poi.id = $1 and t.id = poi.trip_id and t.account_id = $2`), Rückgabe `false` → `404` statt stillem `ok`, wenn nichts getroffen wurde. Bei der Options-Wahl zusätzlich prüfen, dass `selected_activity_id` zur selben Reise gehört. Je ein Test „fremde ID wird abgewiesen" pro Route — `trips.test.ts` liefert die Vorlage.

### 3. Backup weiterhin nicht als Anwendungsfunktion vorhanden — und weiterhin nicht im Backlog (mittel)

Aus Code/Config erschlossen; ein Live-Blick auf `~/wegfara-backups/` war mangels SSH-Zugang nicht möglich.

`delivery/security.md` fordert tägliches, automatisches Backup von DB **und** Bilddateien in einem gemeinsamen Lauf, ein Ziel **außerhalb** des Beelink und eine **getestete** Wiederherstellung. Der Stand: eine Volltextsuche über `lib/`, `scripts/`, `app/` und `migrations/` nach `backup|sicherung|restore|pg_dump` findet keine einzige Implementierung. Einzige Sicherung bleibt der Schritt „Backup vor dem Deploy" in `.github/workflows/deploy-prod.yml:31` — er legt `db.sql` und `images.tar.gz` unter `~/wegfara-backups/` auf **derselben Maschine** ab und läuft nur bei einem manuell ausgelösten prod-Deploy, nicht täglich. Nach der eigenen Vorgabe (*„Ein Backup, das nur auf derselben Maschine liegt, gilt als nicht vorhanden"*) ist damit **kein Backup vorhanden**.

`delivery/requirements/{draft,ready,in-progress}/` enthalten weiterhin ausschließlich `.gitkeep` — es gibt zu diesem Thema nicht einmal einen Entwurf, während in `delivery/idea/` drei Feature-Ideen liegen. Das ist der **vierte Bericht in Folge** mit demselben Befund, und die Anwendung führt inzwischen echte Anmeldedaten, Passkeys und Reisedaten.

**Empfehlung:** Ein Requirement „Backup und Wiederherstellung" formulieren und vor dem nächsten Feature einlasten: täglicher automatischer Lauf, DB + Bilder in einem zueinander passenden Stand, Übertragung an ein Ziel außerhalb des Beelink, dazu ein einmal durchgeführter und dokumentierter Restore-Test. Angesichts von vier Berichten ohne Bewegung ist das der Befund, der die höchste Priorität verdient — er ist der einzige, bei dem ein Vorfall nicht reparabel wäre.

### 4. Sitzungen: feste 90 Tage statt Reisezeitraum, kein Fernwiderruf bei Geräteverlust (mittel)

Aus Code erschlossen.

- `lib/auth/lifetime.ts:10` setzt `SESSION_DURATION_MS = 90 * DAY_MS` und verlängert bei Nutzung (`shouldRenewSession`, ab einem verbrauchten Tag). Eine regelmäßig genutzte Sitzung läuft damit praktisch nie ab. `delivery/security.md` verlangt eine aus dem Reisezeitraum abgeleitete Dauer, die *„danach automatisch ablaeuft"*. Die Abweichung ist in `lifetime.ts:4-9` bewusst dokumentiert und für req-016 ausgeklammert — sie steht aber in keinem Backlog-Eintrag und läuft damit Gefahr, dauerhaft zu bleiben.
- `delivery/security.md` verlangt außerdem: *„Sitzungen lassen sich aus der Ferne beenden: bei Geraeteverlust kann der betroffene Teilnehmer — und der Organisator der Reise — alle Sitzungen des Kontos widerrufen."* In `lib/db/sessions.ts` existieren nur `deleteSessionByToken` (Zeile 89) und `deleteExpiredSessions` (Zeile 99) — kein Widerruf über alle Geräte. Ein verlorenes Smartphone behält bis zu 90 Tage Zugriff auf alle Reisedaten, ohne Möglichkeit, das zu unterbinden.
- Nebenbefund, unverändert: `deleteExpiredSessions` wird **außerhalb der Tests nirgends aufgerufen** (bestätigt per Volltextsuche über das ganze Repo). Abgelaufene Sitzungszeilen bleiben unbegrenzt liegen.

Finding 1 verschärft diesen Punkt: ein über HTTP abgegriffenes Token ist wegen der 90 Tage kein kurzer Zwischenfall, sondern ein Quartal Vollzugriff ohne Abschaltmöglichkeit.

**Empfehlung:** Ein Folge-Requirement zu req-016: „Alle Sitzungen dieses Kontos beenden" auf `/konto` (`delete from session where participant_id = $1`, inklusive Wirkung auf die eigene laufende Sitzung), dazu der Aufruf von `deleteExpiredSessions` beim Start oder in einem täglichen Lauf. Die Bindung der Sitzungsdauer an den Reisezeitraum entweder einlasten oder die Abweichung in `delivery/security.md` bewusst festschreiben — der jetzige Schwebezustand ist die schlechteste der drei Möglichkeiten.

### 5. Vier High-Schwachstellen in Abhängigkeiten, unverändert seit vier Wochen (mittel)

Aus `npm audit --omit=dev` erschlossen. Installiert: `next 16.2.12`, `sharp`, `postcss`, `nanoid`.

- `postcss` ≤ 8.5.22 — XSS über unescaptes `</style>` plus drei Path-Traversal-/Arbitrary-File-Read-Advisories über `sourceMappingURL` (GHSA-qx2v-qp2m-jg93, -6g55-p6wh-862q, -fxqj-rqcc-2cmp, -r28c-9q8g-f849)
- `sharp` < 0.35.0 — libvips-CVEs 2026-33327, -33328, -35590, -35591 (GHSA-f88m-g3jw-g9cj)
- `nanoid` < 3.3.18 — Endlosschleife bei Größe 0 (GHSA-2v37-7h3g-55p8)
- `next` 9.3.4-canary.0 – 16.3.0-preview.10 ist über `postcss` und `sharp` mitbetroffen

`npm audit` meldet für alle vier: *„fix available via `npm audit fix`"* — ohne `--force`, ohne Major-Wechsel. Betroffen ist überwiegend der Build-Weg, nicht direkt Nutzereingaben aus dem Internet; der Aufwand ist aber so gering, dass das kein Grund zum Warten ist. Seit dem 29.07. unverändert offen.

**Empfehlung:** `npm audit fix` einspielen, danach `npm test`, `npm run build` und `npx tsc --noEmit` grün ziehen und über den normalen dev-Deploy abnehmen.

### 6. Keine Sicherheits-Header gesetzt (niedrig)

**Live verifiziert (26.08.2026):** Die Antworten von `dev.wegfara.com` enthalten über http wie https weder `Content-Security-Policy` noch `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy` oder `Permissions-Policy`. `next.config.ts` definiert keine `headers()`-Sektion — der Diff seit dem letzten Bericht hat die Datei zwar angefasst, aber nur um `nodemailer` in die Ablaufverfolgung aufzunehmen.

Konkret relevant hier: ohne `frame-ancestors`/`X-Frame-Options` lässt sich die angemeldete Anwendung in einen fremden Rahmen einbetten — die schreibenden Aktionen in `/plan` sind per Klick auslösbar, und `SameSite=lax` schützt davor nicht, weil die Anfragen aus dem eingebetteten, gleichnamigen Ursprung kämen. `Permissions-Policy` ist das passende Werkzeug für eine App, die laut `delivery/stack.md` Kamera und Standort nutzt.

**Empfehlung:** In `next.config.ts` eine `headers()`-Sektion für alle Pfade: `X-Frame-Options: DENY` bzw. CSP mit `frame-ancestors 'none'`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: geolocation=(self), camera=(self)`. Eine vollständige CSP kann später folgen — die vier einfachen Header sind ohne Risiko sofort setzbar.

### 7. `cloudflared:latest` ist nicht festgenagelt (niedrig)

Aus `deploy/docker-compose.yml:69` erschlossen: Während `postgres:17-alpine` und `node:22-alpine` gepinnt sind, zieht der Tunnel-Container `cloudflare/cloudflared:latest`. Jeder Deploy kann damit unbemerkt eine andere Version genau der Komponente hochziehen, die den einzigen Weg von außen in das Heimnetz aufbaut — und ein Rollback wird zum Ratespiel.

**Empfehlung:** Auf eine konkrete Version pinnen (z. B. `cloudflare/cloudflared:2026.8.0`) und beim Dependency-Update mitziehen.

### 8. `robots.txt` der Anwendung wird von Cloudflare überschrieben — jetzt `Allow: /` (niedrig, neu)

**Live verifiziert (26.08.2026).** Im Repo steht `public/robots.txt`:

```
# wegfara ist eine private Anwendung — nicht fuer Suchmaschinen.
User-agent: *
Disallow: /
```

Ausgeliefert wird davon nichts. `https://dev.wegfara.com/robots.txt` antwortet stattdessen mit Cloudflares „Managed content"-Block:

```
# BEGIN Cloudflare Managed content
User-agent: *
Content-Signal: search=yes,ai-train=no,use=reference
Allow: /
```

Am 19.08. war hier noch die Datei der Anwendung zu sehen — in der Zwischenzeit wurde in Cloudflare offenbar eine Managed-robots.txt-Funktion aktiv. Die Aussage hat sich damit von „nichts indexieren" in ihr Gegenteil verkehrt: `Allow: /` mit `search=yes`.

Das Risiko ist begrenzt, weil alles außer Startseite und Anmeldeseite hinter der Anmeldung liegt (live bestätigt) — indexierbar sind also nur zwei Seiten ohne Nutzerdaten. Bemerkenswert ist vor allem das Muster: **Cloudflare überschreibt hier stillschweigend eine Ausgabe der Anwendung.** Dieselbe Klasse von Managed-Funktionen greift auch bei Headern und Weiterleitungen, also genau dort, wo Finding 1 und 6 den Fix erwarten.

**Empfehlung:** In den Cloudflare-Einstellungen der Zone „Managed robots.txt" / Content Signals abschalten, wenn die eigene `Disallow: /`-Aussage gelten soll — oder die Datei im Repo entfernen und die Steuerung bewusst an Cloudflare übergeben. Beides ist vertretbar; der jetzige Zustand ist nur deshalb schlecht, weil das Repo etwas anderes behauptet als ausgeliefert wird. Bei der Gelegenheit die Managed-Funktionen der Zone einmal insgesamt durchsehen.

## Was in Ordnung war

- **Anmeldung greift, live bestätigt:** `/go`, `/plan`, `/konto` → 307 auf `/anmeldung?weiter=…`; `/api/trips`, `/api/poi-search`, `/api/place-search` → 401 `{"error":"nicht angemeldet"}`. `/api/health` ist bewusst offen und gibt nur `{"status":"ok"}` ohne DB-Zugriff preis.
- **Neu geprüft — `/maplibre/*` (bug-013) ist unbedenklich:** Der Pfad wurde seit dem letzten Bericht öffentlich gestellt und aus dem middleware-Matcher genommen. Ausgeliefert werden ausschließlich `maplibre-gl-worker.mjs` und `maplibre-gl-shared.mjs` — unveränderte Kopien der offenen Bibliothek, ohne Nutzerdaten. `/maplibre/../middleware.ts` wird normalisiert und läuft in die Anmelde-Weiterleitung (307), kein Traversal. Der Prefix-Test in `isPublicPath()` ist korrekt geankert (`pathname === prefix || startsWith(prefix + "/")`), ein hypothetisches `/maplibre-admin` würde also nicht mitgefangen.
- **Geheimnisse:** Kein hartkodiertes Secret im Arbeitsbaum (Mustersuche nach `sk-…`, `eyJ…`, `AKIA…`, `BEGIN … PRIVATE KEY` und Zuweisungen an `key|secret|password|token` — kein Treffer), keine `.env`-Datei im Baum, keine im Git-Index, und **keine je in der Git-Historie angelegt** (`git log --all --diff-filter=A`). `DATABASE_URL`, `AUTH_SECRET`, `OPENAI_API_KEY`, `SMTP_*` und `CLOUDFLARE_TUNNEL_TOKEN` stehen nur als `${VAR}`-Referenzen in `deploy/docker-compose.yml`.
- **Umgang mit Geheimnissen im Code:** Sitzungs-Token, Anmeldelink-Token und Notfallcodes liegen nur als SHA-256-Prüfsumme in der DB; vom Passkey wird ausschließlich der öffentliche Schlüssel abgelegt (`lib/db/credentials.ts`), plus Zähler zum Erkennen geklonter Geräte.
- **Anmeldung im Detail:** Rate-Limits auf beiden offenen Endpunkten (5/15 min für Anmeldelinks, 10/15 min für Notfallcodes, `lib/auth/rate-limit.ts` mit Aufräumen abgelaufener Schlüssel); einheitliche Antwort bei bekannter und unbekannter Adresse; Anmeldelink 15 min gültig, WebAuthn-Challenge 5 min.
- **Mandantentrennung auf den Lesepfaden:** `listTrips`, `listPois`, `listSearchAreas` filtern durchgängig nach `account_id`. `updateTrip`/`deleteTrip` prüfen den Besitz über `belongsToAccount()` und liefern `404 unknown trip` statt eines Hinweises auf fremde Daten — das Muster, das Finding 2 fehlt.
- **Erreichbarkeit der Infrastruktur:** PostgreSQL ohne Portfreigabe, nur im Compose-Netz; die App an `127.0.0.1:${APP_PORT}` gebunden; Zugang von außen ausschließlich über den Cloudflare Tunnel. Entspricht `delivery/security.md`.
- **Container:** Mehrstufiger Build, Laufzeit als unprivilegierter Nutzer `nextjs` (UID 1001), Bildverzeichnis als Host-Volume außerhalb des Containers.
- **Deploy:** `deploy-prod.yml` hat unverändert keinen Push- oder Merge-Trigger, nur `workflow_dispatch` mit Bestätigungswort `deploy`.
- **Externe Dienste:** Der KI-Aufruf liegt hinter der austauschbaren Schnittstelle in `lib/ai/`, Modell über `OPENAI_MODEL` übersteuerbar. An OpenAI, Nominatim und Overpass gehen Suchgebiet, Typfilter, Wunschtext und bereits vorhandene POI-Namen — keine Teilnehmerdaten, keine Kennungen. Es gibt weiterhin keine Upload- oder Bild-Auslieferungsroute, also auch keine erratbaren Beleg-URLs.

Der Bericht wird als Datei unter `delivery/security/` abgelegt.
