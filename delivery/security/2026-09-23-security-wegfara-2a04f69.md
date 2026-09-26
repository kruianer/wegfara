---
type: security
repo: Wegfara
commit: 2a04f69
date: 2026-09-23
---

# Security: Wegfara (2a04f69)

Automatisch erstellt vom appbaua-Worker am 2026-09-23.

Prüfung abgeschlossen. Ich habe nichts im Repo verändert, nichts committet und nichts gepusht.

---

# Security-Check wegfara — 23.09.2026

## Kurz-Zusammenfassung

Geprüft wurde das IST des Repos (Branch `dev`, Stand `2a04f69`) gegen das SOLL aus [delivery/security.md](delivery/security.md), ergänzt um [delivery/devops.md](delivery/devops.md) und [delivery/stack.md](delivery/stack.md). Eine repo-spezifische Vorgabe lag also vor.

Der Kern der Anwendung ist sicherheitstechnisch auffällig gut gebaut: keine Secrets im Repo oder in der Historie, Anmelde-Token nur als SHA-256-Prüfsumme in der Datenbank, zeitkonstante Vergleiche, Zugangsschlüssel je Account mit AES-256-GCM aus einem Umgebungs-Geheimnis, keine Passwörter, Einladungslinks einmalig und serverseitig entwertet, PostgreSQL ohne Portfreigabe, Bilddateien außerhalb des ausgelieferten Teils der App, Anwendung im Container als unprivilegierter Benutzer.

Die Befunde liegen an den Rändern: **die HTTPS-Pflicht wird nicht durchgesetzt** (live verifiziert — beide Umgebungen liefern die vollständige App über unverschlüsseltes HTTP aus), **sechs bekannte Schwachstellen in den Abhängigkeiten, davon zwei kritische** (live verifiziert), **die Backup-Erwartung wird nicht erfüllt** (kein täglicher Lauf, kein Ziel außerhalb des Beelink), und **die Zugriffsgrenze im Code ist der Account, nicht die Reisegruppe** — Belege, Tickets und IBANs sind damit weiter sichtbar als die Vorgabe erlaubt.

9 Findings: 3 hoch, 3 mittel, 3 niedrig.

---

## Finding 1 — Beide Umgebungen liefern die App über unverschlüsseltes HTTP aus

**Schweregrad: hoch** · **live verifiziert**

security.md: *„HTTPS: Pflicht fuer beide Umgebungen … Kein unverschluesselter Zugriff, keine Zertifikatswarnung."*

IST, live geprüft:

```
http://app.wegfara.com/anmeldung   → 200, 9681 Bytes (vollständige Anmeldeseite)
http://dev.wegfara.com/anmeldung   → 200, 9681 Bytes
http://app.wegfara.com/api/health  → 200
Strict-Transport-Security          → nicht gesetzt (auf keiner der beiden Domains)
```

Es gibt weder eine Weiterleitung auf HTTPS noch HSTS. Cloudflares „Always Use HTTPS" ist offenbar nicht aktiv. Damit lässt sich die Anmeldeseite im offenen WLAN oder im Mobilnetz per SSL-Stripping abfangen und verändern — genau das Szenario, für das der Begleiter gebaut ist.

Verschärfend (aus dem Code erschlossen): `connectionIsSecure()` (`lib/auth/cookies.ts:34`) richtet sich nach `x-forwarded-proto`. Wird der Anmeldelink über HTTP geöffnet, löst `app/anmeldung/link/route.ts:55` ihn trotzdem ein und schreibt das Sitzungs-Cookie **ohne `Secure`-Flag** — das Token stand dann im Klartext in der URL und das Cookie geht danach bei jedem HTTP-Aufruf unverschlüsselt mit.

**Empfehlung:** In Cloudflare „Always Use HTTPS" und HSTS einschalten. Zusätzlich in der Anwendung absichern, damit der Schutz nicht allein an einer Einstellung außerhalb des Repos hängt: `Strict-Transport-Security` über `headers()` in `next.config.ts` setzen und in der `middleware.ts` jede Anfrage mit `x-forwarded-proto: http` auf HTTPS umlenken — das Einlösen des Anmeldelinks über HTTP sollte dabei ausdrücklich abgewiesen statt umgelenkt werden, damit kein Token über eine unverschlüsselte Leitung verbraucht wird.

---

## Finding 2 — Sechs bekannte Schwachstellen in den Abhängigkeiten, zwei davon kritisch

**Schweregrad: hoch** · **live verifiziert** (`npm audit` gegen die installierten `node_modules`)

