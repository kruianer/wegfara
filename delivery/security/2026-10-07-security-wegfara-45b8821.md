---
type: security
repo: Wegfara
commit: 45b8821
date: 2026-10-07
---

# Security: Wegfara (45b8821)

Automatisch erstellt vom appbaua-Worker am 2026-10-07.

Prüfung abgeschlossen. Ich habe nichts im Repo verändert, nichts committet und nichts gepusht.

---

# Security-Check wegfara — 07.10.2026

## Kurz-Zusammenfassung

Geprüft wurde das IST des Repos (Branch `dev`, Stand `45b8821`) gegen das SOLL aus [delivery/security.md](delivery/security.md), ergänzt um [delivery/devops.md](delivery/devops.md), [delivery/stack.md](delivery/stack.md) und [CLAUDE.md](CLAUDE.md). **Eine repo-spezifische Sicherheits-Vorgabe lag vor** und ist ungewöhnlich detailliert — sie war für fast jeden Befund unten der Maßstab.

Der Kern der Anwendung ist weiterhin solide gebaut: keine Secrets im Repo und in 427 Commits Historie keine einzige `.env`-, `.pem`- oder Schlüsseldatei; Anmelde-Geheimnisse nur als SHA-256-Prüfsumme (`lib/auth/tokens.ts`), zeitkonstante Vergleiche; Zugangsschlüssel je Account mit AES-256-GCM aus einem Umgebungs-Geheimnis, zweckgebunden abgeleitet (`lib/secrets/encryption.ts`); PostgreSQL ohne Portfreigabe, App nur an `127.0.0.1` gebunden, nach außen ausschließlich über den Cloudflare Tunnel; Bild- und Dokumentdateien außerhalb des ausgelieferten Teils; der Container läuft als `nextjs` (uid 1001), nicht als root. 46 der 51 API-Routen prüfen die Sitzung selbst, die übrigen fünf sind die Anmelde- und Health-Endpunkte, die ihre Voraussetzungen jeweils selbst nachprüfen. Die Ersteinrichtung (`lib/auth/bootstrap.ts`) schließt sich nachweislich mit der ersten Person, in GET **und** POST.

**Live auf beiden Umgebungen bestätigt:** `/`, `/plan`, `/go`, `/mein-bereich` leiten ohne Sitzung auf `/anmeldung`; `/api/trips`, `/api/backups`, `/api/dokumente/<id>`, `/api/poi-fotos/<id>`, `/api/live-status`, `/api/positionen` antworten mit 401; `/ersteinrichtung` ist auf beiden Umgebungen zu; ein erfundener Einladungs-Token wird abgewiesen.

**Seit dem Bericht vom 30.09.2026 ist am Anwendungscode nichts geschehen.** `git diff 42b2d65..HEAD` umfasst drei Dateien, alle unter `delivery/` (Idee, Code-Review, der Security-Bericht selbst). Die 12 Findings von damals sind daher unverändert offen; bei den Abhängigkeiten hat sich die Lage ohne eigenes Zutun **verschlechtert** (6 → 7 verwundbare Pakete, `nodemailer` neu mit sieben Advisories).

Neu und schwerwiegend in diesem Lauf: **jede angemeldete Person kann sich über `POST /api/einladungen` zum Account-Admin machen** (Finding 1). Das ist keine Verschärfung eines alten Befundes, sondern ein eigener Weg, den ich bisher nicht beschrieben finde. Daneben bleiben die bekannten Schwerpunkte: **HTTPS wird nicht erzwungen**, **sieben bekannte Schwachstellen in den Abhängigkeiten (zwei kritisch)**, **die Backup-Erwartung wird nicht erfüllt**, und **die Zugriffsgrenze der Schnittstellen ist der Account, nicht die Reisegruppe**.

Gegenüber dem Vorbericht präzisiere ich Finding 4: die Positions- und Live-Status-Routen filtern **doch** nach Reisemitgliedschaft (`listTripsForSession`). Die sensibelsten Daten — Standorte — sind also korrekt eingegrenzt; die Lücke betrifft Dokumente und die schreibenden Reise-Routen.

**15 Findings: 4 hoch, 4 mittel, 7 niedrig.**

---

## Finding 1 — Jede angemeldete Person kann sich zum Account-Admin machen *(neu)*

**Schweregrad: hoch** · **aus Code erschlossen** (live nicht nachgestellt: das setzte ein echtes Konto und das Einlösen eines Links voraus, also eine Veränderung am Datenbestand — das war hier ausgeschlossen)

security.md: *„Er ist an genau eine Person gebunden: wer ihn einloest, wird zu ihr (req-023)."* — Genau das ist die Hebelwirkung. Die Kette ist dreigliedrig und jedes Glied steht im Repo:

1. **Die Kennungen liegen offen.** `listParticipants(pool, accountId)` (`lib/db/participants.ts:161`) liefert alle Personen des Accounts, und `COLUMNS` (Zeile 25) beginnt mit `id`. `app/plan/page.tsx:119` und `app/api/positionen/route.ts:41` geben diese Liste an jede Sitzung des Accounts heraus. Die UUID des Account-Admins ist damit keine Unbekannte.

2. **Das Erzeugen einer Einladung prüft keine Rolle.** `app/api/einladungen/route.ts:18-20`:
   ```ts
   const session = await currentSession();
   if (!session) return unauthorized();
   ```
   Danach geht es direkt in `createInvitation`. Dort (`lib/invitations/create-invitation.ts:31-39`) wird genau zweierlei geprüft: gehört die Person zu diesem Account, und ist sie *irgendeiner* Reise zugeordnet. **Es wird nicht geprüft, ob der Aufrufer Reiseleiter oder Account-Admin ist, und nicht, ob er mit der Zielperson überhaupt eine Reise teilt.** Zum Vergleich: `app/api/participants/route.ts` und `app/api/zugangsschluessel/route.ts` prüfen jeweils korrekt `if (!session.accountAdmin) return forbidden();`. Hier fehlt diese Zeile.

