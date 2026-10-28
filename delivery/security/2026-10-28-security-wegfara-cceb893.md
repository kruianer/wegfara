---
type: security
repo: Wegfara
commit: cceb893
date: 2026-10-28
---

# Security: Wegfara (cceb893)

Automatisch erstellt vom appbaua-Worker am 2026-10-28.

# Security-Check wegfara — 28.10.2026

**Stand:** `dev` @ `cceb893` · **SOLL:** `delivery/security.md` (vorhanden), `delivery/devops.md`, `CLAUDE.md` · **Vorläufer:** Berichte vom 07.10., 14.10. und 21.10.2026

## Kurz-Zusammenfassung

Ich habe Requirements, Code und Config geprüft, `npm audit` laufen lassen und dev und prod von außen abgefragt (HTTP/HTTPS, Header, Sitzungspflicht). SSH-Zugang war nicht hinterlegt (`~/.ssh` fehlt). Den Zustand auf dem Beelink (Backups, Dateirechte, Tunnel, Cloudflare) konnte ich deshalb nur aus der Config erschließen. Am Repo habe ich nichts geändert.

Seit dem letzten Lauf kamen 83 Commits dazu: Einladung per E-Mail mit freiwilligem Passkey (req-085), „Wer fährt mit“ im Begleiter (req-087), Chat mit Web-Suche (req-092), Chat liest Reise, POIs, Tagesplan und Kosten (req-093). Die neuen Lese-Werkzeuge des Chats sind sauber gebaut: Die Reise kommt nie vom Modell, und die Felder werden einzeln ausgewählt. Die alten Schwachstellen in der Rechteprüfung sind aber alle noch offen, und die neuen Funktionen bauen auf ihnen auf:

- **Jede angemeldete Person kann das Konto des Account-Admins übernehmen.** `POST /api/einladungen` prüft keine Rolle. Gemeldet ist das seit dem 07.10.; seit req-085 hängt der Mail-Versand an derselben Route.
- **Die Rolle „Reiseleiter“ prüft keine einzige Schnittstelle.** Ein Mitreisender kann per direktem Aufruf eine ganze Reise samt Bildern und Dokumenten löschen.
- **HTTPS wird weiterhin nicht erzwungen.** Heute live geprüft: dev und prod antworten auf `http://` mit `200`, ohne Weiterleitung und ohne HSTS.
- **Abhängigkeiten: jetzt 9 Schwachstellen** (2 kritisch, 7 hoch, vorher 7). `zod` kommt über `openai` neu dazu.
- **Die Zugriffsgrenze ist der Account, nicht die Reisegruppe.** Seit req-093 liest der Chat einer fremden Reise auch deren POIs, Tagesplan und Kosten.
- **Backup:** kein täglicher Lauf und kein Ziel außerhalb des Beelink.

Der Bericht vom 21.10. hat die Rechte-Findings 1, 2 und 5 nicht aufgeführt. Sie sind nicht behoben, wie der Code oben zeigt.

**18 Findings: 5 hoch, 5 mittel, 8 niedrig.**

| # | Finding | Schweregrad | Verifikation |
|---|---|---|---|
| 1 | Einladung ohne Rollenprüfung, damit Übernahme fremder Konten inkl. Admin | hoch | Code |
| 2 | Rolle „Reiseleiter“ in keiner Schnittstelle geprüft | hoch | Code |
| 3 | HTTPS nicht erzwungen, kein HSTS | hoch | **live** |
| 4 | 9 verwundbare Abhängigkeiten (2 kritisch) | hoch | `npm audit` lokal |
| 5 | Zugriffsgrenze Account statt Reisegruppe, jetzt auch Plan-Werkzeuge des Chats | hoch | Code |
| 6 | Backup: kein täglicher Lauf, kein externes Ziel, kein belegter Restore | mittel | Config |
| 7 | Keine Sicherheits-Header, `x-powered-by` sichtbar | mittel | **live** |
| 8 | Sitzungsende nach Reisezustand greift nicht in den Schnittstellen | mittel | Code |
| 9 | KI-Endpunkte ungedrosselt, seit req-092/093 teurer je Frage | mittel | Code |
| 10 | Content-Type hochgeladener Dateien wird geglaubt und `inline` ausgeliefert | mittel | Code |
| 11 | „Ohne Passkey weiter“ (req-085) weicht vom Wortlaut der security.md ab | niedrig | Code/Req |
| 12 | Web-Suche und Plan-Werkzeuge im selben Gespräch: Reisedaten können in Suchanfragen landen | niedrig | Code |
| 13 | Standorte werden bei Reiseende nicht gelöscht | niedrig | Code |
| 14 | `AUTH_SECRET` mit Doppelrolle, ohne geprüfte Mindestlänge | niedrig | Code |
| 15 | Kein `.dockerignore`, `cloudflared:latest` ungepinnt | niedrig | Config |
| 16 | Externe Abrufe weitgehend ohne Zeitgrenze | niedrig | Code |
| 17 | dev hat Schreibzugriff auf die prod-Backups | niedrig | Config |
| 18 | Name und E-Mail des Betreibers im Klartext in Migrationen | niedrig | Code |