| Paket | installiert | Schwere | Relevanz für wegfara |
| --- | --- | --- | --- |
| `next` | 16.2.12 | kritisch | GHSA-2xp9-vwfh-vxw4: unauthentifizierte RCE in der Image-Optimization-API über AVIF-Dateien. Die App nimmt Bild-Uploads entgegen — direkt einschlägig. (Das zweite kritische Advisory, GHSA-p293-qw3h-jr36, trifft nur Windows-Hosts und damit nicht den Beelink.) Fix in 16.3.3 |
| `maplibre-gl` | 6.0.0 | kritisch | GHSA-jrc7-96c5-q579, CVSS 10: XSS-Sanitizer-Bypass. Die Karte ist im Begleiter und im Planer im Einsatz |
| `nodemailer` | 9.0.5 | hoch | 4 Advisories, darunter zwei Umgehungen der Empfänger-Domain-Prüfung (IDN/Punycode, RFC-5322-Kommentare) — betrifft den Versand der Anmeldelinks, also den Wiederherstellungsweg ins Konto |
| `postcss` | 8.4.31 | hoch | Pfad-Traversal und Informationsabfluss über `sourceMappingURL` |
| `sharp` | 0.34.5 | hoch | geerbte libvips/libheif-Lücken — greift bei der Bildverarbeitung |
| `nanoid` | 3.3.16 | hoch | Endlosschleife bei Größe 0 (DoS) |

Alle Fixes liegen innerhalb der bereits deklarierten Caret-Ranges in `package.json`; ein `npm audit fix` genügt, ein Major-Sprung ist nicht nötig.

**Empfehlung:** `npm audit fix` ausführen, Test-Suite und E2E laufen lassen, über dev abnehmen. Danach eine wiederkehrende Prüfung einrichten (Dependabot/`npm audit` als Schritt im dev-Workflow), damit dieser Stand nicht wieder still veraltet.

---

## Finding 3 — Backup-Erwartung nicht erfüllt: kein täglicher Lauf, kein Ziel außerhalb des Beelink

**Schweregrad: hoch** · **aus Code/Config erschlossen**

security.md: *„Backup erwartet: ja. **Taeglich, automatisch** … Ziel: **ein zweites Ziel ausserhalb des Beelink**. Ein Backup, das nur auf derselben Maschine liegt, **gilt als nicht vorhanden**."*

IST:

- Ein Backup entsteht ausschließlich auf Zuruf — vom Gesamt-Admin über `POST /api/backups` oder vom prod-Deploy (`.github/workflows/deploy-prod.yml:67`). Es gibt keinen Zeitgeber dafür. In `instrumentation.ts` hängt nur die tägliche Dokument-Prüfung (`lib/documents/daily-audit.ts`); ein entsprechendes Gegenstück für Backups existiert nicht, und auch in `deploy/`, `scripts/` und `.github/` findet sich keine Cron- oder Timer-Einrichtung.
- Abgelegt wird nach `~/wegfara-backups/` auf dem Beelink selbst (`deploy/docker-compose.yml:92`). `GET /api/backups/[id]/herunterladen` (req-071) erlaubt eine Kopie nach außen — aber nur von Hand angestoßen.

Gemessen am eigenen SOLL gibt es damit derzeit **kein** Backup: der Verlust oder Diebstahl des Beelink nimmt Datenbank, Bilddateien und sämtliche Sicherungen in einem Zug mit.

**Empfehlung:** Zwei Schritte, beide klein: (a) einen täglichen Backup-Lauf wie die Dokument-Prüfung an die Anwendung hängen — derselbe Grund gilt hier wie dort, eine vergessene Cron-Zeile wäre die wahrscheinlichste Ursache für ein nie laufendes Backup; (b) einen automatischen Abzug auf ein zweites Ziel (All-Inkl per SFTP, externe Platte, Objektspeicher) — die Download-Schnittstelle aus req-071 liefert dafür bereits das fertige ZIP. Ergänzend die Wiederherstellung einmal echt durchspielen: `lib/backup/store.test.ts` und `lib/backup/import.test.ts` decken sie automatisiert ab, ein Rückspielen eines prod-Backups auf dev ist laut devops.md ausdrücklich vorgesehen und bisher nirgends dokumentiert erfolgt.

---

## Finding 4 — Zugriffsgrenze ist der Account, nicht die Reisegruppe

**Schweregrad: mittel** · **aus Code erschlossen**

security.md: *„Teilnehmer sehen nur Daten der Reisen, zu denen sie gehoeren"* und *„Belege und Tickets sind nur fuer Mitglieder der zugehoerigen Gruppe abrufbar — nie ueber eine erratbare oder oeffentlich teilbare URL."*