3. **Das Einlösen übernimmt die Identität samt Rechten.** `redeemAccessLink` (`lib/auth/login.ts:161-174`) ruft `consumeAccessLink`, dann `enableLogin`, dann `beginSession(db, participant, now)` — die Sitzung gehört danach der Zielperson, mit deren `accountAdmin`- bzw. `superAdmin`-Kennzeichnung.

Der Ablauf ist damit: eingeladenes Familienmitglied liest die Kennung des Account-Admins aus den Daten, die seine eigene Seite ohnehin bekommt, ruft `POST /api/einladungen` mit dieser Kennung auf, bekommt den Zugangslink im Klartext in der Antwort (`{ invitation }`, Status 201), öffnet ihn — und ist der Account-Admin. Damit stehen Personenverwaltung, Löschen von Personen und die hinterlegten Zugangsschlüssel offen. Ist der Gesamt-Admin irgendeiner Reise zugeordnet, trifft es ihn genauso; dann steht auch der Wechsel in fremde Accounts offen.

Zwei verschärfende Nebenwirkungen: `invalidateAccessLinks` entwertet dabei den zuletzt an die Zielperson ausgegebenen Link, und `enableLogin` setzt `login_enabled = true` — der Angriff verändert den Zustand des Opfers, und zwar auf einem Weg, den die Oberfläche nie anbietet.

**Empfehlung:** In `app/api/einladungen/route.ts` vor `createInvitation` prüfen, ob der Aufrufer berechtigt ist, für genau diese Person einzuladen — `session.accountAdmin` **oder** Reiseleiter einer Reise, der die Zielperson angehört (dieselbe Bedingung, die `darfPlanen` in `app/plan/page.tsx:95` schon für die Sichtbarkeit des Planers auswertet; sie steht als Regel bereits bereit). Zusätzlich sollte `createInvitation` die Berechtigung des Aufrufers als Parameter verlangen, statt sie dem Aufrufer zu überlassen — dann kann ein künftiger zweiter Aufrufer sie nicht wieder vergessen. Einen Test nach dem Muster von `keine-selbstregistrierung.test.ts` dazu: *eine Person ohne Leiterrolle bekommt für eine fremde Person keine Einladung.*

---

## Finding 2 — HTTPS-Pflicht nicht durchgesetzt; über HTTP setzt die App Cookies ohne `Secure`

**Schweregrad: hoch** · **live verifiziert** · *unverändert offen seit dem Bericht vom 23.09.2026 (dritter Lauf)*

security.md: *„HTTPS: Pflicht fuer beide Umgebungen … Kein unverschluesselter Zugriff, keine Zertifikatswarnung."*

IST, heute live geprüft:

```
http://app.wegfara.com/anmeldung   → 200, 9681 Bytes (vollständige Anmeldeseite, keine Weiterleitung)
http://dev.wegfara.com/anmeldung   → 200, 9681 Bytes
http://app.wegfara.com/api/health  → 200
http://dev.wegfara.com/api/health  → 200
Strict-Transport-Security          → auf keiner der beiden Domains gesetzt (http und https)
```

Die Folge, dieselbe Anfrage an dieselbe Adresse einmal über HTTP und einmal über HTTPS:

```
POST http://dev.wegfara.com/api/auth/passkey/anmeldung
  → set-cookie: wegfara_webauthn=; Path=/; Max-Age=0; HttpOnly; SameSite=lax
POST https://dev.wegfara.com/api/auth/passkey/anmeldung
  → set-cookie: wegfara_webauthn=; Path=/; Max-Age=0; Secure; HttpOnly; SameSite=lax
```

Über HTTP fehlt `Secure`. Das ist das vorgesehene Verhalten von `connectionIsSecure()` (`lib/auth/cookies.ts:34`) — es richtet sich nach `x-forwarded-proto`, und Cloudflare reicht bei einem HTTP-Aufruf eben `http` durch. Für den Challenge-Cookie ist das harmlos; für das **Sitzungs-Cookie** nicht: wird der Anmeldelink über HTTP geöffnet, löst `app/anmeldung/link/route.ts` ihn trotzdem ein und schreibt die Sitzung ohne `Secure` — das Token stand dann im Klartext in der URL, und das Cookie geht danach bei jedem HTTP-Aufruf unverschlüsselt mit. Dasselbe gilt für die Verlängerung in `middleware.ts:91`. Für das Einlösen einer Einladung (`app/einladung/route.ts:53`) gilt es ebenso.

Ohne Weiterleitung und ohne HSTS lässt sich die Anmeldeseite im offenen WLAN oder im Mobilnetz per SSL-Stripping abfangen und verändern — genau das Szenario, für das der Begleiter gebaut ist.

**Empfehlung:** In Cloudflare „Always Use HTTPS" und HSTS einschalten. Zusätzlich in der Anwendung absichern, damit der Schutz nicht allein an einer Einstellung außerhalb des Repos hängt: `Strict-Transport-Security` über `headers()` in `next.config.ts` setzen (siehe Finding 6, dieselbe Stelle) und in `middleware.ts` jede Anfrage mit `x-forwarded-proto: http` auf HTTPS umlenken. Das Einlösen eines Anmelde- oder Einladungslinks über HTTP sollte dabei ausdrücklich **abgewiesen** statt umgelenkt werden, damit kein Token über eine unverschlüsselte Leitung verbraucht wird.

---

## Finding 3 — Sieben bekannte Schwachstellen in den Abhängigkeiten, zwei davon kritisch

**Schweregrad: hoch** · **live verifiziert** (`npm audit` gegen die installierten `node_modules`) · *offen seit dem 23.09.2026, seither verschlechtert*

