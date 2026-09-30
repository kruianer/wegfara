---
type: security
repo: Wegfara
commit: 42b2d65
date: 2026-09-30
---

# Security: Wegfara (42b2d65)

Automatisch erstellt vom appbaua-Worker am 2026-09-30.

Prüfung abgeschlossen. Ich habe nichts im Repo verändert, nichts committet und nichts gepusht.

---

# Security-Check wegfara — 30.09.2026

## Kurz-Zusammenfassung

Geprüft wurde das IST des Repos (Branch `dev`, Stand `42b2d65`) gegen das SOLL aus [delivery/security.md](delivery/security.md), ergänzt um [delivery/devops.md](delivery/devops.md), [delivery/stack.md](delivery/stack.md) und [CLAUDE.md](CLAUDE.md). Eine repo-spezifische Vorgabe lag also vor.

Der Kern der Anwendung ist weiterhin sicherheitstechnisch gut gebaut: keine Secrets im Repo oder in der Historie, Anmelde-Geheimnisse nur als SHA-256-Prüfsumme, zeitkonstante Vergleiche, Zugangsschlüssel je Account mit AES-256-GCM aus einem Umgebungs-Geheimnis, PostgreSQL ohne Portfreigabe, Bild- und Dokumentdateien außerhalb des ausgelieferten Teils der App. 46 der 51 API-Routen prüfen die Sitzung selbst, die übrigen fünf sind die Anmelde- und Health-Endpunkte, die ihre Voraussetzungen jeweils selbst nachprüfen. Live bestätigt auf beiden Umgebungen: `/plan` leitet ohne Sitzung auf `/anmeldung`, `/api/trips`, `/api/dokumente/<id>` und `/api/backups` antworten mit 401. Das seit req-053 eingeführte Einspielen eines Backups ist gegen Zip-Slip abgesichert, das Umleitungsziel der Anmeldung gegen Open Redirect.

**Bemerkenswert an diesem Lauf: der Bericht vom 23.09.2026 nannte 9 Findings — keines davon ist behoben.** Alle sind unverändert offen; die 52 Commits seit damals waren ausschließlich Oberfläche (Seitenleiste, Zeitstrahl-Zoom, Kartenpfeile, Begleiter-Kachel). Am neuen Code (req-074 bis req-079, bug-052 bis bug-059) habe ich keinen Mangel gefunden — die Kachel-Links (`lib/activities/kachel-links.ts`) setzen zwar eine frei eingegebene POI-Webseite unmittelbar in ein `href`, aber React 19 blockiert `javascript:`-Adressen beim Rendern, und die Karten-Popups bauen ihren Inhalt über `textContent` statt über HTML.

Die Befunde liegen damit dort, wo sie vor einer Woche lagen: **die HTTPS-Pflicht wird nicht durchgesetzt** (live verifiziert, mit neuem Beweis: über HTTP setzt die App ihre Cookies ohne `Secure`), **sechs bekannte Schwachstellen in den Abhängigkeiten, davon zwei kritische** (live verifiziert), **die Backup-Erwartung wird nicht erfüllt**, und **die Zugriffsgrenze im Code ist der Account, nicht die Reisegruppe**. Neu hinzu kommen drei kleinere Befunde (10 bis 12).

**12 Findings: 3 hoch, 3 mittel, 6 niedrig.**

---

## Finding 1 — HTTPS-Pflicht nicht durchgesetzt; über HTTP setzt die App Cookies ohne `Secure`

**Schweregrad: hoch** · **live verifiziert** · *unverändert offen seit dem Bericht vom 23.09.2026*

security.md: *„HTTPS: Pflicht fuer beide Umgebungen … Kein unverschluesselter Zugriff, keine Zertifikatswarnung."*

IST, heute live geprüft:

```
http://app.wegfara.com/anmeldung   → 200, 9681 Bytes (vollständige Anmeldeseite, keine Weiterleitung)
http://dev.wegfara.com/anmeldung   → 200, 9681 Bytes
http://app.wegfara.com/api/health  → 200
http://dev.wegfara.com/api/health  → 200
Strict-Transport-Security          → auf keiner der beiden Domains gesetzt
```

Neu und diesmal unmittelbar belegt ist die Folge davon. Dieselbe Anfrage einmal über HTTP und einmal über HTTPS an dieselbe Adresse:

```
POST http://dev.wegfara.com/api/auth/passkey/anmeldung
  → set-cookie: wegfara_webauthn=; Path=/; Max-Age=0; HttpOnly; SameSite=lax
POST https://dev.wegfara.com/api/auth/passkey/anmeldung
  → set-cookie: wegfara_webauthn=; Path=/; Max-Age=0; Secure; HttpOnly; SameSite=lax
```