---

## Finding 1: Jede angemeldete Person kann über `POST /api/einladungen` ein fremdes Konto übernehmen

**Schweregrad: hoch** · **aus Code erschlossen.** Live nicht nachgestellt, weil das den Datenbestand verändert hätte. *Offen seit dem 07.10.2026; req-085 und req-087 haben die Route erweitert, aber nicht abgesichert.*

Die Kette, Glied für Glied im Repo:

1. **Die Kennungen sind bekannt.**
   - `app/go/page.tsx` gibt jeder Sitzung die Personen des Accounts samt `id` an den Browser.
   - `app/api/positionen/route.ts:41` liefert Positionen mit `participantId`.
2. **Die Route prüft nur, ob jemand angemeldet ist.**
   - `app/api/einladungen/route.ts` ruft `currentSession()` und danach direkt `inviteTripParticipant(...)`.
   - `createInvitation` (`lib/invitations/create-invitation.ts`) prüft nur zwei Dinge: Die Zielperson gehört zum Account, und sie ist *irgendeiner* Reise zugeordnet.
   - Es fehlt die Prüfung, ob der Aufrufer Reiseleiter oder Account-Admin ist.
   - Die Seite `app/go/mitreisende/page.tsx` prüft `darfMitreisendeVerwalten`, die Schnittstelle dahinter nicht.
3. **Der Link kommt im Klartext zurück** (`{ invitation }`, Status 201).
4. **Wer den Link einlöst, wird zur Zielperson.** `redeemAccessLink` (`lib/auth/login.ts:174`) übernimmt dabei auch deren `accountAdmin`- bzw. `superAdmin`-Kennzeichnung.

**Auswirkung:** Ein eingeladenes Familienmitglied wird so zum Account-Admin. Damit sind Personenverwaltung, Zugangsschlüssel und Backups offen. Ist der Gesamt-Admin einer Reise zugeordnet, gilt das auch für ihn, also inklusive Wechsel in fremde Accounts.

Seit req-085 verschickt dieselbe Route zusätzlich eine E-Mail an das Opfer. Der Angreifer erhält den Link trotzdem in der Antwort. Nebenbei entwertet der Angriff den letzten gültigen Link des Opfers (`invalidateAccessLinks`).

**Empfehlung:**
- In der Route vor `inviteTripParticipant` prüfen: `session.accountAdmin` **oder** der Aufrufer ist Reiseleiter einer Reise, der die Zielperson angehört. Das ist dieselbe Regel wie `darfMitreisendeVerwalten`.
- Die Berechtigung als Pflichtparameter in `createInvitation` aufnehmen, damit ein künftiger zweiter Aufrufer sie nicht vergisst.
- Einladungen für Account-Admin und Gesamt-Admin nur durch einen Account-Admin bzw. Gesamt-Admin zulassen.
- Dazu ein Test: *Eine Person ohne Leiterrolle bekommt für eine andere Person keine Einladung (403).*

---

## Finding 2: Die Rolle „Reiseleiter“ prüft keine Schnittstelle

**Schweregrad: hoch** · **aus Code erschlossen** · *offen seit dem 14.10.2026*

- `darfPlanen` / `darfMitreisendeVerwalten` kommen in Seiten vor. In `app/api/**/route.ts` gibt es keine Rollenprüfung für Reisedaten.
- `forbidden()` steht nur in Admin-Routen (`participants`, `nutzer`, `backups`, `zugangsschluessel`).
- Beispiel `DELETE /api/trips` (`app/api/trips/route.ts:251`): Es gibt `currentSession()`, danach wird gelöscht. Dabei entfernt die Route über `entferneBilddateien`/`entferneDokumentdateien` auch die Dateien, unwiederbringlich.
- Gleiches gilt für die schreibenden Routen von `pois`, `programmpunkte`, `kostenzeilen`, `transfers`, `bewertungsrunden`, `dokumente` und `chat` (DELETE verwirft die Unterhaltung).