| Paket | installiert | Fix in | Schwere | Relevanz für wegfara |
| --- | --- | --- | --- | --- |
| `next` | 16.2.12 | 16.3.3 | **kritisch** | Drei RCE-Advisories: Pfad-Traversal auf Windows-Hosts (CVSS 9,0; hier nicht einschlägig — der Beelink ist Linux), RCE in der Image-Optimization-API bei AVIF, RCE in `next/og`. Die beiden letzten sind plattformunabhängig. |
| `maplibre-gl` | 6.0.0 | 6.13.0 | **kritisch** | XSS-Sanitizer-Bypass in `DOM.sanitize()`, **CVSS 10,0**. Die Karte ist der Mittelpunkt von Planer und Begleiter; POI-Namen und -Texte kommen aus Nutzereingaben und aus Google. |
| `nodemailer` | 9.0.5 | 10.0.6 | hoch | **neu seit dem letzten Lauf**, sieben Advisories: u. a. Zustellung an eine angreiferkontrollierte Domain über IDN/Punycode- und RFC-5322-Kommentar-Fehlparsing, und Offenlegung von SMTP-Zugangsdaten über den prozessglobalen DNS-Cache. Betrifft unmittelbar den Versand der Anmelde- und Einladungslinks — also den Weg, auf dem Zugänge verschickt werden. |
| `sharp` | transitiv (`next`) | 0.35.5 | hoch | Geerbte libvips-, libheif- und librsvg-Lücken. Erreichbar über die Bildverarbeitung; die App nimmt HEIC/HEIF-Uploads an (`lib/documents/validate.ts`). |
| `postcss` | transitiv (`next`) | 8.5.23 | hoch | XSS über unescaptes `</style>`, Pfad-Traversal und Offenlegung beliebiger `.map`-Dateien über `sourceMappingURL`. Primär Bauzeit. |
| `source-map-js` | transitiv | > 1.2.1 | hoch | DoS der Event-Loop. Primär Bauzeit. |
| `nanoid` | transitiv | 3.3.18 | hoch | Endlosschleife bei Größe 0. |

`npm audit` meldet für alle sieben `fix available`. Bei `nodemailer` bedeutet das einen Hauptversionssprung 9 → 10; `next` und `maplibre-gl` lassen sich innerhalb ihrer Hauptversion beheben.

**Empfehlung:** `npm audit fix` für `next` (→ ≥ 16.3.3), `maplibre-gl` (→ 6.13.0), `postcss`, `sharp`, `source-map-js` und `nanoid` — das sind verträgliche Sprünge. `nodemailer` auf 10.x gesondert heben und den Versand danach einmal über `/api/auth/anmeldelink` auf dev prüfen. Anschließend `npm test`, `npm run types` und `E2E_CHROMIUM_PATH=/usr/bin/chromium npm run test:e2e`, besonders die Kartenpfade. Dass dieser Befund im dritten Lauf unverändert dasteht, spricht für einen festen Platz im Arbeitsablauf: ein `npm audit --audit-level=high` als Schritt in `deploy-dev.yml` macht eine neue Lücke beim nächsten Push sichtbar, statt erst beim nächsten Security-Lauf.

---

## Finding 4 — Zugriffsgrenze der Schnittstellen ist der Account, nicht die Reisegruppe

**Schweregrad: hoch** · **aus Code erschlossen** · *offen seit dem 23.09.2026, hier präzisiert*

security.md: *„Teilnehmer sehen nur Daten der Reisen, zu denen sie gehoeren."* und *„Belege und Tickets sind nur fuer Mitglieder der zugehoerigen Gruppe abrufbar."*

Die Seiten halten das ein: `app/plan/page.tsx` und `app/go/page.tsx` holen über `listTripsForSession` nur die Reisen der angemeldeten Person und filtern alles Weitere mit `forVisibleTrips` dagegen. **Die Schnittstellen tun das nicht.** Ich habe alle 51 Routen durchgesehen; nach Reisemitgliedschaft filtern genau drei:

```
app/api/positionen/route.ts      → listTripsForSession ✓
app/api/live-status/route.ts     → listTripsForSession ✓
app/api/position-teilen/route.ts → listTripsForSession ✓
```

Alle übrigen prüfen ausschließlich `session.accountId`. Daraus ergeben sich für jede angemeldete Person des Accounts drei belegbare Wege:

- **`GET /api/dokumente/<id>`** — `findDocumentFile` (`lib/db/documents.ts:262`) filtert mit `join trip t … where d.id = $1 and t.account_id = $2`. Ein Beleg oder Ticket aus einer Reise, zu der die Person nicht gehört, wird ausgeliefert. Das widerspricht dem Satz zu Belegen und Tickets wörtlich. Die Kennungen sind nicht zu raten, aber `listDocuments(pool, accountId)` gibt sie an die Seite heraus.
- **`PATCH` / `DELETE /api/trips`** — `updateTrip`, `setTripState`, `deleteTrip` prüfen nur `account_id = $2`. Keine Rollenprüfung. Jede angemeldete Person kann jede Reise des Accounts umbenennen, freigeben, zurücknehmen oder löschen — `deleteTrip` (`lib/db/trips.ts:312-352`) räumt dabei Dokumente, Kostenzeilen, Transfers, POIs und Fotos mit weg.
- **`PUT /api/trip-participants`** — `assignTripParticipant` prüft nur den Account. Eine Person kann sich selbst jeder Reise des Accounts zuordnen, in der Rolle `leiter`, und sich damit die Mitgliedschaft verschaffen, die ihr fehlt.

Es gibt Rollen (`isTripRole`, `lib/trip-participants/rules.ts`), und `darfPlanen` wertet sie für die Sichtbarkeit des Planers aus — aber **keine einzige API-Route prüft eine Rolle**, außer `accountAdmin`/`superAdmin` in `participants`, `zugangsschluessel`, `accounts` und `backups`.