IST: Der Mandantenfilter greift überall sauber (`session.accountId`, nie aus der Anfrage) — aber er ist auch die einzige Grenze. Geprüft wird durchgängig „gehört zum Account", nicht „gehört zu dieser Reise":

- `lib/db/documents.ts:250` — `findDocumentFile` joint `trip` und filtert nur `t.account_id`. Wer eine Dokument-ID kennt, bekommt Beleg oder Ticket über `/api/dokumente/[id]`, auch ohne Teilnehmer der Reise zu sein.
- `app/api/bankverbindung/route.ts` — gibt die IBAN **jeder** Person des Accounts heraus, unabhängig von gemeinsamer Reise.
- Ebenso `app/api/poi-fotos/[id]`, `app/api/programmpunkte`, `app/api/kostenzeilen`, `app/api/ausgaben`.
- Teilnehmerbezogen ist allein `listTripsForSession` (`lib/db/trips.ts:130`) — die Reise**liste**. Die Daten darunter sind es nicht.

Der Kreis ist auf „Familie und Freunde einer Reisegruppe" begrenzt, der Angreifer wäre also eine bereits eingeladene Person — deshalb mittel und nicht hoch. Die Aussage der security.md ist aber eindeutig, und Reisen mit unterschiedlichen Teilnehmerkreisen im selben Account sind der Regelfall, nicht die Ausnahme.

**Empfehlung:** Die Prüfung auf Reise-Mitgliedschaft in den Datenzugriffs-Layer `lib/db/` ziehen — analog zu `tripBelongsToAccount`, aber als `participantIsInTrip(db, tripId, participantId)`, angewandt in denselben Abfragen, die heute nur nach Account filtern. Reiseleiter, Account-Admin und der in den Account gewechselte Gesamt-Admin bleiben davon ausgenommen. Ein Test analog zu `account-scope.test.ts`, nur eine Ebene tiefer, hält es fest.

---

## Finding 5 — Keine Sicherheits-Header, und der Content-Type hochgeladener Dateien wird geglaubt

**Schweregrad: mittel** · **live verifiziert** (Header) **/ aus Code erschlossen** (Upload-Prüfung)

Weder `next.config.ts` noch `middleware.ts` setzen Sicherheits-Header. Live bestätigt auf beiden Domains: kein `Strict-Transport-Security`, kein `Content-Security-Policy`, kein `X-Content-Type-Options`, kein `X-Frame-Options`, kein `Referrer-Policy`. Gesetzt wird ausschließlich `Cache-Control: no-store` (`middleware.ts:105`).

Das fällt hier stärker ins Gewicht als üblich, weil hochgeladene Dateien aus derselben Origin mit `Content-Disposition: inline` ausgeliefert werden (`app/api/dokumente/[id]/route.ts:44`) und der gespeicherte Content-Type aus der Angabe des Browsers bzw. der Dateiendung stammt (`lib/documents/validate.ts:72`) — der **Dateiinhalt wird nie geprüft**. Eine als `image/png` deklarierte Datei mit beliebigem Inhalt landet so unter der Anwendungs-Origin. Ohne `nosniff` ist das der klassische Weg zu gespeichertem XSS; mit gültiger Sitzung und ohne CSP als zweite Linie stünden Reisedaten und Belege offen.

**Empfehlung:** In `next.config.ts` eine `headers()`-Konfiguration ergänzen: `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Frame-Options: DENY` bzw. `frame-ancestors 'none'`. Zusätzlich die Magic Bytes der hochgeladenen Datei gegen den deklarierten Typ prüfen, bevor sie gespeichert wird — `documentUploadProblem` ist die richtige Stelle dafür.

---

## Finding 6 — Das zustandsabhängige Sitzungsende greift nur auf Seiten, nicht in den Schnittstellen

**Schweregrad: mittel** · **aus Code erschlossen**

security.md: *„eine Sitzung gilt, solange die Person mindestens einer Reise im Zustand ‚Freigegeben' zugeordnet ist oder eine offene Bewertung hat. **Trifft beides nicht mehr zu, endet sie beim naechsten Aufruf.**"*

IST: `sessionRemainsValid` (`lib/auth/session-access.ts`) wird ausschließlich über `requireTripAccess` aufgerufen, und das nur an drei Stellen — `app/go/page.tsx`, `app/plan/page.tsx`, `app/einladung/passkey/page.tsx`. Jede der 51 API-Routen prüft nur `currentSession()`, also allein die Gültigkeit des Tokens.