**Empfehlung:**
- Eine gemeinsame Wache in `lib/auth/api-guard.ts`, z. B. `requirePlanRight(session, tripId)` mit 403. Sie wird in jeder schreibenden Planungsroute aufgerufen.
- Ein Sammeltest in `app/api/api-guard.test.ts` nach dem Muster von `session-scope.test.ts`.

---

## Finding 3: HTTPS-Pflicht nicht durchgesetzt

**Schweregrad: hoch** · **live verifiziert (heute)** · *offen seit dem 23.09.2026*

```
GET http://dev.wegfara.com/anmeldung  → 200, kein Location, kein HSTS
GET http://app.wegfara.com/anmeldung  → 200, kein Location, kein HSTS
GET https://dev.wegfara.com/anmeldung → 200, kein Strict-Transport-Security
GET https://app.wegfara.com/anmeldung → 200, kein Strict-Transport-Security
```

`security.md` verlangt: *„Kein unverschluesselter Zugriff.“* Über HTTP setzt die App Cookies ohne `Secure`, weil `connectionIsSecure` korrekt `x-forwarded-proto: http` erkennt. Ein Sitzungs-Cookie (gültig bis zu 90 Tage) kann so in einem fremden WLAN im Klartext laufen.

**Empfehlung:**
1. In Cloudflare je Zone „Always Use HTTPS“ einschalten.
2. HSTS (`max-age=31536000; includeSubDomains`) über `headers()` in `next.config.ts` setzen.
3. Als Rückfallebene in `middleware.ts` bei `x-forwarded-proto: http` auf `https` umleiten (308).

---

## Finding 4: Neun bekannte Schwachstellen in Abhängigkeiten, zwei kritisch

**Schweregrad: hoch** · **verifiziert per `npm audit --omit=dev`** gegen die installierten `node_modules`. Welche Versionen auf dev/prod laufen, habe ich nicht live geprüft. *Offen seit dem 23.09.2026, verschlechtert.*

| Paket | installiert | Schwere | Relevanz |
|---|---|---|---|
| `next` | 16.2.12 | **kritisch** | RCE in `next/og` (`GHSA-vcvr-r3jv-pc5j`): `app/icon/[groesse]/route.tsx` nutzt `next/og` und ist öffentlich. Dazu RCE in Image Optimization (AVIF/SVG), RCE in `use cache`, SSRF, Cache Poisoning, DoS bei Server Actions. |
| `maplibre-gl` | 6.0.0 | **kritisch** | XSS-Sanitizer-Bypass (`GHSA-jrc7-96c5-q579`), betrifft ≤ 6.4.0. |
| `nodemailer` | 9.0.5 | hoch | 14 Advisories, darunter Zustellung an fremde Domains und Offenlegung von SMTP-Zugangsdaten. Betrifft den Versand von Anmelde- und seit req-085 auch Einladungslinks. |
| `zod` (über `openai` 5.23.2, `@anthropic-ai/sdk`) | 3.25.76 | hoch | **neu.** Speichererschöpfung bei großen Collections. Fix verlangt `openai` 7.x (Breaking Change). |
| `sharp` (transitiv) | 0.34.5 | hoch | Lücken in libvips, libheif, librsvg. Verarbeitet Nutzerbilder und HEIC. |
| `postcss`, `source-map-js`, `nanoid` (transitiv) | — | hoch | überwiegend Bauzeit |

**Empfehlung:**
- `npm audit fix` für die transitiven Pakete.
- `next` (≥ 16.4.x), `maplibre-gl` (> 6.4.0, Kopie unter `/maplibre` mitziehen) und `nodemailer` (> 10.1.3) bewusst anheben. Danach die volle Suite plus `npm run test:e2e` laufen lassen.
- Prüfen, ob `openai` noch gebraucht wird. Wenn nicht, entfernen; das erledigt auch `zod`.
- `npm audit --omit=dev --audit-level=high` als Gate in `deploy-prod.yml` aufnehmen.

---

## Finding 5: Zugriffsgrenze der Schnittstellen ist der Account, nicht die Reisegruppe

**Schweregrad: hoch** · **aus Code erschlossen** · *offen seit dem 23.09.2026, durch req-093 erweitert*

`security.md`: *„Teilnehmer sehen nur Daten der Reisen, zu denen sie gehoeren.“*