Solange ein Account eine Familie ist, ist der Schaden begrenzt. Der Satz in security.md ist aber nicht als „solange es nur eine Reise gibt" formuliert, und dieselbe Begründung, die dort zum Mandantenfilter steht, gilt hier: *„er faellt erst auf, wenn es zu spaet ist."*

**Empfehlung:** Eine gemeinsame Stelle nach dem Muster von `lib/auth/session-access.ts` einziehen — `tripAccessibleForSession(db, session, tripId)`: wahr für `actingAccount`, für `accountAdmin` und für eine Zuordnung in `trip_participant`; schreibend zusätzlich die Leiterrolle verlangen. Dann jede Route, die heute `tripBelongsToAccount` oder einen rohen `account_id`-Filter nutzt, darüber führen. Dazu einen Test im Stil von `account-scope.test.ts`, der über die Quellen wacht: *keine Route unter `app/api` nimmt eine `tripId` aus der Anfrage, ohne sie durch diese Funktion zu schicken.* Das hielte die Grenze auch dann, wenn später eine Route dazukommt.

---

## Finding 5 — Backup-Erwartung nicht erfüllt: kein täglicher Lauf, kein Ziel außerhalb des Beelink

**Schweregrad: mittel** · **aus Code und Config erschlossen** (ohne SSH-Zugang zum Beelink nicht live prüfbar — siehe Hinweis am Ende) · *offen seit dem 23.09.2026*

security.md verlangt dreierlei: *„Taeglich, automatisch"*, *„ein zweites Ziel ausserhalb des Beelink. Ein Backup, das nur auf derselben Maschine liegt, gilt als nicht vorhanden"*, und *„Wiederherstellung: muss getestet sein."*

IST:

- **Täglich, automatisch: nein.** Ich finde im Repo keinen Zeitplan — kein Cron, kein `schedule:` in `.github/workflows/`, keinen Timer. `.github/workflows/deploy-dev.yml` läuft auf `push`, `deploy-prod.yml` auf `workflow_dispatch`. Gesichert wird nur an zwei Stellen: von Hand durch den Gesamt-Admin, und einmal vor jedem prod-Deploy (`deploy-prod.yml:80-82`). Letzteres erfüllt die Vorgabe aus devops.md, nicht die tägliche aus security.md. Zwischen zwei prod-Deploys kann beliebig viel Zeit liegen.
- **Zweites Ziel außerhalb des Beelink: nein.** `deploy/docker-compose.yml` bindet `${HOME}/wegfara-backups:/data/backups` — ein Verzeichnis auf derselben Maschine, auf der auch die Datenbank liegt. Nach dem eigenen Maßstab von security.md gilt das Backup damit als nicht vorhanden. Ein Festplattenausfall oder ein verlorener Beelink nimmt Daten und Sicherung zusammen mit.
- **Wiederherstellung getestet: im Repo nachweisbar nur als Code.** `lib/backup/import.ts` ist getestet (`import.test.ts`), und es gibt `/api/backups/[id]/wiederherstellen`. Ein Nachweis, dass je ein echtes Backup zurückgespielt wurde, liegt nicht vor.

Der Code selbst ist gut: DB-Inhalt und Bilddateien gehen in einem Lauf (`lib/backup/store.ts`), jedes Backup trägt seine Umgebung bei sich, und das Einspielen ist gegen Zip-Slip abgesichert.

**Empfehlung:** Einen täglichen Lauf einrichten, der dieselbe Schnittstelle nutzt wie der Deploy — ein `schedule`-Workflow oder ein systemd-Timer auf dem Beelink, der `POST /api/backups` mit dem `x-wegfara-deploy`-Kopf aufruft; die Funktion ist fertig, es fehlt nur der Auslöser. Danach die fertigen Archive aus `~/wegfara-backups/` auf ein zweites Ziel schieben (`rclone`/`restic` auf den All-Inkl-Speicher, der ohnehin für SMTP da ist, oder eine externe Platte). Und einmal eine Wiederherstellung auf dev mit einem echten prod-Backup durchspielen — dafür ist das gemeinsame Verzeichnis ausdrücklich gedacht — und das Ergebnis in `delivery/devops.md` festhalten, damit die Vorgabe „muss getestet sein" belegt ist.

---

## Finding 6 — Keine Sicherheits-Header

**Schweregrad: mittel** · **live verifiziert** · *offen seit dem 23.09.2026*

Auf beiden Umgebungen fehlt über HTTP und HTTPS jeder der folgenden Header, auf allen geprüften Pfaden (`/`, `/anmeldung`, `/plan`, `/go`, `/api/*`):

```
Content-Security-Policy    → nicht gesetzt
Strict-Transport-Security  → nicht gesetzt
X-Frame-Options            → nicht gesetzt
X-Content-Type-Options     → nicht gesetzt
Referrer-Policy            → nicht gesetzt
```

`next.config.ts` enthält keinen `headers()`-Eintrag. Gesetzt wird einzig `Cache-Control: no-store` durch `middleware.ts:105` — das ist korrekt und wirkt (live bestätigt), deckt aber einen anderen Zweck ab.

Das wiegt hier mehr als in einer durchschnittlichen App, weil zwei Risiken darauf treffen: die kritische XSS-Lücke in `maplibre-gl` (Finding 3) hätte mit einer CSP eine zweite Hürde, und ohne `X-Frame-Options`/`frame-ancestors` lässt sich die Anmeldeseite in einen fremden Rahmen setzen. Ohne `Referrer-Policy` kann ein angeklickter POI-Link die aufrufende Adresse mitnehmen; Anmelde- und Einladungslinks tragen ihr Token in der Query.

