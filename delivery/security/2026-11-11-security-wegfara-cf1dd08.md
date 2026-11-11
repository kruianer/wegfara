---
type: security
repo: Wegfara
commit: cf1dd08
date: 2026-11-11
---

# Security: Wegfara (cf1dd08)

Automatisch erstellt vom appbaua-Worker am 2026-11-11.

# Security-Check wegfara: 11.11.2026

**Stand:** `dev` @ `cf1dd08` · **SOLL:** `delivery/security.md`, `delivery/devops.md`, `CLAUDE.md` · **Vorläufer:** Bericht vom 04.11.2026 (`14b12ae`)

## Kurz-Zusammenfassung

**Seit dem letzten Bericht hat sich weder am Code noch an der Konfiguration etwas geändert.** Hinzugekommen sind nur drei Commits, und die betreffen nur `delivery/`: einen Security-Bericht, eine Idee und ein Code-Review. Auf `main`/prod läuft weiterhin `da88e71` vom 29.10. Deshalb sind **alle 20 Findings vom 04.11. weiter offen.** Wo es von außen ging, habe ich sie heute live nachgeprüft. Es gibt kein neues Finding und keines ist erledigt.

> **Dieser Bericht wird nach dem Ablegen öffentlich, wie die 15 vorherigen.** Das Repo ist weiter öffentlich (heute live geprüft). Deshalb nenne ich die Lücken nur so genau, wie es für die Behebung nötig ist. Eine weitere Woche ist vergangen, ohne dass die Lücken behoben oder die Berichte aus der Öffentlichkeit genommen wurden. Wer mitliest, findet für die Findings 3, 4 und 7 inzwischen eine Beschreibung, die seit Wochen stimmt.

**Was am dringendsten ist** (das wiederhole ich bewusst):
1. **Das Repo auf privat stellen.** Ein einziger Schalter nimmt den Findings 1 und 2 die Schärfe.
2. **Die Findings 3, 4 und 7 beheben:** Rechteprüfung in den Schnittstellen. Das ist für das SOLL „Teilnehmer sehen nur ihre Reisen“ und für die Kontoübernahme entscheidend.
3. **HTTPS erzwingen** (Finding 5): ein Cloudflare-Schalter plus HSTS.
4. **`next`, `maplibre-gl` und `nodemailer` anheben** (Finding 6).

Geprüft habe ich so: Code und Config über den Diff seit `14b12ae`, `npm audit`, GET-Abfragen an dev und prod von außen, die GitHub-API mit und ohne Token. Es gab keinen SSH-Zugang, und am Repo habe ich nichts geändert.

**20 Findings: 7 hoch, 5 mittel, 8 niedrig.**

| # | Finding | Schweregrad | Verifikation heute | Status |
|---|---|---|---|---|
| 1 | Öffentliches Repo legt offene Lücken und Betreiberdaten offen | hoch | **live** | offen seit 04.11. |
| 2 | Self-hosted Runner an öffentlichem Repo | hoch | **live** (Repo öffentlich, Runs laufen) / Config | offen seit 04.11. |
| 3 | Einladung ohne Rollenprüfung, Übernahme fremder Konten möglich | hoch | Code (unverändert) | offen seit 07.10. |
| 4 | Rolle „Reiseleiter“ wird in keiner Schnittstelle geprüft, auch nicht bei der Zuordnung | hoch | Code (unverändert) | offen seit 14.10. |
| 5 | HTTPS nicht erzwungen, kein HSTS | hoch | **live** | offen seit 23.09. |
| 6 | 9 verwundbare Abhängigkeiten (2 kritisch) | hoch | `npm audit`, `/_next/image` **live** | offen seit 23.09. |
| 7 | Zugriffsgrenze ist der Account, nicht die Reisegruppe | hoch | Code (unverändert) | offen seit 23.09. |
| 8 | Backup: kein täglicher Lauf, kein externes Ziel, kein belegter Restore | mittel | Config | offen seit 23.09. |
| 9 | Keine Sicherheits-Header, `x-powered-by` sichtbar | mittel | **live** | offen |
| 10 | Sitzungsende nach Reisezustand greift nicht in Schnittstellen | mittel | Code | offen |
| 11 | KI-Endpunkte ohne Drosselung | mittel | Code | offen |
| 12 | dev-Tests laufen direkt auf dem Host, neben `prod.env` | mittel | Config, Runs **live** | offen seit 04.11. |
| 13 | Dateiart hochgeladener Dateien wird nicht am Inhalt geprüft | niedrig | Code | offen |
| 14 | „Ohne Passkey weiter“ (req-085) weicht vom SOLL ab | niedrig | Code/Req | offen |
| 15 | Web-Suche und Plan-Werkzeuge im selben Gespräch | niedrig | Code | offen |
| 16 | Standorte werden bei Reiseende nicht gelöscht | niedrig | Code | offen |
| 17 | `AUTH_SECRET` hat eine Doppelrolle und keine Mindestlänge | niedrig | Code | offen |
| 18 | Kein `.dockerignore`, Images und Actions nicht gepinnt | niedrig | Config | offen |
| 19 | Externe Abrufe ohne Zeitgrenze | niedrig | Code | offen |
| 20 | dev hat Schreibzugriff auf die prod-Backups | niedrig | Config | offen |

