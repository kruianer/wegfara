---
type: security
repo: Wegfara
commit: 14b12ae
date: 2026-11-04
---

# Security: Wegfara (14b12ae)

Automatisch erstellt vom appbaua-Worker am 2026-11-04.

# Security-Check wegfara — 04.11.2026

**Stand:** `dev` @ `14b12ae` · **SOLL:** `delivery/security.md`, `delivery/devops.md`, `CLAUDE.md` · **Vorläufer:** Bericht vom 28.10.2026 (`cceb893`)

## Kurz-Zusammenfassung

**Das Repo ist öffentlich.** Das ist der wichtigste neue Befund und ändert die Bewertung vieler alter Findings. Ohne Anmeldung sind Code und Migrationen abrufbar, auch alle 14 Sicherheitsberichte mit ihren offenen Lücken. Der Bericht vom 28.10. empfahl noch, *„vor einer Veröffentlichung"* aufzuräumen; das hat die Lage falsch eingeschätzt.

> **Dieser Bericht wird nach dem Ablegen ebenfalls öffentlich.** Ich beschreibe die offenen Lücken deshalb nur so genau, wie es für die Behebung nötig ist, und nenne keine Angriffsschritte. Besser ist, das Repo vor dem nächsten Bericht auf privat zu stellen (Finding 1).

- **Neu, hoch:** Die offenen Lücken stehen öffentlich im Repo (Finding 1).
- **Neu, hoch:** Ein self-hosted Runner auf dem Beelink hängt an einem öffentlichen Repo (Finding 2).
- **Erweitert:** Die Schnittstelle der Reise-Zuordnung prüft keine Rolle. Dadurch laufen auch die Prüfungen ins Leere, die auf der Reisegruppe beruhen (Finding 4).
- **Unverändert offen:** Kontoübernahme über Einladungen, HTTPS nicht erzwungen, 9 verwundbare Abhängigkeiten (2 kritisch), Zugriffsgrenze Account statt Reisegruppe, Backup.
- **Sauber nachgezogen:** Die Mandantentrennung der neuen Routen aus req-098 und req-103 stimmt. Die Prüfung auf Reisegruppe und Rolle fehlt dort aber genauso wie in den alten Routen.

Geprüft habe ich Requirements, Code und Config. Dazu kamen `npm audit`, Abfragen von dev und prod von außen sowie öffentliche Abrufe bei GitHub. Es lag kein SSH-Zugang vor, und am Repo habe ich nichts geändert.

**20 Findings: 7 hoch, 5 mittel, 8 niedrig.**

| # | Finding | Schweregrad | Verifikation | Status |
|---|---|---|---|---|
| 1 | Öffentliches Repo legt offene Lücken und Betreiberdaten offen | hoch | **live** | **neu** (enthält altes Finding 18) |
| 2 | Self-hosted Runner an öffentlichem Repo | hoch | **live** (öffentlich) / Config | **neu** |
| 3 | Einladung ohne Rollenprüfung, Übernahme fremder Konten | hoch | Code | offen seit 07.10. |
| 4 | Rolle „Reiseleiter" in keiner Schnittstelle geprüft, auch nicht bei der Zuordnung selbst | hoch | Code | offen, **erweitert** |
| 5 | HTTPS nicht erzwungen, kein HSTS | hoch | **live** | offen seit 23.09. |
| 6 | 9 verwundbare Abhängigkeiten (2 kritisch) | hoch | `npm audit`, **live** in Teilen | offen, Bewertung präzisiert |
| 7 | Zugriffsgrenze Account statt Reisegruppe | hoch | Code | offen, **erweitert** |
| 8 | Backup: kein täglicher Lauf, kein externes Ziel, kein belegter Restore | mittel | Config | offen seit 23.09. |
| 9 | Keine Sicherheits-Header, `x-powered-by` sichtbar | mittel | **live** | offen |
| 10 | Sitzungsende nach Reisezustand greift nicht in Schnittstellen | mittel | Code | offen |
| 11 | KI-Endpunkte ungedrosselt | mittel | Code | offen, **erweitert** |
| 12 | dev-Code läuft seit bug-071 direkt auf dem Host, neben `prod.env` | mittel | Config | **neu** |
| 13 | Dateiart hochgeladener Dateien ungeprüft | niedrig | Code | **herabgestuft** von mittel |
| 14 | „Ohne Passkey weiter" (req-085) weicht vom SOLL ab | niedrig | Code/Req | offen |
| 15 | Web-Suche und Plan-Werkzeuge im selben Gespräch | niedrig | Code | offen |
| 16 | Standorte werden bei Reiseende nicht gelöscht | niedrig | Code | offen |
| 17 | `AUTH_SECRET` mit Doppelrolle, ohne Mindestlänge | niedrig | Code | offen |
| 18 | Kein `.dockerignore`, Images und Actions nicht gepinnt | niedrig | Config | offen, erweitert |
| 19 | Externe Abrufe ohne Zeitgrenze | niedrig | Code | offen |
| 20 | dev hat Schreibzugriff auf die prod-Backups | niedrig | Config | offen |