Über HTTP fehlt `Secure`. Das ist genau das Verhalten, das `connectionIsSecure()` (`lib/auth/cookies.ts:34`) vorsieht — es richtet sich nach `x-forwarded-proto`, und Cloudflare reicht bei einem HTTP-Aufruf eben `http` durch. Für den Challenge-Cookie ist das harmlos; für das **Sitzungs-Cookie** ist es es nicht: wird der Anmeldelink über HTTP geöffnet, löst `app/anmeldung/link/route.ts` ihn trotzdem ein und schreibt die Sitzung ohne `Secure` — das Token stand dann im Klartext in der URL, und das Cookie geht danach bei jedem HTTP-Aufruf unverschlüsselt mit. Dasselbe gilt für die Verlängerung in `middleware.ts:91`.

Ohne Weiterleitung und ohne HSTS lässt sich die Anmeldeseite im offenen WLAN oder im Mobilnetz per SSL-Stripping abfangen und verändern — genau das Szenario, für das der Begleiter gebaut ist.

**Empfehlung:** In Cloudflare „Always Use HTTPS" und HSTS einschalten. Zusätzlich in der Anwendung absichern, damit der Schutz nicht allein an einer Einstellung außerhalb des Repos hängt: `Strict-Transport-Security` über `headers()` in `next.config.ts` setzen (siehe Finding 5, dieselbe Stelle) und in der `middleware.ts` jede Anfrage mit `x-forwarded-proto: http` auf HTTPS umlenken. Das Einlösen des Anmeldelinks über HTTP sollte dabei ausdrücklich **abgewiesen** statt umgelenkt werden, damit kein Token über eine unverschlüsselte Leitung verbraucht wird.

---

## Finding 2 — Sechs bekannte Schwachstellen in den Abhängigkeiten, zwei davon kritisch

**Schweregrad: hoch** · **live verifiziert** (`npm audit` gegen die installierten `node_modules`) · *unverändert offen seit dem Bericht vom 23.09.2026*

| Paket | installiert | Fix in | Schwere | Relevanz für wegfara |
| --- | --- | --- | --- | --- |
| `next` | 16.2.12 | 16.3.3 | kritisch | GHSA-2xp9-vwfh-vxw4: unauthentifizierte RCE in der Image-Optimization-API über AVIF. Abgeschwächt: die App benutzt `next/image` nirgends, Fotos und Dokumente gehen über eigene Routen heraus, und `/_next/image` antwortet live mit 400. GHSA-p293-qw3h-jr36 trifft nur Windows-Hosts, also nicht den Beelink |
| `maplibre-gl` | 6.0.0 | 6.11.2 | kritisch | GHSA-jrc7-96c5-q579, CVSS 10: XSS-Sanitizer-Bypass in `DOM.sanitize()`. Abgeschwächt: die Attribution ist eine feste Zeichenkette, und die Popups bauen ihren Inhalt über `setDOMContent` mit `textContent` (`app/go/components/map-view.tsx:161`) — es geht kein Nutzertext durch den Sanitizer. Die Version liegt trotzdem elf Minor-Stände hinter dem Fix |
| `nodemailer` | 9.0.5 | 9.1.1 | hoch | 6 Advisories, darunter zwei Umgehungen der Empfänger-Domain-Prüfung (IDN/Punycode, RFC-5322-Kommentare) — betrifft den Versand der Anmeldelinks, also den einzigen Wiederherstellungsweg ins Konto (req-066 hat die Notfallcodes entfernt) |
| `postcss` | ≤8.5.22 | — (über `next`) | hoch | Pfad-Traversal und Informationsabfluss über `sourceMappingURL`; greift zur Bauzeit |
| `sharp` | ≤0.35.4-rc.0 | — (über `next`) | hoch | geerbte libvips/libheif-Lücken (CVE-2026-33327/33328/35590/35591) — greift bei der Bildverarbeitung, und die App nimmt Bilder und HEIC/HEIF-Dokumente entgegen |
| `nanoid` | <3.3.18 | 3.3.18 | hoch | Endlosschleife bei Größe 0 (DoS) |

Erschwerend: **es gibt keine wiederkehrende Prüfung.** `.github/workflows/deploy-dev.yml` und `deploy-prod.yml` enthalten keinen `npm audit`-Schritt, `package.json` kein entsprechendes Skript, und es ist kein Dependabot/Renovate konfiguriert. Der Stand veraltet still weiter — er war vor einer Woche schon derselbe.

Alle Fixes liegen innerhalb der bereits deklarierten Caret-Ranges; `npm audit fix` genügt, ein Major-Sprung ist nicht nötig.