---

## Finding 1: Das öffentliche Repo legt offene Lücken und Betreiberdaten offen

**Schweregrad: hoch** · **heute live verifiziert, Abruf ohne Token**

```
GET api.github.com/repos/kruianer/wegfara → 200, visibility: public, forks: 0
GET raw.githubusercontent.com/.../dev/delivery/security/2026-11-04-security-wegfara-14b12ae.md → 200
```

- Unter `delivery/security/` liegen jetzt 15 Berichte, mit diesem 16. Sie beschreiben ungelöste Lücken samt Routen und Dateien.
- Name und E-Mail des Betreibers stehen in den Migrationen `0002` und `0015`, in `lib/operator.ts`, in `delivery/devops.md` und in der Commit-Historie. Die E-Mail ist zugleich seine Anmeldekennung.
- `delivery/devops.md` nennt den SMTP-Host, Pfade auf dem Beelink und die Nachbarprojekte auf derselben Maschine.
- Echte Secrets sind nicht im Repo (siehe „Geprüft und in Ordnung“).

**Empfehlung:**
1. Das Repo auf **privat** stellen. Soll es öffentlich bleiben, die Berichte in einem privaten Repo ablegen.
2. Davon ausgehen, dass die bisherigen Inhalte bekannt sind, und die Findings 3, 4 und 7 vorziehen.
3. In `delivery/security.md` festhalten, ob das Repo öffentlich sein darf.
4. **Worker-Prozess:** Solange das Repo öffentlich ist, sollte der Security-Task seine Berichte nicht mehr ins Repo schreiben. Das ist eine Frage an den Betreiber bzw. an appbaua, keine Code-Änderung hier.

---

## Finding 2: Self-hosted Runner an einem öffentlichen Repo

**Schweregrad: hoch** · **live verifiziert:** Repo öffentlich, „Deploy dev“ läuft weiter bei jedem Push auf dem Runner (zuletzt 10.11., `cf1dd08`). **Aus Config erschlossen:** `runs-on: [self-hosted, wegfara]`. **Nicht prüfbar:** die Freigabe für Fork-PRs (API: 403).

Der Runner läuft im Heimnetz unter einem Benutzer, der Docker bedient und `~/wegfara-env/prod.env` liest. GitHub rät von self-hosted Runnern an öffentlichen Repos ab. Hinweise auf Missbrauch gibt es weiterhin nicht: 0 Forks, 0 Pull Requests.

**Empfehlung:** Das Repo auf privat stellen. Falls es öffentlich bleibt: für alle externen Beitragenden eine Freigabe verlangen, nur die verwendeten Actions zulassen, den Runner isolieren (VM ohne `~/wegfara-env`).

---

## Finding 3: Über `POST /api/einladungen` lässt sich ein fremdes Konto übernehmen

**Schweregrad: hoch** · **aus Code erschlossen** (`app/api/einladungen/route.ts`, `lib/invitations/create-invitation.ts`, seit `14b12ae` unverändert). Live nicht nachgestellt, weil das Daten verändert hätte.

Die Schnittstelle prüft nur, ob eine Sitzung besteht, nicht ob der Aufrufer die Zielperson einladen darf. Die Rechte der Zielperson gehen mit dem Link über. Das widerspricht der Vorgabe, dass Zugang nur über den Organisator vergeben wird.

**Empfehlung:**
- Vor `inviteTripParticipant` `session.accountAdmin` **oder** die Leiterrolle für eine Reise der Zielperson verlangen.
- Die Berechtigung zum Pflichtparameter von `createInvitation` machen.
- Admin-Personen nur von mindestens Gleichrangigen einladen lassen.
- Einen Test ergänzen: `403` ohne Leiterrolle.

---

## Finding 4: Die Rolle „Reiseleiter“ wird in keiner Schnittstelle geprüft

**Schweregrad: hoch** · **aus Code erschlossen** (unverändert)