- `app/api/chat/route.ts` (GET/POST/DELETE) prüft nur `tripBelongsToAccount` (`lib/db/trips.ts:145`), also `account_id`.
- **Neu seit req-093:** Mit derselben Prüfung erhält das Modell über `createPlanLeser(db, accountId, tripId)` Reise, POIs, Tagesplan und Kosten. Wer zu Reise A gehört, kann im Chat zu Reise B (auch „In Planung“, für Mitreisende sonst unsichtbar) nach deren Plan und Kosten fragen.
- Der Kommentar in der Route behauptet das Gegenteil: *„Wer eine Reise nicht sieht, sieht ihre Unterhaltung nicht.“*
- `findDocumentFile` (`lib/db/documents.ts:250`) filtert ebenfalls nur nach Account. Belege und Tickets jeder Reise sind damit für jede Person des Accounts abrufbar.
- Positiv: `positionen`, `live-status` und `position-teilen` nutzen korrekt `listTripsForSession`.

**Empfehlung:**
- `tripAccessibleToSession(db, session, tripId)` analog zu `listTripsForSession` einführen (berücksichtigt `actingAccount`).
- Chat, Plan-Leser, Programmpunkte, KI-Planung, POI-Suche und Dokumente darauf umstellen.

---

## Finding 6: Backup-Erwartung nicht erfüllt

**Schweregrad: mittel** · **aus Config erschlossen** (ohne SSH nicht prüfbar) · *offen seit dem 23.09.2026*

| Vorgabe | Ist |
|---|---|
| täglich, automatisch | `instrumentation.ts` startet nur `startDocumentAudit()`. Kein Backup-Lauf, kein `schedule` in `.github/workflows/`. Gesichert wird nur vor dem prod-Deploy und von Hand. |
| zweites Ziel außerhalb des Beelink | `${HOME}/wegfara-backups` liegt auf derselben Maschine. Im Repo gibt es kein rclone, S3 oder NAS. Laut Vorgabe gilt das Backup damit *„als nicht vorhanden“*. |
| Wiederherstellung getestet | Es gibt eine Restore-Route mit Tests. Einen realen Rückspiel-Lauf konnte ich nicht nachweisen. |

**Empfehlung:**
- Einen `startDailyBackup()` in `instrumentation.ts` neben dem Dokument-Audit einhängen.
- Anschließend eine verschlüsselte Offsite-Kopie (z. B. rclone auf Hetzner Storage Box oder B2), Ziel als Umgebungsvariable in `~/wegfara-env/prod.env`.
- Einmal ein prod-Backup auf dev einspielen und das Datum dokumentieren.

---

## Finding 7: Keine Sicherheits-Header

**Schweregrad: mittel** · **live verifiziert (heute)**

dev und prod liefern weder `Content-Security-Policy` noch `Strict-Transport-Security`, `X-Content-Type-Options`, `X-Frame-Options`/`frame-ancestors` oder `Referrer-Policy`. Dafür steht `x-powered-by: Next.js` in jeder Antwort.