Eine Person, deren Reise auf „Abgeschlossen" gesetzt wurde, behält damit vollen Zugriff auf Reisedaten, Belege und Ausgaben über die Schnittstellen — bis zu 90 Tage, solange sie keine der drei Seiten aufruft. Der Kommentar in `current-session.ts:64` erkennt das Problem richtig („sonst bliebe sie ueber die Schnittstellen weiter benutzbar"), löst es aber nur für den Fall, dass eine Seite aufgerufen wird.

**Empfehlung:** Die Prüfung in einen gemeinsamen Guard für alle Schnittstellen mit Reisebezug ziehen (etwa `requireTripAccessApi()` neben `unauthorized()`/`forbidden()` in `lib/auth/api-guard.ts`), der bei negativem Befund die Sitzung genauso löscht und 401 liefert.

---

## Finding 7 — Standortdaten werden bei Reiseende nicht gelöscht

**Schweregrad: niedrig** · **aus Code erschlossen**

security.md: *„Positionen werden nur bei aktiver Reise und nur mit Zustimmung des Teilnehmers geteilt und **nach Reiseende geloescht**."*

IST: `trip_position` wird gelöscht, wenn der Teilnehmer das Teilen ausschaltet (`lib/db/trip-positions.ts:108`) oder wenn Reise, Person oder Account entfallen (`on delete cascade`, `migrations/0035_teilnehmer_position.sql`). Nach Reiseende passiert nichts — die letzte bekannte Position bleibt in der Datenbank stehen und wird lediglich nicht mehr angezeigt (`zeigtLiveStatus`, `sichtbarePositionen`).

Die Kernzusage der Vision hält: je Teilnehmer und Reise existiert höchstens eine Zeile, es entsteht kein Bewegungsprofil. Übrig bleibt ein einzelner veralteter Aufenthaltsort je Person und Reise, der laut Vorgabe längst weg sein sollte — und der in jedem Backup mitreist.

**Empfehlung:** Den täglichen Lauf aus `instrumentation.ts` um das Aufräumen erweitern: Positionen zu Reisen, deren Endedatum vorbei ist oder deren Zustand „Abgeschlossen" lautet, werden gelöscht.

---

## Finding 8 — dev und prod teilen sich das Backup-Verzeichnis

**Schweregrad: niedrig** · **aus Config erschlossen**

`deploy/docker-compose.yml:92` hängt `${HOME}/wegfara-backups` in **beide** Compose-Projekte ein. Ein Gesamt-Admin der dev-Umgebung kann damit prod-Backups auflisten, über `/api/backups/[id]/herunterladen` vollständig herunterladen und über `/api/backups/[id]/wiederherstellen` auf dev einspielen — also echte personenbezogene prod-Daten (Belege, IBANs, Kontaktdaten) in die Umgebung holen, die ohne Abnahme bei jedem Push automatisch neu deployt.