- `darfPlanen` und `darfMitreisendeVerwalten` stehen nur in Seiten.
- `app/api/trip-participants/route.ts` (PUT/DELETE) übernimmt die Rolle aus der Anfrage. Daran hängen die Sichtbarkeit, die Planer-Rechte und die Sitzungsdauer.
- Ebenso betroffen sind die schreibenden Routen für Reisen (inklusive DELETE), POIs, Programmpunkte, Kosten, Transfers, Bewertungsrunden, Dokumente, Chat, Titelfoto und Tagesüberschriften.

**Empfehlung:** Eine gemeinsame Wache `requirePlanRight(session, tripId)` → `403` in `lib/auth/api-guard.ts`. `trip-participants` zuerst absichern. Dazu ein Sammeltest über alle `app/api/**/route.ts`, damit neue Routen automatisch erfasst werden.

---

## Finding 5: HTTPS-Pflicht nicht durchgesetzt

**Schweregrad: hoch** · **heute live verifiziert**

```
GET http://dev.wegfara.com/anmeldung  → 200, kein Location, kein HSTS
GET http://app.wegfara.com/anmeldung  → 200, kein Location, kein HSTS
GET https://…/anmeldung (dev, prod)   → 200, kein Strict-Transport-Security
```

`security.md` verlangt: *„Kein unverschluesselter Zugriff.“* Über HTTP setzt die App Cookies ohne `Secure`, und die Sitzung gilt bis zu 90 Tage.

**Empfehlung:** In Cloudflare „Always Use HTTPS“ für beide Hosts einschalten. HSTS über `headers()` in `next.config.ts` setzen. Als Rückfallebene leitet `middleware.ts` bei `x-forwarded-proto: http` mit 308 um.

---

## Finding 6: Neun bekannte Schwachstellen in Abhängigkeiten, zwei kritisch

**Schweregrad: hoch** · **heute per `npm audit` verifiziert** (2 kritisch, 7 hoch; auch mit `--omit=dev` 9). `package.json` und Lockfile sind unverändert, prod läuft mit demselben Stand.

| Paket | Schwere | Advisories | aktuelle Version |
|---|---|---|---|
| `next` 16.2.12 | **kritisch** | 11 | 16.4.6 |
| `maplibre-gl` 6.0.0 | **kritisch** | 1 | 6.17.0 |
| `nodemailer` 9.0.5 | hoch | 14 | 10.5.0 |
| `zod` über `openai` 5.23.2 | hoch | 1 | `openai` 7.55.0 |
| `sharp` (transitiv) | hoch | 3 | — |
| `postcss`, `source-map-js`, `nanoid` | hoch | — | überwiegend Bauzeit |

Die Einordnung vom 04.11. gilt weiter. Am stärksten zählt `/_next/image`: Der Endpunkt ist auf prod ohne Sitzung erreichbar (**live:** `400`), obwohl die App `next/image` nicht nutzt.

**Empfehlung:**
- `next` ≥ 16.4.5, `maplibre-gl` 6.17 (die Kopie unter `/maplibre` mitziehen) und `nodemailer` 10.x anheben, danach `npm audit fix`.
- Prüfen, ob `openai` auf 7.x gehen kann.
- `images: { unoptimized: true }` setzen.
- `npm audit --omit=dev --audit-level=high` als Gate in `deploy-prod.yml` aufnehmen und Dependabot-Alerts aktivieren.

---

## Finding 7: Die Zugriffsgrenze der Schnittstellen ist der Account, nicht die Reisegruppe

**Schweregrad: hoch** · **aus Code erschlossen** (unverändert)

- Chat und Plan-Leser (`tripBelongsToAccount`), Dokumente (`findDocumentFile`), Titelfoto und Tagesüberschriften filtern nur nach Account.
- `api/bankverbindung` gibt die IBAN jeder Person des Accounts heraus.
- Das widerspricht zwei Vorgaben: *„Teilnehmer sehen nur Daten der Reisen, zu denen sie gehoeren“* und Belege *„nur fuer Mitglieder der zugehoerigen Gruppe“*.
- Korrekt sind dagegen `positionen`, `live-status`, `position-teilen` und die Druckseite.

**Empfehlung:** `tripAccessibleToSession(db, session, tripId)` nach dem Vorbild von `listTripsForSession` einführen, mit `actingAccount`, und die genannten Routen darauf umstellen. Die IBAN nur innerhalb einer gemeinsamen Reise herausgeben.

---

## Finding 8: Die Backup-Erwartung ist nicht erfüllt

**Schweregrad: mittel** · **aus Config erschlossen** (ohne SSH nicht prüfbar)