**Empfehlung:** `npm audit fix` ausführen, `npm test`, `npm run types` und `npm run test:e2e` laufen lassen, über dev abnehmen. Danach die Prüfung festnageln, damit dieses Finding nicht zum dritten Mal im Bericht steht: `npm audit --audit-level=high` als Schritt in `deploy-dev.yml` (dort ist er billig und blockiert nichts Wichtiges) oder Dependabot für `npm` im Repo aktivieren.

---

## Finding 3 — Backup-Erwartung nicht erfüllt: kein täglicher Lauf, kein Ziel außerhalb des Beelink

**Schweregrad: hoch** · **aus Code/Config erschlossen** · *unverändert offen seit dem Bericht vom 23.09.2026*

security.md: *„Backup erwartet: ja. **Taeglich, automatisch** … Ziel: **ein zweites Ziel ausserhalb des Beelink**. Ein Backup, das nur auf derselben Maschine liegt, **gilt als nicht vorhanden**. … Wiederherstellung: muss getestet sein."*

IST:

- Ein Backup entsteht ausschließlich auf Zuruf — vom Gesamt-Admin über `POST /api/backups` oder vom prod-Deploy (`.github/workflows/deploy-prod.yml:67`). **Einen Zeitgeber gibt es nicht.** In `instrumentation.ts` hängt unverändert nur die tägliche Dokument-Prüfung (`startDocumentAudit`, `lib/documents/daily-audit.ts`); ein Gegenstück für Backups existiert nicht, und in `deploy/`, `scripts/` und `.github/` findet sich keine Cron- oder Timer-Einrichtung.
- Abgelegt wird nach `~/wegfara-backups/` **auf dem Beelink selbst** (`deploy/docker-compose.yml:92`). `GET /api/backups/[id]/herunterladen` (req-071) erlaubt eine Kopie nach außen — aber nur von Hand angestoßen. Im Repo steht kein Abzug auf ein zweites Ziel (kein rclone, kein SFTP, kein Objektspeicher).
- Die Wiederherstellung ist automatisiert abgedeckt (`lib/backup/store.test.ts`, `lib/backup/import.test.ts`), ein echter Rückspiel-Lauf ist nirgends dokumentiert.

Gemessen am eigenen SOLL gibt es damit weiterhin **kein** Backup: Verlust, Defekt oder Diebstahl des Beelink nimmt Datenbank, Bilddateien und sämtliche Sicherungen in einem Zug mit. Von den drei Teilen der Vorgabe — täglich, automatisch, zweites Ziel — ist keiner erfüllt.

**Empfehlung:** Zwei kleine Schritte. (a) Einen täglichen Backup-Lauf an die Anwendung hängen, genau wie die Dokument-Prüfung — dasselbe Argument gilt hier wie dort, und `createBackup()` ist bereits die eine Funktion, die sowohl Oberfläche als auch Deploy benutzt. (b) Einen automatischen Abzug auf ein zweites Ziel (All-Inkl per SFTP, externe Platte, Objektspeicher); `GET /api/backups/[id]/herunterladen` liefert dafür schon das fertige ZIP. Ergänzend die Wiederherstellung einmal echt durchspielen — ein prod-Backup auf dev einzuspielen ist laut devops.md ausdrücklich vorgesehen — und das Datum des Laufs festhalten, damit die Zusage „muss getestet sein" belegbar wird.

---

## Finding 4 — Zugriffsgrenze ist der Account, nicht die Reisegruppe

**Schweregrad: mittel** · **aus Code erschlossen** · *unverändert offen seit dem Bericht vom 23.09.2026*

security.md: *„Teilnehmer sehen nur Daten der Reisen, zu denen sie gehoeren"* und *„Belege und Tickets sind nur fuer Mitglieder der zugehoerigen Gruppe abrufbar."*

IST: Der Mandantenfilter greift überall sauber — der Account kommt durchgängig aus `session.accountId`, nie aus der Anfrage. Aber er ist auch die **einzige** Grenze. Geprüft wird „gehört zum Account", nicht „gehört zu dieser Reise":

- `lib/db/documents.ts:250` — `findDocumentFile` joint `trip` und filtert allein `t.account_id`. Wer eine Dokument-ID kennt, bekommt Beleg oder Ticket über `/api/dokumente/[id]`, auch ohne Teilnehmer der Reise zu sein.
- `app/api/bankverbindung/route.ts:33` — `findParticipantInAccount` gibt die IBAN **jeder** Person des Accounts heraus, unabhängig von gemeinsamer Reise.
- Ebenso `app/api/poi-fotos/[id]`, `app/api/programmpunkte`, `app/api/kostenzeilen`, `app/api/ausgaben`.
- Teilnehmerbezogen ist allein `listTripsForSession` (`lib/db/trips.ts`) — die Reise**liste**. Die Daten darunter sind es nicht.