**Empfehlung:**
- `headers()` in `next.config.ts` mit HSTS, `nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, dazu `poweredByHeader: false`.
- Die CSP zuerst als `Report-Only` auf dev einführen.

---

## Finding 8: Sitzungsende nach Reisezustand greift nur auf Seiten

**Schweregrad: mittel** · **aus Code erschlossen**

- `sessionRemainsValid` wird nur in `requireTripAccess` (Seiten, mit `redirect`) ausgewertet.
- Keine API-Route ruft es; alle nutzen `currentSession()`.
- Wer nach Reiseende aus der Oberfläche fliegt, behält ein für die Schnittstellen gültiges Cookie, bis die 90-Tage-Frist abläuft. Die Fälle aus Finding 1, 2 und 5 bleiben damit über diese Zeit offen.

**Empfehlung:** Eine gemeinsame Wache, die auf Seiten mit `redirect` und in Schnittstellen mit `401` reagiert. Mit Finding 2 zusammen umsetzen.

---

## Finding 9: KI-Endpunkte ungedrosselt, seit req-092/093 teurer je Frage

**Schweregrad: mittel** · **aus Code erschlossen**

- `createRateLimiter` wird nur in `app/api/auth/anmeldelink` benutzt.
- Je Chat-Frage gilt jetzt (`lib/ai/anthropic-client.ts`):
  - `MAX_TOKENS = 16000` (vorher 8192),
  - bis zu 3 kostenpflichtige Web-Suchen (`WEB_SUCHE_MAX_USES`),
  - bis zu 6 Werkzeug-Runden (`PLAN_WERKZEUG_MAX_AUFRUFE`), jede mit dem vollen Verlauf.
- `listChatNachrichten` holt den Verlauf ohne `limit` und schickt ihn komplett mit.
- Abgerechnet wird über den Anthropic-Schlüssel des Accounts. Jede angemeldete Person kann so die Rechnung des Betreibers hochtreiben.

**Empfehlung:**
- Rate-Limit je Person und Tag auf `chat`, `ki-planung`, `poi-beschreibung`, `poi-ki-bild`, `poi-vervollstaendigen` und `place-search`.
- Den Zusammenhang auf die letzten *n* Nachrichten begrenzen; die Anzeige kann weiter alles zeigen.

---

## Finding 10: Content-Type hochgeladener Dateien wird geglaubt und `inline` ausgeliefert

**Schweregrad: mittel** · **aus Code erschlossen**

- Die Art der Datei kommt aus Browser-Angabe oder Dateiendung. Eine Magic-Byte-Prüfung gibt es nicht (`lib/documents/validate.ts`).
- Die Auslieferung erfolgt mit `Content-Disposition: inline` (`app/api/dokumente/[id]/route.ts:44`) und ohne `nosniff`.

**Empfehlung:**
- Die ersten Bytes gegen die behauptete Art prüfen.
- `nosniff` setzen.
- `inline` nur für Bilder und PDF, alles andere als `attachment`.

---

## Finding 11: „Ohne Passkey weiter“ (req-085) weicht vom Wortlaut der security.md ab

**Schweregrad: niedrig** · **aus Requirement und Code erschlossen** *(neu)*

- `security.md`: *„Beim Einloesen richtet der Teilnehmer einen neuen Passkey ein; der Link selbst ist nur der Weg zurueck, kein Dauerzugang.“*
- req-085 macht den Passkey freiwillig. Wer „Ohne Passkey weiter“ wählt, behält eine Sitzung, solange die Reise freigegeben ist. Ein über einen Messenger weitergereichter Link wird so faktisch zu einem Zugang ohne zweiten Faktor.
- Die Eigenschaften des Links selbst bleiben gewahrt: 7 Tage gültig, einmalig, an eine Person gebunden, POST-Einlösung seit bug-068.
- Die Abweichung ist vertretbar, steht aber nicht im SOLL.

**Empfehlung:** `security.md` an die Entscheidung aus req-085 anpassen (bewusste Entscheidung des Betreibers). Wenn das nicht gewollt ist, den Passkey für Account-Admin und Reiseleiter weiter verlangen.

---

## Finding 12: Web-Suche und Plan-Werkzeuge laufen im selben Gespräch

**Schweregrad: niedrig** · **aus Code erschlossen** *(neu, req-092/093)*

- Das Modell kann Reisedaten lesen (Titel, Zeitraum, POIs, Kosten) und im selben Zug im Web suchen.
- Eine gelesene Webseite kann das Modell per Prompt-Injection dazu bringen, Reisedaten in Suchanfragen zu formulieren.
- Der Abfluss geht an den Suchdienst des Anbieters, nicht direkt an eine Angreifer-URL. `web_fetch` ist nicht aktiv, und personenbezogene Felder (Namen, Adressen, Bankdaten) sind im Plan-Leser bewusst ausgespart. Das Risiko ist daher gering.
- `security.md` verlangt trotzdem: *„An externe Dienste gehen nur die fuer die Anfrage noetigen Daten.“*

**Empfehlung:** Im System-Prompt festhalten, dass Werkzeug-Ergebnisse nicht in Suchanfragen übernommen werden. Optional die Web-Suche in einem Zug abschalten, sobald ein Plan-Werkzeug aufgerufen wurde.

---

## Finding 13: Standorte werden bei Reiseende nicht gelöscht

**Schweregrad: niedrig** · **aus Code erschlossen** · *offen seit dem 23.09.2026*

`deleteTripPosition` wird nur beim Abschalten der Freigabe aufgerufen (`lib/db/position-sharing.ts:55`). Bei Reiseende gibt es keine Löschung; ausgeblendet ist nicht gelöscht.

**Empfehlung:** Täglicher Lauf in `instrumentation.ts`, der Positionen vergangener Reisen entfernt.

---

## Finding 14: `AUTH_SECRET` mit Doppelrolle, ohne geprüfte Mindestlänge

**Schweregrad: niedrig** · **aus Code erschlossen**

Das Secret dient als Quelle für den AES-Schlüssel und als Deploy-Token im Header. `envGeheimnis` prüft nur, ob es leer ist.

**Empfehlung:** Mindestlänge (32 Zeichen) beim Start prüfen. Das Deploy-Token zweckgebunden ableiten statt das Wurzelgeheimnis zu senden.

---

## Finding 15: Kein `.dockerignore`, `cloudflared:latest` ungepinnt

**Schweregrad: niedrig** · **aus Config erschlossen**

- Der Build-Kontext `context: ..` umfasst das ganze Repo inkl. `.git`; ein `.dockerignore` fehlt.
- `deploy/docker-compose.yml:110` nutzt `cloudflare/cloudflared:latest`.

**Empfehlung:** `.dockerignore` mit `.git`, `node_modules`, `.next`, `delivery`, `test-results`, `*.tsbuildinfo` anlegen. Images per Digest pinnen.

---

## Finding 16: Externe Abrufe weitgehend ohne Zeitgrenze

**Schweregrad: niedrig** · **aus Code erschlossen**

- Neu mit Zeitgrenze: OSRM (`lib/routing/osrm-client.ts:119`) und der Modell-Katalog.
- Weiterhin ohne Zeitgrenze: Google Places, OSM-Suche/Geocoding, Open-Meteo. Bei Google Places kommt `redirect: "follow"` auf eine Adresse aus einem Nutzer-Link hinzu.

**Empfehlung:** `AbortSignal.timeout(...)` an allen verbleibenden `fetch`-Aufrufen.

---

## Finding 17: dev hat Schreibzugriff auf die prod-Backups

**Schweregrad: niedrig** · **aus Config erschlossen**

`${HOME}/wegfara-backups:/data/backups` wird in beide Container eingehängt, ohne `:ro`. dev wird bei jedem Push vom autonomen Worker ausgerollt, der prod laut `devops.md` nie anfassen darf.

**Empfehlung:** Für dev nur lesend einhängen; dev sichert in ein eigenes Verzeichnis.

---

## Finding 18: Personenbezogene Daten in Migrationen

**Schweregrad: niedrig** · **aus Code erschlossen**

`migrations/0002_seed_demo_data.sql:6` und `migrations/0015_auth.sql:82` enthalten Name und E-Mail des Betreibers.

**Empfehlung:** Bestehende Migrationen nicht ändern. Künftig ausschließlich `BOOTSTRAP_EMAIL` nutzen. Vor einer Veröffentlichung des Repos die Migrationen bereinigen.

---

## Geprüft und in Ordnung

- **Secrets:**
  - Keine echten Schlüssel in Code und History seit dem letzten Lauf. Treffer wie `sk-ant-a3f9` und `sk-ant-test` sind Test-Attrappen.
  - Keine `.env`-, `.pem`- oder `.key`-Datei ist eingecheckt.
  - Secrets kommen aus `~/wegfara-env/<env>.env`.
- **Sitzungspflicht, live:** `/api/chat` und `/api/trips` antworten ohne Cookie mit `401`. `/api/health` ist offen, wie vorgesehen.
- **Plan-Leser des Chats (req-093):**
  - Die Reise kommt aus der Route, nicht vom Modell. Das Modell kann nur ein Datum mitgeben.
  - Die Felder werden einzeln ausgewählt: keine Teilnehmernamen, keine Kennungen, keine Dokumente, keine Bankdaten.
  - Das Problem ist allein die zu weite Vorprüfung (Finding 5).
- **Einladungen einlösen (bug-068):** nur noch per POST; ein Vorab-Abruf durch Link-Vorschauen entwertet nichts.
- **Erreichbarkeit:** Die App ist an `127.0.0.1` gebunden, PostgreSQL hat keine Portfreigabe, der Zugang läuft über den Cloudflare Tunnel.
- **prod-Workflow:** nur `workflow_dispatch` mit Bestätigungswort, Tests und E2E vor Backup und Deploy.

## Grenzen dieser Prüfung

- **Kein SSH-Zugang:** Backups auf dem Host, Rechte der env-Dateien, Stärke von `AUTH_SECRET`, Tunnel und Cloudflare-Einstellungen sind nicht geprüft.
- **prod nur von außen:** nur HTTP/HTTPS-Verhalten und Header, nichts angefasst.
- **Keine Sitzung:** Findings 1, 2, 5, 8 bis 10 sind aus dem Code erschlossen, nicht live nachgestellt, weil das den Datenbestand verändert hätte.
- **Repo unverändert:** nur gelesen, `npm audit` ausgeführt, kein Commit.