**Empfehlung:** `headers()` in `next.config.ts` ergänzen: `Strict-Transport-Security: max-age=31536000; includeSubDomains`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Frame-Options: DENY`. Die CSP braucht wegen der Worker und `blob:`-Nutzung von MapLibre etwas Zuwendung — zunächst als `Content-Security-Policy-Report-Only` ausliefern, auf dev beobachten, dann scharf schalten.

---

## Finding 7 — Das zustandsabhängige Sitzungsende greift nur auf Seiten, nicht in den Schnittstellen

**Schweregrad: mittel** · **aus Code erschlossen** · *offen seit dem 23.09.2026*

security.md: *„eine Sitzung gilt, solange die Person mindestens einer Reise im Zustand ‚Freigegeben' zugeordnet ist oder eine offene Bewertung hat. Trifft beides nicht mehr zu, endet sie beim naechsten Aufruf."*

`sessionRemainsValid` (`lib/auth/session-access.ts`) ist genau das und ist richtig umgesetzt, einschließlich der bewussten Ausnahmen für Reiseleiter, Account- und Gesamt-Admin. Aufgerufen wird es aber nur aus `requireTripAccess` (`lib/auth/current-session.ts:62`), und das nutzen drei Seiten: `app/plan/page.tsx`, `app/go/page.tsx`, `app/einladung/passkey/page.tsx`. Alle 46 API-Routen nutzen `currentSession()` — die prüft Token und Ablaufdatum, nicht den Zustand.

Wessen Reise abgeschlossen ist, kommt damit nicht mehr auf `/go`, behält aber ein 90 Tage gültiges Sitzungs-Cookie, mit dem `GET /api/dokumente/<id>`, `/api/trips` und die übrigen Routen weiter antworten. Der Kommentar in `requireTripAccess` nennt die Absicht selbst — *„Die Sitzung endet wirklich, nicht nur diese Anfrage — sonst bliebe sie ueber die Schnittstellen weiter benutzbar"* — aber der Löschvorgang wird nur erreicht, wenn die Person eine der drei Seiten aufruft. Tut sie das nie wieder, bleibt die Sitzung bestehen.

**Empfehlung:** Die Prüfung in `currentSession()` ziehen oder in eine Variante `requireApiSession()`, die alle Datenrouten verwenden — die Anmelde-, Abmelde- und Passkey-Routen ausgenommen, weil diese Seiten ausdrücklich auch ohne Reise gelten müssen. Der Mehraufwand sind drei kleine Abfragen je Anfrage; `sessionRemainsValid` steigt früh aus, sobald eine zutrifft.

---

## Finding 8 — Der Content-Type hochgeladener Dateien wird geglaubt und `inline` ausgeliefert

**Schweregrad: mittel** · **aus Code erschlossen**

`documentContentType` (`lib/documents/validate.ts`) nimmt zuerst, was der Browser meldet (`if (isAllowedDocumentType(declared)) return declared;`), und fällt nur ersatzweise auf die Dateiendung zurück. Der Inhalt wird nie angesehen — keine Magic-Byte-Prüfung. Gespeichert wird dieser Wert, und `app/api/dokumente/[id]/route.ts` liefert ihn später unverändert als `Content-Type` wieder aus, zusammen mit `Content-Disposition: inline`.

Wer `POST /api/dokumente` mit `type: "image/png"` und beliebigem Inhalt aufruft, bekommt eine Datei, die die App später unter ihrer eigenen Herkunft im Browser anzeigt. Ohne `X-Content-Type-Options: nosniff` (Finding 6) und ohne CSP ist der Weg zu aktivem Inhalt im Kontext der Anwendung kurz; dass die Datei nur Mitgliedern des Accounts zugänglich ist (und laut Finding 4 sogar reiseübergreifend), macht sie als Köder innerhalb der Gruppe brauchbar. Positiv: der Dateiname bestimmt nie den Ablageort (`documentName` schneidet Pfadanteile ab, req-034 ist hier ausdrücklich eingehalten).

**Empfehlung:** Beim Ablegen die ersten Bytes gegen die erlaubten Signaturen prüfen (`%PDF-`, PNG-, JPEG-, WebP-, HEIF-Magic) und bei Abweichung abweisen — der erklärte Typ sollte höchstens den Verdacht liefern, nie das Ergebnis. Beim Ausliefern `X-Content-Type-Options: nosniff` setzen und für alles außer PDF und Bilder `Content-Disposition: attachment` verwenden.

---

## Finding 9 — Standortdaten werden bei Reiseende nicht gelöscht

**Schweregrad: niedrig** · **aus Code erschlossen** · *offen seit dem 23.09.2026*

security.md: *„Positionen werden nur bei aktiver Reise und nur mit Zustimmung des Teilnehmers geteilt und nach Reiseende geloescht."*

Die ersten beiden Teile sind erfüllt, und besser als verlangt: `trip_position` hat einen zusammengesetzten Primärschlüssel über `(trip_id, participant_id)`, jede Messung überschreibt die vorherige — es entsteht nachweislich keine Historie (`migrations/0035_teilnehmer_position.sql`). `zeigtLiveStatus` und `sichtbarePositionen` begrenzen die Anzeige auf Zeitraum und Frische, und `/api/positionen` filtert korrekt nach Reisemitgliedschaft.

Der dritte Teil fehlt. `deleteTripPosition` wird genau einmal aufgerufen: aus `lib/db/position-sharing.ts:55`, wenn jemand „Meine Position teilen" ausschaltet. Beim Wechsel des Reisezustands (`setTripState`) passiert mit den Positionen nichts. Gelöscht werden sie darüber hinaus nur, wenn die Reise selbst gelöscht wird — dann über `on delete cascade`. Die letzte bekannte Position jedes Teilnehmers bleibt also nach Reiseende auf unbestimmte Zeit in der Datenbank und in jedem Backup.

Begrenzt bleibt der Schaden, weil es je Person und Reise genau ein Koordinatenpaar ist.

**Empfehlung:** In `setTripState` beim Übergang in einen abgeschlossenen Zustand die Positionen der Reise löschen — ein `delete from trip_position where trip_id = $1`, gern in derselben Transaktion. Alternativ ein Aufräumschritt in der täglichen Prüfung, die `lib/documents/daily-audit.ts` schon anstößt.

---

## Finding 10 — Bremse nur beim Anmeldelink; die kostenpflichtigen Endpunkte sind ungedrosselt

**Schweregrad: niedrig** · **aus Code erschlossen** · *offen seit dem 23.09.2026*

`createRateLimiter` wird genau einmal verwendet: in `app/api/auth/anmeldelink/route.ts`. Drei Links pro Stunde und Konto, und das Überschreiten ändert die Antwort nicht — gut gelöst, bis hin zu dem Detail, dass sich daran keine bekannte Adresse ablesen lässt.

Ohne Bremse sind:

- **`POST /api/auth/passkey/anmeldung`** und **`GET /einladung?token=…`** — bei 256 Bit Zufall (`createToken`) ist Raten aussichtslos, aber beide lösen je Aufruf Datenbankarbeit aus.
- **Die kostenpflichtigen Routen**: `/api/ki-planung`, `/api/poi-search`, `/api/poi-ki-bild`, `/api/poi-beschreibung`, `/api/poi-vervollstaendigen`, `/api/place-search`, `/api/ort-aus-link`. Jede prüft korrekt die Sitzung und rechnet über den Zugangsschlüssel des Accounts ab (req-028) — aber jede angemeldete Person kann sie in Schleife aufrufen und das OpenAI- bzw. Google-Guthaben des Accounts verbrauchen. Der Kommentar in `ort-aus-link/route.ts:22` nennt das Risiko selbst: *„Die Abfrage bei Google kostet Geld."* Bei einem Zugriffskreis aus Familie und Freunden ist das eher Unfall- als Angriffsszenario — ein versehentlich wiederholter Aufruf in der Oberfläche genügt.

**Empfehlung:** Denselben `createRateLimiter` auf die zahlenden Routen legen, gestaffelt je Account und Person (etwa 30 KI-Aufrufe pro Stunde und Person). Da je Umgebung genau eine Instanz läuft, genügt der Zähler im Arbeitsspeicher weiterhin — die Begründung in `lib/auth/rate-limit.ts` trägt auch hier.

---

## Finding 11 — `AUTH_SECRET` trägt zwei Rollen, und seine Stärke wird nie geprüft

**Schweregrad: niedrig** · **aus Code erschlossen** · *offen seit dem 30.09.2026*

`AUTH_SECRET` ist zugleich (a) die Quelle, aus der `secretEncryptionKey()` den AES-256-GCM-Schlüssel für die Zugangsschlüssel der Accounts ableitet (`lib/secrets/encryption.ts:47`), und (b) das Deploy-Token, das `deployTokenMatches()` beim Backup-Aufruf vergleicht (`lib/backup/deploy-token.ts`). Die Begründung ist im Code festgehalten und nachvollziehbar: *„Ein zweites Geheimnis waere ein zweiter Ort, an dem es verloren gehen kann."*

Der Preis davon: in `deploy-prod.yml:80` geht derselbe Wert als HTTP-Kopf über die Leitung (auf `127.0.0.1`, also nicht nach außen) und steht im Umfeld eines GitHub-Runners. Wer ihn dort abliest, kann damit nicht nur ein Backup anstoßen, sondern auch jeden hinterlegten Zugangsschlüssel aus einem Backup entschlüsseln.

Dazu prüft nichts, wie stark der Wert ist. `envGeheimnis("AUTH_SECRET")` behandelt leer wie fehlend (bug-032, korrekt), aber ein dreistelliges Geheimnis würde stillschweigend angenommen und ergäbe über `sha256` einen formal gültigen 256-Bit-Schlüssel.

**Empfehlung:** Die Zweckbindung, die `encryption.ts` über `PURPOSE` schon vorbildlich macht, auf das Deploy-Token ausdehnen: statt `AUTH_SECRET` selbst zu vergleichen, `sha256("wegfara:deploy:" + AUTH_SECRET)` — ein Wert, mit dem sich nichts entschlüsseln lässt, und ohne zweite Variable in der env-Datei. Zusätzlich beim Start eine Mindestlänge (32 Zeichen) prüfen und das Ergebnis über `/api/health` bzw. `instrumentation.ts` melden, damit eine schwach eingerichtete Umgebung sichtbar wird.

---

## Finding 12 — Kein `.dockerignore`, und die Container-Images hängen nur an Tags

**Schweregrad: niedrig** · **aus Config erschlossen** · *offen seit dem 30.09.2026*

`.dockerignore` existiert nicht (geprüft). `deploy/Dockerfile` macht im Builder `COPY . .` — in den Build-Kontext geht damit alles, was im Verzeichnis liegt: `.git/` mit der vollen Historie, `node_modules/`, `.next/`, `test-results/`, `delivery/` und ein eventuell lokal angelegtes `.env`. Das Laufzeit-Image ist davon nicht betroffen, weil die letzte Stufe gezielt aus `/app/.next/standalone` kopiert und `next.config.ts` den Quelltext zusätzlich aus der Ablaufverfolgung nimmt — die Zwischenstufen behalten es aber, und der Kontext wird bei jedem Build übertragen.

Dazu hängen die Basis-Images an beweglichen Tags: `postgres:17-alpine`, `node:22-alpine` und besonders `cloudflared:latest`. Letzteres ist der Dienst, der die Verbindung nach außen aufbaut; was dort beim nächsten `up -d --build` ankommt, ist nicht festgelegt.

**Empfehlung:** Ein `.dockerignore` mit `.git`, `node_modules`, `.next`, `test-results`, `playwright-report`, `delivery`, `.env*`, `tsconfig.tsbuildinfo`. Die Basis-Images auf Digests festnageln (`image: cloudflare/cloudflared@sha256:…`) und turnusmäßig bewusst heben, statt sie unbemerkt wandern zu lassen.

---

## Finding 13 — Abrufe bei externen Diensten ohne Zeitgrenze

**Schweregrad: niedrig** · **aus Code erschlossen** · *offen seit dem 30.09.2026*

In `lib/google/places-client.ts` stehen vier `fetch`-Aufrufe (Zeilen 207, 237, 304, 329) — keiner mit `signal` oder `AbortSignal.timeout`. `lib/ai/openai-client.ts` erzeugt den Client mit `maxRetries: 0`, aber ohne `timeout`. Besonders `resolveShortLink` (Zeile 237) ruft mit `redirect: "follow"` eine Adresse ab, die der Nutzer eingefügt hat.

Antwortet die Gegenseite nicht, bleibt die Anfrage hängen, bis Node von selbst aufgibt. Bei einer Instanz je Umgebung binden mehrere solche Anfragen die Verbindungen des Pools. `resolveShortLink` ist dabei zugleich eine abgeschwächte SSRF-Fläche: die Zieladresse kommt vom Nutzer. Entschärft wird das dadurch, dass `lookupPlaceFromGoogleLink` den Link vorher prüft und nur eine angemeldete Person des Accounts überhaupt dorthin kommt — ausgeschlossen ist es damit nicht.

**Empfehlung:** Allen externen Abrufen ein `signal: AbortSignal.timeout(8000)` mitgeben und dem OpenAI-Client ein `timeout`. Für `resolveShortLink` zusätzlich das Ziel auf die bekannten Google-Kurzlink-Domains einschränken und private Adressbereiche ausschließen, bevor abgerufen wird.

---

## Finding 14 — dev und prod teilen das Backup-Verzeichnis, und dev deployt bei jedem Push

**Schweregrad: niedrig** · **aus Config erschlossen** · *offen seit dem 23.09.2026*

`deploy/docker-compose.yml` bindet für **beide** Compose-Projekte dasselbe `${HOME}/wegfara-backups`. Der Kommentar nennt den Grund — ein prod-Backup soll sich auf dev einspielen lassen — und der Nutzen ist echt. Zugleich bedeutet es: der Gesamt-Admin der dev-Umgebung sieht über `GET /api/backups` die prod-Backups und kann sie über `/api/backups/[id]/herunterladen` holen. dev deployt laut `deploy-dev.yml` vollautomatisch bei jedem Push auf `dev`, ist über `dev.wegfara.com` öffentlich erreichbar und führt naturgemäß neueren, weniger erprobten Code.

Damit hängt der Schutz der Produktionsdaten am Zugangsschutz der Entwicklungsumgebung. Die Verschlüsselung der Zugangsschlüssel greift hier übrigens wie beabsichtigt: dev hat ein eigenes `AUTH_SECRET`, die Schlüssel aus einem prod-Backup bleiben dort unlesbar (`lib/secrets/encryption.ts`). Reisedaten, Belege, Tickets, IBANs und Positionen sind im Backup aber unverschlüsselt.

**Empfehlung:** Die Verzeichnisse trennen (`~/wegfara-backups/dev` und `~/wegfara-backups/prod`) und für den ausdrücklich gewünschten Fall den Weg über `POST /api/backups/hochladen` nutzen — die Funktion ist vorhanden, dann ist das Einspielen eine bewusste Handlung statt eines Dauerzustands. Mindestens sollte die Übersicht auf dev prod-Backups nicht zum Herunterladen anbieten.

---

## Finding 15 — IBAN, E-Mail und Telefonnummer aller Personen des Accounts gehen an den Planer

**Schweregrad: niedrig** · **aus Code erschlossen**

`listParticipants` liefert `email, phone, iban` mit (`COLUMNS`, `lib/db/participants.ts:25`), und `app/plan/page.tsx:119` gibt die Liste ungefiltert an `PlanView` — also an den Browser. Trip-bezogene Daten filtert dieselbe Seite sorgfältig über `visibleTripIds`/`forVisibleTrips`; bei den Personen fehlt diese Begrenzung.

Dem Begleiter ist genau das nicht passiert: `app/go/page.tsx:96` reduziert bewusst auf `{ id, name, nickname }`, mit dem Kommentar *„Telefonnummer und Bankverbindung gehen ihn nichts an (siehe delivery/security.md)"*. Die Absicht ist also klar formuliert und an einer Stelle umgesetzt, an der anderen nicht.

Entschärft wird es dadurch, dass `/plan` nur Reiseleitern und dem Account-Admin offensteht (`darfPlanen`). Es bleibt: ein Reiseleiter sieht die Bankverbindung von Personen, die ausschließlich zu Reisen anderer gehören. Zusammen mit Finding 1 wiegt es mehr, denn dort liefert dieselbe Liste die Kennung für die Eskalation.

**Empfehlung:** Auf `/plan` nur die Personen mit Kontaktdaten ausliefern, die zu einer für diese Sitzung sichtbaren Reise gehören; alle übrigen — soweit sie für die Verwaltung gebraucht werden — auf `{ id, name, nickname }` reduzieren, wie der Begleiter es tut. Die Kontaktdaten des gesamten Accounts gehören an die Personenverwaltung, die ohnehin `accountAdmin` verlangt.

---

## Was geprüft wurde und in Ordnung war

- **Secrets:** keine im Repo. Der Scan über `*.ts`, `*.tsx`, `*.mjs`, `*.sql`, `*.yml`, `*.json`, `*.sh` findet ausschließlich Testwerte (`"test-key"`, `"sk-test-a3f9"`, `"ein-sehr-langes-geheimnis"`) und das ausdrücklich als solches benannte `E2E_AUTH_SECRET` in `scripts/e2e.mjs`. In 427 Commits Historie wurde keine `.env`-, `.pem`-, `.key`- oder Schlüsseldatei je hinzugefügt. `.gitignore` deckt `.env`, `.env.local`, `.env*.local` ab. Alle echten Geheimnisse kommen über `${…}` aus `~/wegfara-env/<umgebung>.env` außerhalb des Repos — wie security.md es verlangt.
- **Erreichbarkeit:** die App ist an `127.0.0.1:${APP_PORT}` gebunden, der `db`-Service hat bewusst keine Portfreigabe, nach außen geht nur der Cloudflare Tunnel. Das Bildverzeichnis liegt als Host-Volume außerhalb des ausgelieferten Teils. Das entspricht dem SOLL *„Nur die Anwendung ist von aussen erreichbar"*.
- **Anmeldung:** Passkey als Standard mit `residentKey: "required"` und `userVerification: "required"`, nur der öffentliche Schlüssel wird gespeichert, Challenge fünf Minuten gültig, Anmeldelink 15 Minuten, Zugangslink sieben Tage und einmal verwendbar. Passwörter gibt es nicht. Notfallcodes sind restlos entfernt (`migrations/0046`). Der Gastzugang aus req-038 ist entfernt (`migrations/0033`).
- **Keine offene Registrierung:** die Ersteinrichtung existiert nur bei leerer `participant`-Tabelle, geprüft in GET und POST; live auf beiden Umgebungen zu (307 → `/anmeldung`). Es gibt einen Test, der genau darüber wacht (`lib/auth/keine-selbstregistrierung.test.ts`).
- **Mandantentrennung:** `account-scope.test.ts` liest die Quellen und verhindert, dass eine feste Account-Kennung über eine neue Datei zurückkommt; der Account kommt aus `session.accountId`, nie aus der Anfrage. Die beiden erlaubten Ausnahmen sind namentlich festgehalten und prüfen beide `superAdmin`. Der Wechsel in fremde Accounts wird protokolliert (`lib/db/account-switches.ts`).
- **Rollenprüfungen, wo sie da sind:** `/api/participants` (alle drei Methoden), `/api/zugangsschluessel`, `/api/accounts`, `/api/accounts/wechsel` und `/api/backups` prüfen `accountAdmin` bzw. `superAdmin` korrekt. `/api/backups` ist in der middleware öffentlich, prüft seine Voraussetzungen aber selbst und antwortet live mit 401.
- **Deploy-Token:** zeitkonstanter Vergleich, leer zählt wie nicht gesetzt.
- **prod deployt nie automatisch:** `deploy-prod.yml` verlangt `workflow_dispatch` plus getippte Bestätigung „deploy" und erstellt vorher ein Backup — wie devops.md es vorschreibt.
- **Container:** läuft als `nextjs` (uid 1001); das Einstiegsskript gibt seine root-Rechte über `su-exec` ab, nachdem es die Volumes übereignet hat, und nur dann, wenn die oberste Ebene nicht schon passt.
- **Positionen:** keine Historie durch den Primärschlüssel, Filter nach Reisemitgliedschaft in allen drei Positions-Routen, Freigabe durch das Vorhandensein der Zeile.
- **Dateinamen:** `documentName` schneidet Pfadanteile ab; der Name benennt die Datei, bestimmt nie den Ablageort. Das Einspielen eines Backups ist gegen Zip-Slip abgesichert.
- **Umleitungsziel der Anmeldung:** `lib/auth/redirect-target.ts` ist gegen Open Redirect abgesichert; live bestätigt (`/plan` → `/anmeldung?weiter=%2Fplan`).
- **Health-Endpunkt:** öffentlich, aber ohne Datenbankzugriff und ohne Pfadangaben — er sagt, dass etwas nicht stimmt, nicht wo.
- **An Google gehen keine Nutzerdaten:** Navigation nur als Link, wie vision.md es verlangt.

## Grenzen dieser Prüfung

- **Kein SSH-Zugang zum Beelink hinterlegt** (kein `~/.ssh`, keine Zugangsdaten im Repo). Nicht prüfbar waren damit: ob tatsächlich Backups in `~/wegfara-backups/` liegen und wie alt das jüngste ist, ob ein Cron-Eintrag außerhalb des Repos existiert, der tatsächliche Zustand der Container, die Router- und Firewall-Einstellungen sowie die Cloudflare-Konfiguration (Tunnel-Umfang, „Always Use HTTPS", HSTS, Access-Regeln). Die Findings 5 und 14 stützen sich deshalb auf Repo-Stand und das Fehlen eines Auslösers — ein Zeitplan außerhalb des Repos wäre mir entgangen.
- **Live geprüft wurde ausschließlich lesend und unangemeldet** — HTTP/HTTPS-Antworten, Weiterleitungen, Statuscodes, Header und Cookie-Flags auf `app.wegfara.com` und `dev.wegfara.com`. Finding 1 habe ich bewusst nicht nachgestellt: das hätte ein Konto und das Verbrauchen eines echten Zugangslinks erfordert, also einen Eingriff in den Datenbestand. Die Kette ist dafür im Code vollständig belegt (drei Fundstellen, oben benannt).
- **`npm audit`** lief gegen die installierten `node_modules` im Arbeitsverzeichnis. Welche Versionen auf dev und prod tatsächlich laufen, hängt am letzten Build; `package-lock.json` ist hier maßgeblich und wurde mit ausgewertet.
- Am Repo wurde nichts verändert, nichts committet und nichts gepusht.