Der Angreifer wäre eine bereits eingeladene Person — deshalb mittel und nicht hoch. Die Aussage der security.md ist aber eindeutig, und Reisen mit unterschiedlichen Teilnehmerkreisen im selben Account sind der Regelfall, nicht die Ausnahme.

**Empfehlung:** Die Prüfung auf Reise-Mitgliedschaft in den Datenzugriffs-Layer `lib/db/` ziehen — analog zu `tripBelongsToAccount`, aber als `participantIsInTrip(db, tripId, participantId)`, angewandt in denselben Abfragen, die heute nur nach Account filtern. Reiseleiter, Account-Admin und der in den Account gewechselte Gesamt-Admin bleiben ausgenommen. Ein Test analog zu `account-scope.test.ts`, nur eine Ebene tiefer, hält es fest.

---

## Finding 5 — Keine Sicherheits-Header, und der Content-Type hochgeladener Dateien wird geglaubt

**Schweregrad: mittel** · **live verifiziert** (Header) **/ aus Code erschlossen** (Upload-Prüfung) · *unverändert offen seit dem Bericht vom 23.09.2026*

Weder `next.config.ts` noch `middleware.ts` setzen Sicherheits-Header; `next.config.ts` hat gar keinen `headers()`-Block. Heute live auf beiden Domains bestätigt: kein `Strict-Transport-Security`, kein `Content-Security-Policy`, kein `X-Content-Type-Options`, kein `X-Frame-Options`, kein `Referrer-Policy`. Gesetzt wird ausschließlich `Cache-Control: no-store` (`middleware.ts:105`).

Das fällt hier stärker ins Gewicht als üblich, weil hochgeladene Dateien aus derselben Origin ausgeliefert werden und **der Dateiinhalt nie geprüft wird** — an beiden Upload-Wegen:

- `lib/documents/validate.ts:72` (`documentContentType`) nimmt, was der Browser meldet, sonst die Dateiendung. `app/api/dokumente/[id]/route.ts:44` liefert die Datei danach mit `Content-Disposition: inline` aus.
- `lib/pois/photo-upload.ts:64` (`poiPhotoContentType`) macht es genauso; `app/api/poi-fotos/[id]` liefert ganz ohne `Content-Disposition`.

Eine als `image/png` deklarierte Datei mit beliebigem Inhalt landet so unter der Anwendungs-Origin. Ohne `nosniff` ist das der klassische Weg zu gespeichertem XSS; mit gültiger Sitzung und ohne CSP als zweite Linie stünden Reisedaten, Belege und IBANs offen.

**Empfehlung:** In `next.config.ts` eine `headers()`-Konfiguration ergänzen: `Strict-Transport-Security` (deckt zugleich Finding 1 ab), `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Frame-Options: DENY` bzw. `frame-ancestors 'none'`. Zusätzlich die Magic Bytes der hochgeladenen Datei gegen den deklarierten Typ prüfen, bevor sie gespeichert wird — `documentUploadProblem` und `poiPhotoUploadProblem` sind die richtigen Stellen, sie werden von Oberfläche und Schnittstelle gemeinsam benutzt. Für ausgelieferte Dokumente `Content-Disposition: attachment` erwägen, wo die Vollbildansicht es nicht braucht.

---

## Finding 6 — Das zustandsabhängige Sitzungsende greift nur auf Seiten, nicht in den Schnittstellen

**Schweregrad: mittel** · **aus Code erschlossen** · *unverändert offen seit dem Bericht vom 23.09.2026*

security.md: *„eine Sitzung gilt, solange die Person mindestens einer Reise im Zustand ‚Freigegeben' zugeordnet ist oder eine offene Bewertung hat. **Trifft beides nicht mehr zu, endet sie beim naechsten Aufruf.**"*

IST: `sessionRemainsValid` (`lib/auth/session-access.ts:24`) wird ausschließlich über `requireTripAccess` (`lib/auth/current-session.ts:58`) aufgerufen, und das an genau zwei Stellen — `app/go/page.tsx:36` und `app/plan/page.tsx:47`. Alle **51** Routen unter `app/api/` prüfen nur `currentSession()`, also allein die Gültigkeit des Tokens.

Eine Person, deren Reise auf „Abgeschlossen" gesetzt wurde, behält damit vollen Zugriff auf Reisedaten, Belege und Ausgaben über die Schnittstellen — bis zu 90 Tage, solange sie keine der beiden Seiten aufruft. Der Kommentar in `current-session.ts` erkennt das Problem richtig („sonst bliebe sie ueber die Schnittstellen weiter benutzbar"), löst es aber nur für den Fall, dass eine Seite aufgerufen wird.