In devops.md ist das ausdrücklich so gewollt und begründet („ein prod-Backup laesst sich auf dev einspielen, um mit echten Daten zu pruefen"). Es steht aber gegen die Aussage im selben Dokument, dass dev und prod sich niemals Daten teilen, und macht die schwächer beachtete Umgebung zum Weg an prod-Daten. Ich führe es auf, weil es eine bewusste Entscheidung ist, die man kennen sollte — nicht, weil sie falsch wäre.

**Empfehlung:** Entweder so lassen und in security.md als bewusste Ausnahme festhalten (damit der Security-Task es künftig nicht erneut meldet), oder das dev-Backup-Verzeichnis trennen und den Weg von prod nach dev über den bewussten Download/Upload aus req-071 führen — der ist ohnehin vorhanden und hinterlässt eine Entscheidung statt eines stehenden Zugriffs.

---

## Finding 9 — Bremse nur beim Anfordern des Anmeldelinks

**Schweregrad: niedrig** · **aus Code erschlossen**

`createRateLimiter` wird genau einmal benutzt: in `app/api/auth/anmeldelink/route.ts`. Ohne Bremse bleiben die übrigen öffentlichen Endpunkte — das Einlösen des Anmeldelinks (`/anmeldung/link`), das Einlösen einer Einladung (`/einladung`), die Passkey-Anmeldung (`/api/auth/passkey/anmeldung`) und `POST /api/backups`.

Ein Erraten der Token ist praktisch ausgeschlossen: 256 Bit Zufall (`lib/auth/tokens.ts:15`), Vergleich über die SHA-256-Prüfsumme, Entwertung in der Bedingung des UPDATE. Es bleibt die unbegrenzte Last: jeder Versuch kostet eine Datenbankabfrage, und die Anwendung ist über den Tunnel aus dem ganzen Internet erreichbar.

**Empfehlung:** Denselben `createRateLimiter` je Quell-IP vor die öffentlichen Einlöse-Endpunkte hängen, oder — kostengünstiger und ohne Code — eine Rate-Limiting-Regel in Cloudflare für `/anmeldung/*`, `/einladung*` und `/api/auth/*`.

---

## Was geprüft wurde und in Ordnung war

- **Keine Secrets im Repo** — kein `.env` versioniert, `.gitignore` deckt `.env*` ab, keine Treffer für API-Key-, Token- oder Private-Key-Muster im Arbeitsbaum; eine Suche über alle 359 Commits der Historie nach `AUTH_SECRET=` blieb leer. Alle Zugangsdaten kommen aus `~/wegfara-env/*.env` außerhalb des Repos.
- **Anmelde-Geheimnisse** — Anmeldelinks, Sitzungs-Token und Zugangslinks liegen nur als SHA-256-Prüfsumme in der Datenbank, werden zeitkonstant verglichen (`lib/auth/tokens.ts`), Einlösen entwertet serverseitig in der `UPDATE`-Bedingung und ist damit auch gegen gleichzeitige Aufrufe dicht.
- **Zugangsschlüssel je Account** — AES-256-GCM, Schlüssel aus `AUTH_SECRET` mit eigenem Verwendungszweck abgeleitet, nie aus der Datenbank; ein Backup allein lässt sich nicht auswerten (`lib/secrets/encryption.ts`).
- **Deploy-Token** — `timingSafeEqual`, leeres Geheimnis zählt wie fehlend (`lib/backup/deploy-token.ts`).
- **Mandantentrennung** — der Account kommt durchgängig aus `session.accountId`, nie aus der Anfrage; belegt durch `account-scope.test.ts`, `session-scope.test.ts` und `lib/db/account-isolation.test.ts`.
- **Backup-Schnittstellen** — Auflisten, Herunterladen, Hochladen, Wiederherstellen und Löschen sind alle auf `session.superAdmin` beschränkt; Wiederherstellen verlangt zusätzlich ein eingetipptes Bestätigungswort und sperrt die App währenddessen.
- **Kein offener Zugangsweg** — `middleware.ts` gibt nur Anmeldung, Einladung, Ersteinrichtung, Health, Backups, Icon und den Karten-Worker frei; jeder dieser Pfade prüft seine Voraussetzungen selbst nach. Der Gastzugang aus req-038 ist restlos entfernt. Live bestätigt: `/` und `/plan` leiten ohne Sitzung auf `/anmeldung`.
- **Ersteinrichtung** — in GET **und** POST gegen eine leere `participant`-Tabelle geprüft, nicht nur in der Anzeige.
- **Erreichbarkeit der Infrastruktur** — PostgreSQL ohne Portfreigabe, nur im Compose-Netz; die Anwendung bindet auf `127.0.0.1:${APP_PORT}`; nach außen ausschließlich der Cloudflare Tunnel. Entspricht der Vorgabe.
- **Rechte im Container** — `deploy/docker-entrypoint.sh` gibt root-Rechte nach dem `chown` sofort ab, die Anwendung läuft als `nextjs`.
- **Dateiablage** — Ablageort aus `randomUUID()`, nie aus dem hochgeladenen Namen; `path.basename()` vor jedem Dateizugriff; Dateien liegen außerhalb des ausgelieferten Teils der Anwendung.
- **CSRF** — Sitzungs-Cookie mit `httpOnly` und `SameSite=lax`, schreibende Zugriffe ausschließlich über POST/PUT/DELETE; ein eigenes Token ist damit nicht nötig.
- **prod-Deploy** — `deploy-prod.yml` hat keinen Push- oder Merge-Trigger, verlangt `workflow_dispatch` mit eingetippter Bestätigung und lässt Test-Suite und E2E vor Backup und Deploy laufen. Entspricht devops.md.

**Nicht geprüft:** Infrastruktur und Betriebszustand auf dem Beelink — in dieser Session war kein SSH-Zugang hinterlegt. Die Erreichbarkeit wurde daher von außen über HTTP geprüft, alles Übrige aus Code und Konfiguration. Ob auf dem Beelink tatsächlich Backups liegen, ob die env-Dateien die Rechte 600 tragen und ob je eine Wiederherstellung durchgespielt wurde, ließ sich von hier aus nicht feststellen.