| Vorgabe | Ist |
|---|---|
| täglich, automatisch | `instrumentation.ts` startet nur den Dokument-Audit, kein Workflow hat einen `schedule`. Gesichert wird nur vor dem prod-Deploy (zuletzt 29.10.) und von Hand. |
| Ziel außerhalb des Beelink | nur `~/wegfara-backups`, gilt laut Vorgabe *„als nicht vorhanden“* |
| Restore getestet | Route und Tests vorhanden, ein realer Rückspiel-Lauf ist nicht dokumentiert |

**Empfehlung:**
- `startDailyBackup()` in `instrumentation.ts` einhängen.
- Eine verschlüsselte Offsite-Kopie einrichten, das Ziel als Umgebungsvariable.
- Einmal ein prod-Backup auf dev einspielen und das Datum festhalten.

---

## Finding 9: Keine Sicherheits-Header

**Schweregrad: mittel** · **heute live verifiziert**

dev und prod liefern weder CSP noch HSTS, `X-Content-Type-Options`, `X-Frame-Options` oder `Referrer-Policy`. Dafür senden sie `x-powered-by: Next.js`.

**Empfehlung:** `headers()` in `next.config.ts` (HSTS, `nosniff`, `DENY`, `strict-origin-when-cross-origin`) und `poweredByHeader: false` setzen. Die CSP zuerst als `Report-Only` auf dev einführen.

---

## Finding 10: Das Sitzungsende nach Reisezustand greift nur auf Seiten

**Schweregrad: mittel** · **aus Code erschlossen**

`sessionRemainsValid` wird nur in `requireTripAccess` ausgewertet. Die Schnittstellen nutzen `currentSession()` ohne diese Prüfung. So bleibt eine Sitzung, die laut SOLL beendet sein müsste, für die API bis zu 90 Tage gültig.

**Empfehlung:** Eine gemeinsame Wache, die auf Seiten umleitet und in der API mit `401` antwortet. Zusammen mit Finding 4 umsetzen.

---

## Finding 11: KI-Endpunkte ohne Drosselung

**Schweregrad: mittel** · **aus Code erschlossen**

Ein Rate-Limit gibt es nur für `auth/anmeldelink`. Ungedrosselt sind Chat (bis 16 000 Tokens, 3 Web-Suchen, 6 Werkzeug-Runden je Frage), KI-Planung, POI-KI, Titelbild-KI und Tagesüberschriften. Jede angemeldete Person kann so die Kosten des Accounts hochtreiben.

**Empfehlung:** Ein Rate-Limit je Person und Tag auf allen KI-Routen und einen begrenzten Chat-Kontext.

---

## Finding 12: dev-Tests laufen direkt auf dem Host, neben `prod.env`

**Schweregrad: mittel** · **aus Config erschlossen**. **Live:** dev-Deploys laufen weiter bei jedem autonomen Push.

`deploy-dev.yml` führt `npm ci`, `npm test` und E2E direkt auf dem Runner aus, unter dem Benutzer, der `prod.env` liest. Die Grenze „der autonome Worker fasst prod nicht an“ besteht damit nur als Regel, nicht technisch.

**Empfehlung:** Die Tests im Container oder unter einem eigenen Benutzer ohne Zugriff auf `~/wegfara-env/prod.env` laufen lassen. Die prod-Werte als Environment Secret mit Freigabepflicht führen. `npm ci --ignore-scripts` prüfen.

---

## Finding 13: Die Dateiart hochgeladener Dateien wird nicht am Inhalt geprüft

**Schweregrad: niedrig** · **aus Code erschlossen**

Uploads werden nicht an ihren ersten Bytes (Magic Bytes) geprüft. Dokumente werden `inline` und ohne `nosniff` ausgeliefert. Das Risiko bleibt begrenzt: Die Liste erlaubter Dateiarten ist fest (Bilder und PDF), und die Dateinamen vergibt der Server.

**Empfehlung:** Die ersten Bytes gegen die behauptete Art prüfen und `nosniff` setzen.

---

## Finding 14: „Ohne Passkey weiter“ (req-085) weicht vom Wortlaut des SOLL ab

**Schweregrad: niedrig** · **aus Requirement und Code erschlossen**

`security.md` verlangt beim Einlösen einen neuen Passkey, die App macht ihn freiwillig. Gültigkeit, Einmaligkeit und Bindung an eine Person bleiben gewahrt.

**Empfehlung:** `security.md` an req-085 anpassen, oder den Passkey für Admins und Reiseleiter weiter verlangen.

---

## Finding 15: Web-Suche und Plan-Werkzeuge laufen im selben Gespräch