**Empfehlung:** Die Prüfung in einen gemeinsamen Guard für alle Schnittstellen mit Reisebezug ziehen — etwa `requireTripAccessApi()` neben `unauthorized()`/`forbidden()` in `lib/auth/api-guard.ts` — der bei negativem Befund die Sitzung genauso löscht und 401 liefert. Ein Test analog zu `session-scope.test.ts` hält fest, dass keine Route daran vorbeikommt.

---

## Finding 7 — Standortdaten werden bei Reiseende nicht gelöscht

**Schweregrad: niedrig** · **aus Code erschlossen** · *unverändert offen seit dem Bericht vom 23.09.2026*

security.md: *„Positionen werden nur bei aktiver Reise und nur mit Zustimmung des Teilnehmers geteilt und **nach Reiseende geloescht**."*

IST: `trip_position` wird gelöscht, wenn der Teilnehmer das Teilen ausschaltet (`lib/db/trip-positions.ts:108`) oder wenn Reise, Person oder Account entfallen (`on delete cascade`). **Nach Reiseende passiert nichts** — die letzte bekannte Position bleibt in der Datenbank stehen und wird lediglich nicht mehr angezeigt. Ein Aufräum-Lauf existiert nicht; `instrumentation.ts` startet nur die Dokument-Prüfung.

Die Kernzusage der Vision hält: je Teilnehmer und Reise existiert höchstens eine Zeile, es entsteht kein Bewegungsprofil. Übrig bleibt ein einzelner veralteter Aufenthaltsort je Person und Reise, der laut Vorgabe längst weg sein sollte — und der in jedem Backup mitreist.

**Empfehlung:** Den täglichen Lauf aus `instrumentation.ts` um das Aufräumen erweitern: Positionen zu Reisen, deren Endedatum vorbei ist oder deren Zustand „Abgeschlossen" lautet, werden gelöscht. Das ist dieselbe Stelle, an der auch der Backup-Lauf aus Finding 3 hängen sollte — ein Aufwand für zwei Befunde.

---

## Finding 8 — dev und prod teilen sich das Backup-Verzeichnis, und dev deployt bei jedem Push

**Schweregrad: niedrig** · **aus Config erschlossen** · *unverändert offen seit dem Bericht vom 23.09.2026*

`deploy/docker-compose.yml:92` hängt `${HOME}/wegfara-backups` in **beide** Compose-Projekte ein. Ein Gesamt-Admin der dev-Umgebung kann damit prod-Backups auflisten, über `/api/backups/[id]/herunterladen` vollständig herunterladen und über `/api/backups/[id]/wiederherstellen` auf dev einspielen — also echte personenbezogene prod-Daten (Belege, IBANs, Kontaktdaten) in die Umgebung holen, die laut `.github/workflows/deploy-dev.yml` bei **jedem Push auf `dev` ohne Abnahme** automatisch neu deployt wird.