---

## Finding 1: Das öffentliche Repo legt offene Lücken und Betreiberdaten offen

**Schweregrad: hoch** · **live verifiziert (heute, Abruf ohne Token)** · *neu*

```
GET api.github.com/repos/kruianer/wegfara → 200, visibility: public, forks: 0
GET raw.githubusercontent.com/.../dev/delivery/security/2026-10-28-security-wegfara-cceb893.md → 200
GET raw.githubusercontent.com/.../main/delivery/security.md → 200
GET raw.githubusercontent.com/.../dev/migrations/0015_auth.sql → 200
```

- **Sicherheitsberichte:** Unter `delivery/security/` liegen 14 Berichte mit Routen, Dateizeilen und vollständigen Angriffsketten zu Lücken, die nicht behoben sind. Der Worker legt jede Woche einen weiteren ab.
- **Betreiberdaten:** Name und E-Mail stehen in `migrations/0002_seed_demo_data.sql:6`, `migrations/0015_auth.sql:82`, `lib/operator.ts:9`, `delivery/devops.md:72` und der Commit-Historie. Das ist das frühere Finding 18. Die Adresse ist die Anmeldekennung des Betreibers.
- **Infrastruktur:** `delivery/devops.md` nennt den SMTP-Host, Ports, Pfade auf dem Beelink und die Namen der fremden Projekte auf derselben Maschine.
- **Kein Widerspruch zum SOLL bei Secrets:** Echte Schlüssel habe ich in der gesamten Git-Historie nicht gefunden (Abschnitt „Geprüft und in Ordnung").

Die Einstiegshürde bleibt, weil für fast alle Rechte-Findings eine gültige Sitzung nötig ist. Wer aber eine hat, bekommt die Anleitung frei Haus.

**Empfehlung:**
1. Das Repo jetzt auf **privat** stellen. Das ist ein Schalter und nimmt gleichzeitig Finding 2 die Schärfe. Falls es öffentlich bleiben soll, die Berichte außerhalb des Repos ablegen, zum Beispiel in einem privaten Repo.
2. Danach davon ausgehen, dass die bisherigen Inhalte bekannt sind. Private Stellung und das Löschen aus der Historie machen sie nicht ungeschehen. Die Findings 3, 4 und 7 deshalb vorziehen.
3. In `delivery/security.md` festhalten, ob das Repo öffentlich sein darf. Bisher schweigt die Vorgabe dazu.

---

## Finding 2: Self-hosted Runner an einem öffentlichen Repo

**Schweregrad: hoch** · **live verifiziert:** Repo öffentlich. **Aus Config erschlossen:** Runner (`runs-on: [self-hosted, wegfara]` in `.github/workflows/deploy-dev.yml`, `deploy-prod.yml`; `delivery/devops.md`). **Nicht prüfbar:** die Freigabe-Einstellung für Fork-PRs · *neu*

GitHub rät von self-hosted Runnern an öffentlichen Repos ab, weil ein Pull Request aus einem Fork eigene Workflows mitbringen kann. Dass die beiden vorhandenen Workflows nur auf `push` und `workflow_dispatch` reagieren, schützt deshalb nicht.

Was auf dem Runner läuft, trifft den Kern des Betriebs:
- Derselbe Benutzer liest `~/wegfara-env/prod.env`, denn `deploy-prod.yml` lädt die Datei.
- Er bedient Docker und damit faktisch die ganze Maschine, auch die fremden Projekte dort.
- Der Runner steht im Heimnetz. `security.md` schließt genau diesen Zugang aus: *„kein eingehender Zugriff auf das Heimnetz"*.

Ob ein Fork-PR ohne Freigabe startet, hängt von einer Repo-Einstellung ab. Die API verweigert dem Worker-Token die Abfrage (403). Hinweise auf Missbrauch gibt es nicht: 0 Forks, 0 Pull Requests.

**Empfehlung:**
1. Das Repo auf privat stellen (Finding 1). Das löst das Problem an der Wurzel.
2. Falls es öffentlich bleibt: unter *Settings → Actions* die Freigabe für **alle** externen Beitragenden verlangen und nur noch die verwendeten Actions zulassen. Den Runner in eine Wegwerf-VM ohne Zugriff auf `~/wegfara-env` legen.

---

## Finding 3: Jede angemeldete Person kann über `POST /api/einladungen` ein fremdes Konto übernehmen

**Schweregrad: hoch** · **aus Code erschlossen.** Live nicht nachgestellt, weil das Daten verändert hätte. · *offen seit dem 07.10.2026*

- `app/api/einladungen/route.ts` prüft nur, ob eine Sitzung besteht, nicht ob der Aufrufer die Zielperson einladen darf.
- `lib/invitations/create-invitation.ts` prüft nur den Account und ob die Person irgendeiner Reise zugeordnet ist.
- Die Oberfläche prüft `darfMitreisendeVerwalten`, die Schnittstelle dahinter nicht.
- Die Rechte der Zielperson gehen mit dem Link über (`redeemAccessLink`, `lib/auth/login.ts`), also auch `accountAdmin` und `superAdmin`.

**Auswirkung:** Ein eingeladenes Familienmitglied kann zum Account-Admin werden, unter Umständen zum Gesamt-Admin. Das verletzt die Vorgabe aus `security.md`, dass Beitritt und Zugang nur über den Organisator laufen.

**Empfehlung:**
- In der Route vor `inviteTripParticipant` prüfen: `session.accountAdmin` **oder** der Aufrufer ist Reiseleiter einer Reise der Zielperson.
- Die Berechtigung als Pflichtparameter in `createInvitation` aufnehmen, damit ein künftiger zweiter Aufrufer sie nicht vergisst.
- Personen mit Account-Admin- oder Gesamt-Admin-Kennzeichnung nur durch mindestens gleichrangige Personen einladen lassen.
- Dazu ein Test, der für eine Person ohne Leiterrolle `403` erwartet.

---

## Finding 4: Die Rolle „Reiseleiter" prüft keine Schnittstelle, auch nicht die Zuordnung selbst

**Schweregrad: hoch** · **aus Code erschlossen** · *offen seit dem 14.10.2026, heute erweitert*

- `darfPlanen` und `darfMitreisendeVerwalten` kommen nur in Seiten vor, in `app/api/**/route.ts` nicht. `forbidden()` steht nur in Admin-Routen.
- **Neu benannt:** `app/api/trip-participants/route.ts` (PUT und DELETE) prüft nur die Sitzung und setzt die Rolle aus der Anfrage. Die Schnittstelle, die Rollen vergibt, ist also selbst ungeschützt. Das untergräbt alles, was an der Zuordnung hängt:
  - die Leiterrolle und den Planer-Zugang (`darfPlanen`),
  - die Sichtbarkeit über `listTripsForSession`,
  - die Sitzungsdauer (`sessionRemainsValid` fragt `leadsAnyTrip` und `isInReleasedTrip`).
- Weiter betroffen: `DELETE /api/trips` (entfernt Bilder und Dokumente unwiederbringlich) sowie die schreibenden Routen von `pois`, `programmpunkte`, `kostenzeilen`, `transfers`, `bewertungsrunden`, `dokumente` und `chat`.
- **Neu seit req-098/req-103:** `reise-titelfoto` (PUT, POST, KI), `tages-ueberschriften` (POST, PUT) und `poi-gegend`.

**Empfehlung:**
- Eine gemeinsame Wache in `lib/auth/api-guard.ts`, zum Beispiel `requirePlanRight(session, tripId)` mit `403`, in jeder schreibenden Planungsroute.
- `trip-participants` zuerst absichern, mit derselben Regel wie `darfMitreisendeVerwalten`.
- Einen Sammeltest in `app/api/api-guard.test.ts`, der neue Routen automatisch erfasst, damit die Lücke nicht mit jeder Route wächst.

---

## Finding 5: HTTPS-Pflicht nicht durchgesetzt

**Schweregrad: hoch** · **live verifiziert (heute)** · *offen seit dem 23.09.2026*

```
GET http://dev.wegfara.com/anmeldung  → 200, kein Location, kein HSTS
GET http://app.wegfara.com/anmeldung  → 200, kein Location, kein HSTS
GET https://dev.wegfara.com/anmeldung → 200, kein Strict-Transport-Security
GET https://app.wegfara.com/anmeldung → 200, kein Strict-Transport-Security
```

`security.md` verlangt: *„Kein unverschluesselter Zugriff."* Über HTTP setzt die App Cookies ohne `Secure` (`connectionIsSecure`, `middleware.ts`). Ein bis zu 90 Tage gültiges Sitzungs-Cookie kann so im Klartext laufen.

**Empfehlung:**
1. In Cloudflare je Zone „Always Use HTTPS" einschalten.
2. HSTS (`max-age=31536000; includeSubDomains`) über `headers()` in `next.config.ts` setzen.
3. Als Rückfallebene in `middleware.ts` bei `x-forwarded-proto: http` auf `https` umleiten (308).

---

## Finding 6: Neun bekannte Schwachstellen in Abhängigkeiten, zwei kritisch

**Schweregrad: hoch** · **verifiziert per `npm audit`** (9 auch ohne Dev-Abhängigkeiten) · *offen seit dem 23.09.2026*

Für prod gilt derselbe Stand: Der letzte erfolgreiche prod-Deploy (29.10., `da88e71`) hat im Lockfile `next` 16.2.12. `package.json` und Lockfile haben sich seit dem letzten Lauf nicht geändert.

| Paket | installiert | Schwere | aktuell | Relevanz |
|---|---|---|---|---|
| `next` | 16.2.12 | **kritisch** | 16.4.5 | siehe unten |
| `maplibre-gl` | 6.0.0 | **kritisch** | 6.16.0 | XSS-Sanitizer-Bypass (`GHSA-jrc7-96c5-q579`), betrifft ≤ 6.4.0 |
| `nodemailer` | 9.0.5 | hoch | 10.3.1 | 14 Advisories, betroffen sind Anmelde- und Einladungsmails |
| `zod` (über `openai` 5.23.2) | 3.25.76 | hoch | — | Fix verlangt `openai` 7.x (Breaking Change) |
| `sharp` (transitiv über `next`) | 0.34.5 | hoch | 0.35.5 | Lücken in libvips, libheif, librsvg |
| `postcss`, `source-map-js`, `nanoid` | — | hoch | — | überwiegend Bauzeit |

**Präzisierung zu `next`:** Der Bericht vom 28.10. hat die Lage hier teils zu scharf dargestellt. Die kritischen Advisories treffen die App unterschiedlich:

| Advisory | Lage in wegfara |
|---|---|
| RCE auf Windows-Servern | trifft nicht zu, es läuft Alpine |
| RCE in `use cache`, DoS über Server Actions | im Code gibt es weder `use cache` noch `"use server"` |
| RCE in `next/og` | `app/icon/[groesse]/route.tsx` ist öffentlich, verarbeitet aber nur eine geprüfte Größe und feste Inhalte. Fremde Eingaben kommen nicht hinein. |
| RCE und SSRF in Image Optimization | **bleibt offen.** `/_next/image` antwortet auf dev und prod ohne Sitzung (**live**: `400 The requested resource isn't a valid image`), weil der `matcher` in `middleware.ts` den Pfad ausnimmt. Die App benutzt `next/image` gar nicht. Ohne `remotePatterns` fehlen Fremdquellen, das senkt das Risiko, beseitigt es aber nicht. |

Ein Angriff über diese Wege ist nicht belegt. Der Schweregrad bleibt trotzdem hoch, weil ein ungeschützter Endpunkt in einer bekannt verwundbaren Version offen im Netz steht und der Fix wenig kostet.

**Empfehlung:**
- `next` auf ≥ 16.4.5 anheben (Grenze laut Audit: > 16.4.0).
- `maplibre-gl` auf 6.16.0 anheben, die Kopie unter `/maplibre` mitziehen.
- `nodemailer` auf 10.3.1 anheben, `npm audit fix` für die transitiven Pakete laufen lassen, danach volle Suite und E2E.
- Prüfen, ob `openai` auf 7.x gehoben werden kann. Das Paket wird noch gebraucht, unter anderem für Titelbild und Überschriften.
- Da `next/image` ungenutzt ist, die Optimierung abschalten (`images: { unoptimized: true }`).
- `npm audit --omit=dev --audit-level=high` als Gate in `deploy-prod.yml` aufnehmen und die laut API abgeschalteten Dependabot-Alerts aktivieren.

---

## Finding 7: Zugriffsgrenze der Schnittstellen ist der Account, nicht die Reisegruppe

**Schweregrad: hoch** · **aus Code erschlossen** · *offen seit dem 23.09.2026, durch req-103 erweitert*

`security.md`: *„Teilnehmer sehen nur Daten der Reisen, zu denen sie gehoeren."* Außerdem: Belege und Tickets *„nur fuer Mitglieder der zugehoerigen Gruppe"*.

- `app/api/chat/route.ts` (GET, POST, DELETE) prüft nur `tripBelongsToAccount`. Damit erreicht auch der Plan-Leser des Chats fremde Reisen, einschließlich POIs, Tagesplan und Kosten.
- `findDocumentFile` (`lib/db/documents.ts`) filtert nur nach Account. Das verletzt die Beleg-Vorgabe direkt.
- `app/api/bankverbindung/route.ts` gibt die IBAN jeder Person des Accounts heraus. Das SOLL verlangt das nicht; die Routine ist für den Ausgleich innerhalb einer Reise gedacht.
- **Neu seit req-103:** `GET /api/reise-titelfoto/[tripId]` und `POST /api/tages-ueberschriften` nutzen `findTrip` bzw. Account-Filter.
- Positiv: `positionen`, `live-status`, `position-teilen` nutzen `listTripsForSession`. Die Druckseite `app/plan/reiseplan/[tripId]/page.tsx` prüft Sichtbarkeit und `darfPlanen`, die neue Seite ist also korrekt.

**Empfehlung:**
- `tripAccessibleToSession(db, session, tripId)` analog zu `listTripsForSession` einführen und `actingAccount` berücksichtigen.
- Chat, Plan-Leser, Dokumente, Titelfoto, Überschriften, Programmpunkte, KI-Planung und POI-Suche darauf umstellen.
- Die IBAN nur für Personen einer gemeinsamen Reise herausgeben.

---

## Finding 8: Backup-Erwartung nicht erfüllt

**Schweregrad: mittel** · **aus Config erschlossen** (ohne SSH nicht prüfbar) · *offen seit dem 23.09.2026*

| Vorgabe | Ist |
|---|---|
| täglich, automatisch | `instrumentation.ts` startet nur `startDocumentAudit()`. Kein `schedule` in `.github/workflows/`. Gesichert wird vor dem prod-Deploy und von Hand. |
| zweites Ziel außerhalb des Beelink | Nur `~/wegfara-backups`. Kein rclone, S3 oder NAS im Repo. Laut Vorgabe gilt das Backup damit *„als nicht vorhanden"*. |
| Wiederherstellung getestet | Es gibt Restore-Route und Tests, einen realen Rückspiel-Lauf konnte ich nicht nachweisen. |

**Empfehlung:**
- `startDailyBackup()` in `instrumentation.ts` neben dem Dokument-Audit einhängen.
- Eine verschlüsselte Offsite-Kopie einrichten, das Ziel als Umgebungsvariable in `~/wegfara-env/prod.env`.
- Einmal ein prod-Backup auf dev einspielen und das Datum dokumentieren.

---

## Finding 9: Keine Sicherheits-Header

**Schweregrad: mittel** · **live verifiziert (heute)**

dev und prod liefern weder `Content-Security-Policy` noch `Strict-Transport-Security`, `X-Content-Type-Options`, `X-Frame-Options` oder `Referrer-Policy`. Dafür steht `x-powered-by: Next.js` in den Antworten.

**Empfehlung:**
- `headers()` in `next.config.ts` mit HSTS, `nosniff`, `X-Frame-Options: DENY` und `Referrer-Policy: strict-origin-when-cross-origin`, dazu `poweredByHeader: false`.
- Die CSP zuerst als `Report-Only` auf dev einführen.

---

## Finding 10: Sitzungsende nach Reisezustand greift nur auf Seiten

**Schweregrad: mittel** · **aus Code erschlossen**

`sessionRemainsValid` wird nur in `lib/auth/current-session.ts` beim Seitenzugriff (`requireTripAccess`) ausgewertet. Schnittstellen nutzen `currentSession()` ohne diese Prüfung. Wer nach Reiseende aus der Oberfläche fällt, behält für die Schnittstellen ein gültiges Cookie, bis die 90 Tage ablaufen.

**Empfehlung:** Eine gemeinsame Wache, die auf Seiten mit `redirect` und in Schnittstellen mit `401` reagiert. Zusammen mit Finding 4 umsetzen.

---

## Finding 11: KI-Endpunkte ungedrosselt

**Schweregrad: mittel** · **aus Code erschlossen** · *durch req-103 erweitert*

- `createRateLimiter` wird nur in `app/api/auth/anmeldelink` benutzt.
- Je Chat-Frage gilt `MAX_TOKENS = 16000`, bis zu 3 bezahlte Web-Suchen (`WEB_SUCHE_MAX_USES`) und bis zu 6 Werkzeug-Runden (`PLAN_WERKZEUG_MAX_AUFRUFE`).
- **Neu:** `POST /api/reise-titelfoto/ki` erzeugt je Aufruf ein bezahltes Bild, `POST /api/tages-ueberschriften` löst je Aufruf eine bezahlte Abfrage aus. Der Hinweis „nur auf Knopfdruck" gilt nur für die Oberfläche.
- Abgerechnet wird über den Schlüssel des Accounts. Jede angemeldete Person kann die Rechnung hochtreiben.

**Empfehlung:**
- Rate-Limit je Person und Tag auf `chat`, `ki-planung`, `poi-beschreibung`, `poi-ki-bild`, `poi-vervollstaendigen`, `place-search`, `reise-titelfoto/ki` und `tages-ueberschriften`.
- Den Chat-Kontext auf die letzten *n* Nachrichten begrenzen.

---

## Finding 12: dev-Code läuft seit bug-071 direkt auf dem Host, neben `prod.env`

**Schweregrad: mittel** · **aus Config erschlossen** · *neu*

`deploy-dev.yml` führt seit bug-071 bei jedem Push `npm ci`, `npm test` und `npm run test:e2e` direkt auf dem Runner aus, nicht mehr nur `docker compose` wie zuvor.

Das hat zwei Folgen:
- Jedes Install-Skript eines npm-Pakets und jeder Test läuft unter dem Benutzer, der `~/wegfara-env/prod.env` lesen kann (siehe Finding 2). Darin liegen `AUTH_SECRET`, DB-Zugang, SMTP-Zugang und Tunnel-Token.
- Das geschieht bei jedem autonomen Push. `devops.md` schließt aber für den autonomen Worker jeden Zugriff auf prod aus. Die Grenze besteht damit nur als Regel, nicht technisch.

Beide Risiken sind real, aber bedingt: Sie setzen ein kompromittiertes Paket oder fehlerhaften Worker-Code voraus. Das Ziel von bug-071, Tests vor dem dev-Deploy, ist sinnvoll und soll bleiben.

**Empfehlung:**
- Die Tests im Container oder unter einem eigenen Benutzer ohne Lesezugriff auf `~/wegfara-env/prod.env` laufen lassen.
- Die prod-Werte als GitHub Environment Secret mit Freigabepflicht führen, damit sie nicht dauerhaft neben dem Runner liegen.
- `npm ci --ignore-scripts` prüfen, soweit der Build das zulässt.

---

## Finding 13: Dateiart hochgeladener Dateien wird nicht am Inhalt geprüft

**Schweregrad: niedrig** · **aus Code erschlossen** · *von mittel herabgestuft*

Es gibt weiter keine Magic-Byte-Prüfung (`lib/documents/validate.ts`, `lib/pois/photo-upload.ts`, auch im neuen Titelfoto-Upload). `app/api/dokumente/[id]/route.ts` liefert `inline` aus, ohne `nosniff`.

Die Herabstufung begründet sich so: Die Art läuft durch eine feste Liste aus Bildern und PDF, und `text/html` oder SVG sind nicht möglich. Eine als Bild getarnte HTML-Datei führen Browser deshalb nicht aus. Die Dateinamen vergibt der Server, ein Pfadausbruch scheidet aus.

**Empfehlung:** Die ersten Bytes gegen die behauptete Art prüfen und `nosniff` setzen (kommt mit Finding 9).

---

## Finding 14: „Ohne Passkey weiter" (req-085) weicht vom Wortlaut der security.md ab

**Schweregrad: niedrig** · **aus Requirement und Code erschlossen**

`security.md` sagt: *„Beim Einloesen richtet der Teilnehmer einen neuen Passkey ein."* Tatsächlich ist der Passkey freiwillig (`app/einladung/passkey/einladung-passkey-view.tsx`). Die Eigenschaften des Links bleiben gewahrt: sieben Tage gültig, einmalig, an eine Person gebunden.

**Empfehlung:** `security.md` an die Entscheidung aus req-085 anpassen. Falls das nicht gewollt ist, den Passkey für Account-Admin und Reiseleiter weiter verlangen.

---

## Finding 15: Web-Suche und Plan-Werkzeuge laufen im selben Gespräch

**Schweregrad: niedrig** · **aus Code erschlossen** (Einschätzung vom 28.10. übernommen, diesmal nur die Grenzwerte gegengeprüft)

Das Modell kann Reisedaten lesen und im selben Zug im Web suchen. Über eine gelesene Webseite könnte es per Prompt-Injection dazu gebracht werden, solche Daten in Suchanfragen zu schreiben. Das Risiko ist gering, weil personenbezogene Felder im Plan-Leser fehlen.

**Empfehlung:** Im System-Prompt festhalten, dass Werkzeug-Ergebnisse nicht in Suchanfragen gehören. Optional die Web-Suche abschalten, sobald ein Plan-Werkzeug aufgerufen wurde.

---

## Finding 16: Standorte werden bei Reiseende nicht gelöscht

**Schweregrad: niedrig** · **aus Code erschlossen** · *offen seit dem 23.09.2026*

`deleteTripPosition` wird nur beim Abschalten der Freigabe aufgerufen (`lib/db/position-sharing.ts:55`). `security.md` verlangt die Löschung nach Reiseende.

**Empfehlung:** Täglicher Lauf in `instrumentation.ts`, der Positionen vergangener Reisen entfernt.

---

## Finding 17: `AUTH_SECRET` mit Doppelrolle, ohne geprüfte Mindestlänge

**Schweregrad: niedrig** · **aus Code erschlossen**

Das Secret ist Quelle des AES-Schlüssels (`lib/secrets/encryption.ts`) und wird als Deploy-Token im Klartext im Header gesendet (`lib/backup/deploy-token.ts`). `envGeheimnis` prüft nur, ob es leer ist. Weil `POST /api/backups` aus dem Internet erreichbar ist, wiegt ein schwacher Wert hier schwerer.

**Empfehlung:** Mindestlänge (32 Zeichen) beim Start prüfen und das Deploy-Token zweckgebunden ableiten.

---

## Finding 18: Kein `.dockerignore`, Images und Actions nicht gepinnt

**Schweregrad: niedrig** · **aus Config erschlossen**

- Der Build-Kontext umfasst das ganze Repo inklusive `.git`, ein `.dockerignore` fehlt.
- `deploy/docker-compose.yml:110` nutzt `cloudflare/cloudflared:latest`.
- Neu benannt: Die Actions (`actions/checkout@v4`, `actions/setup-node@v4`) hängen an Tags und laufen auf dem self-hosted Runner.

**Empfehlung:** `.dockerignore` anlegen, Images per Digest und Actions per Commit-SHA pinnen.

---

## Finding 19: Externe Abrufe ohne Zeitgrenze

**Schweregrad: niedrig** · **aus Code erschlossen**

Ohne Zeitgrenze laufen Google Places (`lib/google/places-client.ts`, teils mit `redirect: "follow"`), OSM-Suche und Ortsabfrage (`lib/osm/place-search.ts`, `ort-lookup.ts`) sowie die Wechselkurse (`lib/expenses/exchange-rate.ts`).

**Empfehlung:** `AbortSignal.timeout(...)` an allen verbleibenden `fetch`-Aufrufen.

---

## Finding 20: dev hat Schreibzugriff auf die prod-Backups

**Schweregrad: niedrig** · **aus Config erschlossen**

`${HOME}/wegfara-backups:/data/backups` (`deploy/docker-compose.yml:92`) wird in beide Container ohne `:ro` eingehängt. dev wird bei jedem Push autonom ausgerollt, obwohl der autonome Worker prod laut `devops.md` nie anfassen darf.

**Empfehlung:** Für dev nur lesend einhängen. dev sichert in ein eigenes Verzeichnis.

---

## Geprüft und in Ordnung

- **Secrets:** Die Mustersuche über die gesamte Git-Historie aller Branches (API-Keys, GitHub-Tokens, private Schlüssel, Tunnel-Token, `AUTH_SECRET`, `SMTP_PASSWORD`, DB-URLs mit Passwort) fand nur Platzhalter und die E2E-Wegwerfzugänge. Keine `.env`-, `.pem`- oder `.key`-Datei ist eingecheckt. Die IBANs im Repo sind erfundene Testwerte aus req-019.
- **Sitzungspflicht, live auf dev und prod:** `trips`, `chat`, `positionen`, `backups`, `dokumente`, `einladungen`, `reise-titelfoto` und `tages-ueberschriften` antworten ohne Cookie mit `401`. `/api/health` ist offen, wie vorgesehen. `/.env` und `/.git/config` führen nur zur Anmeldung.
- **Neue Routen seit dem 28.10.:** Alle filtern nach `session.accountId`, die Mandantentrennung stimmt. Das Foto einer anderen Reise lässt sich nicht als Titelfoto wählen (`waehlePoiTitelfoto`). Der Dateiname entsteht aus einer Zufallskennung.
- **Tokens:** 256 Bit Zufall, in der Datenbank nur als SHA-256. Anmelde- und Zugangslinks werden per atomarem `update ... where used_at is null` entwertet.
- **Backup-Schnittstellen:** Der Deploy-Token wird zeitkonstant verglichen. Upload, Download und Restore bleiben dem Gesamt-Admin vorbehalten. Der Import weist Pfade mit `..` ab.
- **Open Redirect:** `safeRedirectTarget` lässt nur interne Pfade zu.
- **XSS:** `dangerouslySetInnerHTML` gibt es nur für das eigene Stylesheet (`components/stil-blatt.tsx`).
- **Erreichbarkeit laut Config:** Die App ist an `127.0.0.1` gebunden, PostgreSQL hat keine Portfreigabe, der Zugang läuft über den Tunnel.
- **prod-Workflow:** nur `workflow_dispatch` mit Bestätigungswort, Tests und E2E vor Backup und Deploy.

## Grenzen dieser Prüfung

- **Kein SSH-Zugang** (`~/.ssh` fehlt, auf prod wäre er dem autonomen Worker ohnehin nicht erlaubt): Backups auf dem Host, Rechte der env-Dateien, Stärke von `AUTH_SECRET`, Tunnel und Cloudflare-Einstellungen sind nicht geprüft.
- **GitHub-Einstellungen:** Branch-Schutz, Actions-Rechte, Fork-Freigabe, Runner-Liste und Secret Scanning lieferten mit dem Worker-Token `403`.
- **prod nur von außen:** Abfragen wie die eines anonymen Besuchers, nur GET, nichts angefasst.
- **Keine Sitzung:** Die Findings 3, 4, 7, 10 und 11 sind aus dem Code erschlossen und nicht live nachgestellt, weil das Daten verändert hätte.
- **Repo unverändert:** nur gelesen, `npm audit` ausgeführt, kein Commit. Hilfsskripte lagen außerhalb des Repos und sind wieder entfernt.