**Schweregrad: niedrig** · **aus Code erschlossen**

Über eine gelesene Webseite könnte das Modell per Prompt-Injection dazu gebracht werden, Reisedaten in Suchanfragen zu schreiben. Das Risiko ist gering, weil der Plan-Leser keine personenbezogenen Felder liefert.

**Empfehlung:** Eine Regel im System-Prompt. Optional die Web-Suche abschalten, sobald ein Plan-Werkzeug aufgerufen wurde.

---

## Finding 16: Standorte werden bei Reiseende nicht gelöscht

**Schweregrad: niedrig** · **aus Code erschlossen**

`deleteTripPosition` läuft nur, wenn jemand die Freigabe abschaltet. `security.md` verlangt die Löschung nach Reiseende.

**Empfehlung:** Ein täglicher Lauf, der die Positionen vergangener Reisen löscht.

---

## Finding 17: `AUTH_SECRET` hat eine Doppelrolle und keine Mindestlänge

**Schweregrad: niedrig** · **aus Code erschlossen**

Das Secret ist die Quelle des AES-Schlüssels und wird zugleich als Deploy-Token im Header gesendet. Geprüft wird nur, ob es leer ist.

**Empfehlung:** Beim Start mindestens 32 Zeichen verlangen und das Deploy-Token zweckgebunden ableiten.

---

## Finding 18: Kein `.dockerignore`, Images und Actions nicht gepinnt

**Schweregrad: niedrig** · **aus Config erschlossen**

Der Build-Kontext enthält `.git`. Dazu kommen `cloudflare/cloudflared:latest` und Actions per Tag auf dem self-hosted Runner.

**Empfehlung:** Ein `.dockerignore` anlegen, Images per Digest und Actions per SHA pinnen.

---

## Finding 19: Externe Abrufe ohne Zeitgrenze

**Schweregrad: niedrig** · **aus Code erschlossen**

Betroffen sind Google Places, OSM-Suche und -Ortsabfrage sowie die Wechselkurse.

**Empfehlung:** `AbortSignal.timeout(...)` an diesen `fetch`-Aufrufen setzen.

---

## Finding 20: dev hat Schreibzugriff auf die prod-Backups

**Schweregrad: niedrig** · **aus Config erschlossen**

`${HOME}/wegfara-backups` ist in beide Container eingehängt, auch in dev, und nicht schreibgeschützt (`:ro` fehlt).

**Empfehlung:** Für dev nur lesend einhängen und ein eigenes Sicherungsverzeichnis anlegen.

---

## Geprüft und in Ordnung

- **Keine Änderung seit dem 04.11.:** Seit `14b12ae` hat sich nur `delivery/` geändert. Neuer Code, neue Routen oder neue Secrets sind nicht hinzugekommen. Die Secret-Prüfung vom 04.11. über die gesamte Historie gilt deshalb weiter: nur Platzhalter und Wegwerfzugänge für E2E, keine `.env`-, `.pem`- oder `.key`-Dateien.
- **Sitzungspflicht, heute live auf prod geprüft:** `/api/trips` und `/api/einladungen` antworten ohne Cookie mit `401`. `/api/health` ist offen, wie vorgesehen.
- **Deploys:** prod ist seit dem 29.10. unverändert (`da88e71`, nur per `workflow_dispatch`). Danach gab es nur dev-Deploys durch Pushes. Es gibt 0 Pull Requests.
- Unverändert gültig sind die positiven Befunde vom 04.11.:
  - Tokens als SHA-256 und atomar entwertet,
  - Deploy-Token zeitkonstant verglichen,
  - `safeRedirectTarget`,
  - kein ungeprüftes `dangerouslySetInnerHTML`,
  - App an `127.0.0.1` gebunden, PostgreSQL ohne Portfreigabe.

## Grenzen dieser Prüfung

- **Kein SSH-Zugang:** Backups auf dem Host, Rechte der env-Dateien, Stärke von `AUTH_SECRET` sowie die Einstellungen von Tunnel und Cloudflare sind nicht geprüft.
- **GitHub-Einstellungen:** Branch-Schutz, Fork-Freigabe, Runner und Secret Scanning sind mit dem Worker-Token nicht abrufbar.
- **prod nur von außen:** nur GET-Abfragen wie ein anonymer Besucher, nichts verändert.
- **Ohne Sitzung:** Die Findings 3, 4, 7, 10 und 11 sind aus dem Code erschlossen, nicht live nachgestellt.
- **Repo unverändert:** nur gelesen, `git fetch` und `npm audit`, kein Commit.