In devops.md ist das ausdrücklich so gewollt und begründet („ein prod-Backup laesst sich auf dev einspielen, um mit echten Daten zu pruefen"). Es steht aber gegen die Aussage im selben Dokument, dass dev und prod sich niemals Daten teilen, und macht die schwächer beachtete Umgebung zum Weg an prod-Daten. Ich führe es auf, weil es eine bewusste Entscheidung ist, die man kennen sollte — nicht, weil sie falsch wäre.

**Empfehlung:** Entweder so lassen und **in security.md als bewusste Ausnahme festhalten** (damit der Security-Task es künftig nicht zum dritten Mal meldet), oder das dev-Backup-Verzeichnis trennen und den Weg von prod nach dev über den bewussten Download/Upload aus req-071 führen — der ist ohnehin vorhanden und hinterlässt eine Entscheidung statt eines stehenden Zugriffs.

---

## Finding 9 — Bremse nur beim Anfordern des Anmeldelinks

**Schweregrad: niedrig** · **aus Code erschlossen** · *unverändert offen seit dem Bericht vom 23.09.2026*

`createRateLimiter` (`lib/auth/rate-limit.ts:25`) wird genau einmal benutzt: in `app/api/auth/anmeldelink/route.ts:20`. Ohne Bremse bleiben die übrigen öffentlichen Endpunkte — das Einlösen des Anmeldelinks (`/anmeldung/link`), das Einlösen einer Einladung (`/einladung`), die Passkey-Anmeldung (`/api/auth/passkey/anmeldung`), die Ersteinrichtung und `POST /api/backups`.

Ein Erraten der Token ist praktisch ausgeschlossen: 256 Bit Zufall, Vergleich über die SHA-256-Prüfsumme, Entwertung in der Bedingung des `UPDATE`. Es bleibt die unbegrenzte Last: jeder Versuch kostet eine Datenbankabfrage, und die Anwendung ist über den Tunnel aus dem ganzen Internet erreichbar (live bestätigt: `POST /api/auth/passkey/anmeldung` antwortet ohne jede Bremse).

**Empfehlung:** Denselben `createRateLimiter` je Quell-IP vor die öffentlichen Einlöse-Endpunkte hängen, oder — kostengünstiger und ohne Code — eine Rate-Limiting-Regel in Cloudflare für `/anmeldung/*`, `/einladung*` und `/api/auth/*`.

---

## Finding 10 — `AUTH_SECRET` trägt zwei Rollen, und seine Stärke wird nie geprüft *(neu)*

**Schweregrad: niedrig** · **aus Code erschlossen**

`AUTH_SECRET` hat zwei Aufgaben zugleich:

1. Aus ihm wird der Schlüssel abgeleitet, mit dem die Zugangsschlüssel der Accounts verschlüsselt sind (`lib/secrets/encryption.ts:47`, AES-256-GCM). Es ist damit der Wurzelschlüssel, dessen Trennung von der Datenbank überhaupt erst dafür sorgt, dass ein gestohlenes Backup nicht auswertbar ist (req-028).
2. Es ist gleichzeitig das Bearer-Token, mit dem sich der prod-Deploy ausweist — im Klartext im Kopf `x-wegfara-deploy` (`lib/backup/deploy-token.ts:20`, `.github/workflows/deploy-prod.yml:80`).

Der Aufruf geht über `127.0.0.1` und verlässt den Beelink nicht, der Vergleich ist zeitkonstant — das ist sauber gelöst. Trotzdem wandert damit der Wurzelschlüssel der Verschlüsselung durch einen HTTP-Kopf und landet potenziell in Zugriffs-Protokollen, in `docker logs` oder in der Ausgabe eines Workflow-Schritts. Der Kommentar in `deploy-token.ts` begründet die Doppelnutzung („ein zweites Geheimnis waere ein zweiter Ort, an dem es verloren gehen kann") — das ist ein gutes Argument gegen ein *zweites, von Hand gepflegtes* Geheimnis, aber keines gegen einen aus demselben Wert *abgeleiteten* Token.

Dazu: **es gibt keine Mindeststärke.** `envGeheimnis("AUTH_SECRET")` (`lib/env/umgebung.ts:40`) prüft nur, ob der Wert nicht leer ist. Ein kurzer, erratbarer Wert bricht beides gleichzeitig — die Verschlüsselung der Zugangsschlüssel und die Authentisierung des Deploy-Aufrufs.

**Empfehlung:** Für den Deploy-Token einen eigenen Zweck ableiten, genau wie es `encryption.ts` mit `PURPOSE` schon tut — `sha256("wegfara:deploy:" + AUTH_SECRET)`, im Workflow gleich mitberechnet. Dann geht der Wurzelschlüssel nie über die Leitung. Zusätzlich beim Start eine Mindestlänge prüfen (32 Zeichen) und bei Unterschreitung laut im Log warnen; die Prüfung passt neben die Bildablage-Prüfung in `instrumentation.ts`.

---

## Finding 11 — Kein `.dockerignore`, und die Container-Images hängen nur an Tags *(neu)*

**Schweregrad: niedrig** · **aus Config erschlossen**

Zwei Punkte an der Build-Konfiguration:

- **Es gibt kein `.dockerignore`.** `deploy/Dockerfile:11` macht `COPY . .` bei einem Build-Kontext von `..`, also dem gesamten Repo-Wurzelverzeichnis. In die Builder-Schicht wandern damit `.git` (die vollständige Historie), `node_modules`, `.next`, `test-results` — und **jede lokal vorhandene `.env`**. Auf dem Beelink liegen die Geheimnisse in `~/wegfara-env/` außerhalb des Repos, dort passiert also nichts; auf einer Entwicklungsmaschine mit `.env.local` landet die Datei in einer Build-Schicht, die auf dem Rechner im Cache liegen bleibt. Das Endabbild ist nicht betroffen (die Runner-Stufe kopiert nur das Standalone-Ergebnis) — der Befund betrifft Zwischenschichten und Build-Cache.
- **Die Images sind nur per Tag gebunden:** `node:22-alpine` (dreimal), `postgres:17-alpine`, und — am deutlichsten — `cloudflare/cloudflared:latest` (`deploy/docker-compose.yml:110`). Weil dev bei jedem Push mit `--build` neu baut, kann sich die Grundlage jederzeit unbemerkt ändern. Bei `latest` für die Komponente, die den Tunnel nach außen aufbaut, ist das der unangenehmste Fall.

**Empfehlung:** Ein `.dockerignore` anlegen, das mindestens `.git`, `node_modules`, `.next`, `test-results`, `delivery`, `.env*` und `tsconfig.tsbuildinfo` ausschließt — das beschleunigt den Build zugleich messbar. `cloudflared` auf eine benannte Version festlegen statt `latest` und die Grundabbilder per Digest binden (`node:22-alpine@sha256:…`), aktualisiert im selben Zug wie die npm-Abhängigkeiten aus Finding 2.

---

## Finding 12 — Der Kurzlink-Abruf holt eine vom Nutzer eingefügte Adresse ohne Zeitgrenze *(neu)*

**Schweregrad: niedrig** · **aus Code erschlossen**

`POST /api/ort-aus-link` (req-048) nimmt einen eingefügten Google-Maps-Link und lässt ihn, wenn es ein Kurzlink ist, serverseitig auflösen: `fetch(url, { redirect: "follow" })` (`lib/google/places-client.ts:237`).

Abgesichert ist das an drei Stellen: die Route verlangt eine Sitzung, `parseGoogleMapsLink` lässt als Kurzlink-Host nur `maps.app.goo.gl`, `goo.gl` und `g.co` zu (`lib/pois/google-link.ts:24`), und hinter einem Kurzlink darf kein weiterer stecken (`lib/pois/google-link-lookup.ts:100`). Zurückgegeben wird außerdem nur `response.url`, nie der Inhalt der Antwort.

Offen bleibt: dem Umleitungsziel folgt der Abruf, **ohne zu prüfen, dass es bei Google bleibt**, und **ohne Zeitgrenze** (kein `AbortSignal.timeout`). Wer über den Altbestand von `goo.gl` eine Weiterleitung auf eine beliebige Adresse legen kann, bringt den Server dazu, dorthin ein GET zu schicken — eine blinde SSRF, deren Ertrag sich auf die Endadresse und das Antwortverhalten beschränkt. Der Angreifer muss angemeldet sein, `goo.gl` nimmt keine neuen Links mehr an, und die DB liegt ohnehin nicht auf HTTP — deshalb niedrig. Die fehlende Zeitgrenze ist der praktisch relevantere Teil: ein langsam antwortendes Ziel hält den Anfrage-Bearbeiter beliebig lange.

**Empfehlung:** In `resolveShortLink` ein `signal: AbortSignal.timeout(5000)` setzen und `redirect: "manual"` verwenden — das Ziel steht dann im `location`-Kopf, und weil es hinterher ohnehin durch `parseGoogleMapsLink` muss, kostet die Prüfung nichts. Dieselbe Zeitgrenze gehört an die übrigen ausgehenden Abrufe in `places-client.ts` und `osrm-client.ts`.

---

## Was geprüft wurde und in Ordnung war

- **Keine Secrets im Repo** — kein `.env` versioniert, `.gitignore` deckt `.env*` ab; die Suche nach Key-, Token- und Private-Key-Mustern im Arbeitsbaum ergab ausschließlich Test-Platzhalter (`sk-test-4711`, `geheimnis-der-umgebung`, `e2e-auth-secret-nur-fuer-tests-…`). Eine Suche über die Historie nach `AUTH_SECRET=` trifft nur den Security-Bericht der Vorwoche. Alle Zugangsdaten kommen aus `~/wegfara-env/*.env` außerhalb des Repos.
- **Anmelde-Geheimnisse** — Anmeldelinks, Sitzungs-Token und Zugangslinks liegen nur als SHA-256-Prüfsumme in der Datenbank, werden zeitkonstant verglichen, und das Einlösen entwertet serverseitig in der `UPDATE`-Bedingung. Keine Passwörter.
- **Zugangsschlüssel je Account** — AES-256-GCM, Schlüssel aus `AUTH_SECRET` mit eigenem Verwendungszweck abgeleitet, Ergebnis mit IV und Auth-Tag versioniert, nie zwei gleiche Chiffrate für denselben Wert (`lib/secrets/encryption.ts`).
- **Mandantentrennung** — der Account kommt durchgängig aus `session.accountId`, nie aus der Anfrage; belegt durch `account-scope.test.ts`, `session-scope.test.ts` und `lib/db/account-isolation.test.ts`. Live bestätigt: `/api/trips` ohne Sitzung → 401.
- **Kein offener Zugangsweg** — `middleware.ts` gibt nur Anmeldung, Einladung, Ersteinrichtung, Health, Backups, Icon und den Karten-Worker frei; jeder dieser Pfade prüft seine Voraussetzungen selbst nach. Von 51 Routen unter `app/api/` prüfen 46 die Sitzung selbst, die fünf übrigen sind genau die Anmelde- und Health-Endpunkte. Live bestätigt auf beiden Umgebungen: `/plan` → 307 auf `/anmeldung`, `/ersteinrichtung` → 307 (die Umgebung ist nicht leer), `/einladung?token=abc` → 303 auf `/anmeldung?fehler=einladung`, `/api/backups` → 401.
- **Backup-Schnittstellen** — Auflisten, Herunterladen, Hochladen, Wiederherstellen und Löschen sind auf `session.superAdmin` beschränkt; der Deploy-Weg über `POST /api/backups` prüft den Token zeitkonstant und behandelt ein leeres Geheimnis wie ein fehlendes.
- **Einspielen eines Archivs ist gegen Zip-Slip abgesichert** — `lib/backup/import.ts:46` weist Namen mit Backslash, führendem `/` oder `..`-Segment ab und übernimmt überhaupt nur `datenbank`, `manifest` und Einträge unter `bilder/`; entpackt wird in ein temporäres Verzeichnis und erst danach umbenannt.
- **Kein Open Redirect** — `safeRedirectTarget` (`lib/auth/redirect-target.ts`) lässt nur Pfade innerhalb der Anwendung zu und fängt `//host`, `/\host` und Steuerzeichen ab.
- **Keine SQL-Injection** — alle Abfragen laufen parametrisiert. Die zwei Stellen mit Zeichenketten-Einsetzung sind sauber: `lib/backup/database.ts:182` setzt nur Namen aus der festen Liste `BACKUP_TABLES` ein und quotet sie, `lib/db/kostenzeilen.ts:221` setzt nur fest im Code stehende Spaltenzuweisungen zusammen.
- **Neuer Code seit dem letzten Bericht** — req-074 bis req-079 und bug-052 bis bug-059 sind ausschließlich Oberfläche. Die Kachel-Links (req-079) setzen eine frei eingegebene POI-Webseite unmittelbar in ein `href`; React 19 ersetzt `javascript:`-Adressen beim Rendern durch einen Fehler-Wurf, damit ist der Weg zu. Die Karten-Popups und -Marker bauen ihren Inhalt über `createElement` und `textContent`, nie über HTML.
- **Erreichbarkeit der Infrastruktur** — PostgreSQL ohne Portfreigabe, nur im Compose-Netz; die Anwendung bindet auf `127.0.0.1:${APP_PORT}`; nach außen ausschließlich der Cloudflare Tunnel. Entspricht der Vorgabe.
- **Rechte im Container** — `deploy/docker-entrypoint.sh` gibt die root-Rechte nach dem `chown` über `su-exec` sofort ab; die Anwendung läuft als `nextjs` (uid 1001).
- **Dateiablage** — Ablageort aus `randomUUID()`, nie aus dem hochgeladenen Namen; Dokumente und Fotos liegen außerhalb des ausgelieferten Teils der Anwendung und gehen nur über die geprüften Routen heraus. Live bestätigt: `/api/dokumente/<UUID>` ohne Sitzung → 401.
- **Health-Endpunkt** — öffentlich, aber ohne Datenbankzugriff und ohne Pfadangaben; live liefert er nur `{"status":"ok","bildablage":{"ok":true,"problem":null}}`.
- **CSRF** — Sitzungs-Cookie mit `httpOnly` und `SameSite=lax`, schreibende Zugriffe ausschließlich über POST/PUT/DELETE; ein eigenes Token ist damit nicht nötig.
- **Externe Dienste** — an OpenAI gehen Reise, POIs und Programmpunkte, keine Teilnehmer-Namen, -Adressen oder -Bankdaten. Google Places wird je Account über den dort hinterlegten Schlüssel abgefragt, ein Rückgriff auf einen fremden oder auf die Umgebungsvariable ist im Code ausgeschlossen.
- **prod-Deploy** — `deploy-prod.yml` hat keinen Push- oder Merge-Trigger, verlangt `workflow_dispatch` mit eingetippter Bestätigung und lässt Test-Suite und E2E vor Backup und Deploy laufen. Entspricht devops.md.

**Nicht geprüft:** Infrastruktur und Betriebszustand auf dem Beelink — in dieser Session war kein SSH-Zugang hinterlegt (`~/.ssh` ist leer), obwohl devops.md einen vorsieht. Die Erreichbarkeit wurde daher von außen über HTTP und HTTPS geprüft, alles Übrige aus Code und Konfiguration. Ob auf dem Beelink tatsächlich Backups liegen, ob die `env`-Dateien die Rechte 600 tragen, wie stark `AUTH_SECRET` gewählt ist, welche Cloudflare-Einstellungen aktiv sind und ob je eine Wiederherstellung durchgespielt wurde, ließ sich von hier aus nicht feststellen.
