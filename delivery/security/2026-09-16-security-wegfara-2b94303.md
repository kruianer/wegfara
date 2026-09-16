---
type: security
repo: Wegfara
commit: 2b94303
date: 2026-09-16
---

# Security: Wegfara (2b94303)

Automatisch erstellt vom appbaua-Worker am 2026-09-16.

# Security-Check wegfara — 16.09.2026

## Kurz-Zusammenfassung

Geprüft wurde das IST des Repos und der laufenden dev-Umgebung gegen das SOLL aus `delivery/security.md` (repo-spezifische Vorgabe lag vor) sowie `delivery/devops.md` und `CLAUDE.md`. Am Repo wurde nichts verändert.

Der Aufbau ist in den zentralen Punkten solide: Mandantentrennung greift durchgängig (jede geprüfte Route zieht `accountId` aus der Sitzung, nie aus der Anfrage), Belege und Fotos gehen nur über sitzungsgeschützte Schnittstellen heraus und haben keine erratbare URL, Secrets liegen ausschließlich in Umgebungsvariablen (weder im Arbeitsbaum noch in 263 Commits Historie ein Fund), Zugangsschlüssel liegen AES-256-GCM-verschlüsselt, der Schlüssel wird aus `AUTH_SECRET` außerhalb der DB abgeleitet, PostgreSQL hat keine Portfreigabe, die App läuft unprivilegiert, und der Wechsel des Gesamt-Admins in fremde Accounts wird protokolliert.

Dem stehen **neun Abweichungen** gegenüber, davon vier mit hohem Schweregrad. Die gravierendste ist live verifiziert: **die dev-Umgebung liefert die vollständige Anwendung über unverschlüsseltes HTTP aus** — entgegen der ausdrücklichen HTTPS-Pflicht —, und Sitzungs-Cookies werden auf diesem Weg ohne `Secure`-Flag gesetzt. Ebenfalls hoch: die Backup-Erwartung aus `security.md` ist in zwei von drei Punkten nicht erfüllt (kein zweites Ziel außerhalb des Beelink, kein täglicher automatischer Lauf), und der Abhängigkeitsstand trägt zwei kritische und vier hohe bekannte Lücken.

Die prod-Umgebung (`app.wegfara.com`) war während der gesamten Prüfung nicht erreichbar (Cloudflare 530) und konnte deshalb nicht live geprüft werden — alle Aussagen zu prod sind aus Code und Config erschlossen.

---

## Finding 1 — HTTPS wird nicht erzwungen; Cookies ohne `Secure` über HTTP

**Schweregrad: hoch** · **live verifiziert**

`delivery/security.md` verlangt: *„HTTPS: Pflicht fuer beide Umgebungen … Kein unverschluesselter Zugriff, keine Zertifikatswarnung."*

Tatsächlich beantwortet die dev-Umgebung Klartext-HTTP vollständig, ohne Weiterleitung auf HTTPS:

```
http://dev.wegfara.com/anmeldung   -> 200  text/html   (kein Redirect)
http://dev.wegfara.com/api/health  -> 200  application/json
https://dev.wegfara.com/anmeldung  -> 200  (kein strict-transport-security-Header)
```

Die Folge ist unmittelbar an den Cookies ablesbar. `lib/auth/cookies.ts:41` leitet das `Secure`-Flag korrekt aus `x-forwarded-proto` ab — nur liefert Cloudflare bei einem HTTP-Aufruf eben `http`, und damit fällt das Flag weg:

```
über http:   wegfara_webauthn=…; Path=/; Max-Age=300; HttpOnly; SameSite=lax
über https:  wegfara_webauthn=…; Path=/; Max-Age=300; Secure; HttpOnly; SameSite=lax
```

Derselbe Pfad gilt für `wegfara_sitzung` (`middleware.ts:82`, `sessionCookieOptions(secure)`). Wer über HTTP in die App gelangt — ein untergeschobener Link, ein Downgrade im fremden WLAN, ein alter Lesezeichen-Eintrag —, bekommt eine Sitzung, die anschließend im Klartext über die Leitung geht. Die Vorgabe nennt zusätzlich den funktionalen Grund: ohne HTTPS gibt der Browser weder Standort noch Kamera frei, die App wäre unterwegs funktionsunfähig.

Ein HSTS-Header fehlt in beiden Fällen, damit gibt es auch keinen Schutz gegen den ersten Aufruf.

**Empfehlung:** In Cloudflare für beide Hostnamen *Always Use HTTPS* und *HSTS* (`max-age=31536000; includeSubDomains`) aktivieren — das ist der Ein-Klick-Teil und schließt die Lücke sofort. Zusätzlich in `middleware.ts` als Gürtel-und-Hosenträger: liegt `x-forwarded-proto` vor und ist ungleich `https`, mit 308 auf die `https`-Variante umleiten, statt die Antwort auszuliefern. Lokale Entwicklung über `http://localhost` bleibt davon unberührt, weil der Header dort gar nicht gesetzt ist.

---

## Finding 2 — Backup liegt ausschließlich auf dem Beelink

**Schweregrad: hoch** · **aus Code/Config erschlossen**

`delivery/security.md` ist hier unmissverständlich: *„Ziel: ein zweites Ziel ausserhalb des Beelink. Ein Backup, das nur auf derselben Maschine liegt, gilt als nicht vorhanden."*

Das IST kennt genau ein Ziel. `deploy/docker-compose.yml:92` hängt `${HOME}/wegfara-backups` nach `/data/backups` ein, `BACKUP_DIR` zeigt dorthin, `lib/backup/store.ts:36` bestätigt es im Kommentar. Eine Kopie nach außen gibt es nirgends: weder in `lib/backup/`, noch in `scripts/`, noch in den beiden Workflows unter `.github/workflows/`. Damit sind Datenbank, Bilddateien, Belege und Tickets an genau einen Datenträger gebunden — Plattendefekt, Diebstahl oder ein verschlüsselnder Schädling auf dem Beelink treffen Bestand und Sicherung gemeinsam.

Verschärfend: dev und prod teilen sich dieses eine Verzeichnis, es gibt also auch keine zweite Kopie „über Bande".

**Empfehlung:** Einen zweiten, außerhalb der Maschine liegenden Ablageort einrichten und nach jedem Backup-Lauf dorthin spiegeln — `restic` oder `rclone` auf Backblaze B2, S3 oder ein NAS. Zwingend clientseitig verschlüsselt, denn die Sicherung enthält personenbezogene Daten und Belege. Die Vorgabe ergänzen um die Frage, wie lange dort vorgehalten wird.

---

## Finding 3 — Kein täglicher automatischer Backup-Lauf

**Schweregrad: hoch** · **aus Code/Config erschlossen**

`delivery/security.md` erwartet: *„Backup erwartet: ja. Taeglich, automatisch, durch die Backup-Funktion der Anwendung."*

Die Backup-Funktion selbst ist da und gut gebaut (`lib/backup/store.ts`, `POST /api/backups`) — sie sichert DB und Bilddateien in einem zueinander passenden Lauf, genau wie verlangt. Ausgelöst wird sie aber nur auf zwei Wegen, und beide sind Ereignisse, keine Uhr:

- von Hand durch den Gesamt-Admin in der „Verwaltung" (`source: "von_hand"`),
- einmalig vor einem prod-Deploy (`.github/workflows/deploy-prod.yml:56`, `source: "vor_deploy"`).

Ein Zeitgeber fehlt. `instrumentation.ts:27` hängt beim Hochfahren ausschließlich `startDocumentAudit()` ein — den täglichen Abgleich von Dokument-Dateien und -Datensätzen aus req-034. Ein entsprechendes Gegenstück für das Backup gibt es nicht, ebenso wenig einen systemd-Timer oder eine Cron-Zeile in `deploy/` oder `scripts/`. Praktisch heißt das: wird weder deployt noch von Hand gesichert, altert der letzte Stand unbegrenzt. Die Vorgabe „täglich" ist damit eine Absichtserklärung, keine Eigenschaft des Systems.

**Empfehlung:** Denselben Weg gehen, den req-034 bereits vorzeichnet, und aus demselben Grund — `instrumentation.ts` begründet ihn treffend: *„eine vergessene Einrichtung waere sonst der wahrscheinlichste Grund, warum die Pruefung nie liefe."* Also einen `startDailyBackup()` analog zu `startDocumentAudit()` in `instrumentation.ts` einhängen, mit `source: "taeglich"` als drittem Wert in `BackupSource`, dazu eine Aufbewahrungsregel (`lib/backup/maintenance.ts` ist der passende Ort), damit das Verzeichnis nicht unbegrenzt wächst — `lowSpace` in `backupOverview` meldet die Enge heute nur, es räumt nicht.

---

## Finding 4 — Zwei kritische und vier hohe Lücken in den Abhängigkeiten

**Schweregrad: hoch** · **live verifiziert** (`npm audit --production`)

| Paket | installiert | Schwere | Kern |
| --- | --- | --- | --- |
| `next` | 16.2.12 | **kritisch** (2×) | RCE über die Image-Optimization-API bei AVIF-Dateien; RCE auf Windows-Hosts |
| `nodemailer` | 9.0.5 | hoch (4×) | Zustellung an angreiferkontrollierte Domain über IDN/Punycode- und RFC-5322-Kommentar-Umgehung; DoS im Adressparser |
| `sharp` | 0.34.5 | hoch (2×) | geerbte libvips-/libheif-Lücken (CVE-2026-33327/33328/35590/35591) |
| `postcss` | 8.4.31 | hoch (4×) | Pfad-Traversal und Dateileck über `sourceMappingURL` |

Zur Einordnung, denn nicht jede Lücke wiegt hier gleich schwer:

- Die **Windows-RCE** greift nicht — die App läuft in einem Alpine-Container (`deploy/Dockerfile`).
- Die **AVIF-RCE** ist abgeschwächt, aber nicht ausgeschlossen: der Optimierer ist von außen erreichbar (`middleware.ts:111` nimmt `_next/image` bewusst vom Matcher aus, die Adresse antwortet live), `remotePatterns` ist nicht konfiguriert (ein externer `url=`-Parameter wird mit 400 abgewiesen), und `next/image` wird im Anwendungscode nirgends verwendet. Die Angriffsfläche ist damit klein — der verwundbare Codepfad ist aber vorhanden und unauthentifiziert ansprechbar.
- **`nodemailer`** wiegt hier am schwersten, denn es verschickt die Anmeldelinks (req-016). Ein Anmeldelink ist ein Zugang zum Konto; eine Umgehung der Empfänger-Domain-Prüfung heißt im schlechtesten Fall, dass er bei jemand anderem landet.
- **`postcss`** wirkt nur zur Bauzeit und ist entsprechend nachrangig.

Bemerkenswert ist, dass `next` und `nodemailer` in `package.json` als `^16.2.12` bzw. `^9.0.5` stehen — ein `npm update` holt die Korrekturen also bereits, ohne dass eine Major-Grenze überschritten wird.

**Empfehlung:** `npm audit fix` ausführen, anschließend `npm test` und `npm run test:e2e` (Letzteres mit `E2E_CHROMIUM_PATH=/usr/bin/chromium`) als Nachweis, dass nichts gebrochen ist. `nodemailer` zuerst, das ist der Pfad mit echtem Missbrauchspotenzial. Mittelfristig Dependabot oder einen wöchentlichen `npm audit` in die dev-Action hängen — `delivery/stack.md` hält den Stand heute nur als Absicht fest, nicht als geprüfte Bedingung.

---

## Finding 5 — prod (`app.wegfara.com`) ist nicht erreichbar

**Schweregrad: mittel** · **live verifiziert**

Mehrfach über die Prüfung verteilt, über HTTP wie HTTPS, Wurzelpfad wie `/api/health`:

```
https://app.wegfara.com/           -> 530   (cf-ray a3bc61c11abef832-VIE)
https://app.wegfara.com/           -> 530   (cf-ray a3bc61c19f1fa0c4-VIE)
https://app.wegfara.com/api/health -> 530   Cloudflare-Fehlerseite
http://app.wegfara.com/            -> 530
```

Cloudflare-530 (Error 1033) bedeutet: die Kante steht, der Ursprung dahinter nicht. Der `cloudflared`-Container der prod-Umgebung hat keine Verbindung — entweder läuft er nicht, oder die App dahinter antwortet nicht. dev antwortet über denselben Mechanismus normal, das Problem ist also auf prod beschränkt und liegt nicht an Cloudflare.

Das ist zunächst ein Verfügbarkeitsbefund, hat hier aber zwei sicherheitsrelevante Seiten: `security.md` begründet die Erreichbarkeit von außen funktional (*„Der Begleiter muss unterwegs im Mobilnetz funktionieren"*) — eine unterwegs nicht erreichbare App verfehlt genau das. Und der Zustand fiel offenbar nicht auf, obwohl `/api/health` und der Compose-Healthcheck bereitstehen: es gibt niemanden, der sie von außen abfragt.

**Empfehlung:** Auf dem Beelink `docker compose -p wegfara-prod -f deploy/docker-compose.yml ps` und das Log des `cloudflared`-Containers ansehen; die häufigste Ursache ist ein abgelaufenes oder rotiertes `CLOUDFLARE_TUNNEL_TOKEN` in `~/wegfara-env/prod.env`. Danach eine Überwachung von außen auf `https://app.wegfara.com/api/health` einrichten (Cloudflare Health Checks oder Uptime Kuma), damit ein solcher Ausfall meldet statt zu warten.

---

## Finding 6 — dev kann prod-Backups einsehen und einspielen

**Schweregrad: mittel** · **aus Code/Config erschlossen**

`delivery/devops.md` hält fest: *„dev und prod teilen sich niemals Daten."* Für das Backup-Verzeichnis gilt das nicht, und zwar auf zwei Ebenen.

Die erste ist bewusst so entschieden und in `security.md` wie `devops.md` begründet: beide Container binden dasselbe `~/wegfara-backups` ein (`deploy/docker-compose.yml:92`), damit sich ein prod-Backup zum Prüfen mit echten Daten auf dev einspielen lässt.

Die zweite dürfte unbeabsichtigt sein. Die Backup-Funktion filtert an keiner Stelle nach Umgebung:

- `backupOverview(root, environment)` reicht `environment` nur als Beschriftung durch und listet über `listBackups(root)` **alle** Einträge des Verzeichnisses (`lib/backup/store.ts`),
- `findBackup(root, id)` prüft nur, ob die Kennung wohlgeformt ist und ein Manifest existiert — die Umgebung im Manifest wird gelesen, aber nicht gegen die eigene geprüft,
- `POST /api/backups/[id]/wiederherstellen` setzt darauf auf.

In der Oberfläche der dev-Instanz stehen damit die prod-Sicherungen, und sie lassen sich von dort mit einem Klick und dem Bestätigungswort einspielen. Zusammen mit Finding 1 ergibt das die eigentliche Verkettung: dev ist über unverschlüsseltes HTTP erreichbar und kann vollständige Produktionsdaten — Belege, Tickets, Kontaktdaten, Bankverbindungen — in die schwächer geschützte Umgebung holen. Die Schwelle ist eine Gesamt-Admin-Sitzung, also nicht niedrig; die Auswirkung im Fall der Fälle ist aber der volle Personendatenbestand.

**Empfehlung:** Das Teilen des Verzeichnisses beibehalten, den Zugriff darauf aber an der Umgebung ausrichten: `listBackups` und `findBackup` nach `manifest.environment` filtern, und das Einspielen einer fremden Umgebung nur nach einer eigenen, ausdrücklichen Bestätigung zulassen statt als stillen Normalfall. Alternativ je Umgebung einen Unterordner und den Quer-Zugriff zum bewussten Handgriff auf dem Host machen. In `devops.md` sollte anschließend stehen, welche der beiden Aussagen gilt — heute widersprechen sich „teilen sich niemals Daten" und „teilen es sich bewusst".

---

## Finding 7 — Standortdaten werden nach Reiseende nicht gelöscht

**Schweregrad: niedrig** · **aus Code/Config erschlossen**

`delivery/security.md` sagt zum Standort zu: *„Positionen werden nur bei aktiver Reise und nur mit Zustimmung des Teilnehmers geteilt und nach Reiseende geloescht."*

Der erste Teil ist sauber umgesetzt. Die Anzeige endet zuverlässig: `GET /api/live-status` gibt außerhalb des Zeitraums oder vor der Freigabe `OHNE_STANDORT` zurück, bevor überhaupt Positionen geladen werden. Es wird auch nur die letzte Position gehalten, es gibt keine Historie und kein Bewegungsprofil — wie vorgegeben.

Der zweite Teil fehlt. `deleteTripPosition` (`lib/db/trip-positions.ts:101`) hat genau einen Aufrufer: `lib/db/position-sharing.ts:55`, also den Widerruf durch den Teilnehmer selbst. Dazu kommt das `on delete cascade` beim Löschen der Reise. Der Übergang einer Reise nach `abgeschlossen` (`lib/trips/state.ts:16`) löst nichts aus. Eine Reise, die zu Ende geht, ohne dass jemand das Teilen abschaltet oder die Reise löscht, hinterlässt die letzte bekannte Position jedes Teilnehmers dauerhaft in `trip_position`.

Die Daten sind danach niemandem mehr sichtbar — das ist der Grund für die niedrige Einstufung. Es bleibt aber eine Aufbewahrung über den zugesagten Zweck hinaus, und sie landet in jedem Backup.

**Empfehlung:** Beim Wechsel einer Reise nach `abgeschlossen` die Zeilen in `trip_position` und `position_sharing` für diese Reise löschen. Ein Aufräumlauf am selben Zeitgeber wie der Dokument-Abgleich (`lib/documents/daily-audit.ts`) fängt zusätzlich die Reisen ab, deren Zeitraum verstrichen ist, ohne dass der Zustand je gesetzt wurde.

---

## Finding 8 — `AUTH_SECRET` dient zugleich als Token auf einer von außen erreichbaren Adresse

**Schweregrad: niedrig** · **live verifiziert** (Erreichbarkeit und Abweisung)

`AUTH_SECRET` trägt in diesem System drei Aufgaben gleichzeitig: es schützt die Anmeldung, aus ihm wird der Schlüssel für die Zugangsschlüssel je Account abgeleitet (`lib/secrets/encryption.ts:49`), und es weist den prod-Deploy gegenüber `POST /api/backups` aus (`lib/backup/deploy-token.ts`). `/api/backups` steht in `PUBLIC_PATHS` (`middleware.ts:38`) und ist damit durch den Tunnel aus dem Internet ansprechbar:

```
GET  https://dev.wegfara.com/api/backups                        -> 401 {"error":"nicht angemeldet"}
POST https://dev.wegfara.com/api/backups  (x-wegfara-deploy: falsch) -> 401 {"error":"nicht angemeldet"}
```

Die Abweisung funktioniert also, und die Umsetzung ist umsichtig: `timingSafeEqual`, und ein leerer Wert zählt wie „nicht gesetzt". Zwei Punkte bleiben trotzdem. Der Längenvergleich vor `timingSafeEqual` verrät die Länge des Geheimnisses — im Code erwähnt und vertretbar. Wichtiger ist die Bündelung: dieselbe Zeichenkette, die alle hinterlegten Zugangsschlüssel entschlüsselt, wird als Kopfzeile über eine im Internet stehende Adresse geschickt. Die Begründung im Code (*„Ein zweites Geheimnis waere ein zweiter Ort, an dem es verloren gehen kann"*) ist nachvollziehbar — nur wiegt sie den Schaden nicht auf, wenn dieser eine Ort auffliegt: eine Kompromittierung trifft dann Anmeldung, Backups und alle Account-Schlüssel auf einmal.

Der Deploy ruft ohnehin `http://127.0.0.1:${APP_PORT}` auf, also lokal — ein eigenes Geheimnis nur für diesen Zweck kostet nichts an Bequemlichkeit.

**Empfehlung:** Ein getrenntes `BACKUP_DEPLOY_TOKEN` in `~/wegfara-env/<umgebung>.env` einführen und `deployTokenMatches` darauf umstellen; `AUTH_SECRET` bleibt dann rein intern und verlässt die Maschine nie. Zusätzlich das Vergleichsergebnis über eine Prüfsumme fester Länge führen (`sha256` beider Seiten, dann `timingSafeEqual`), dann entfällt auch die Längen-Preisgabe.

---

## Finding 9 — `x-powered-by: Next.js` wird ausgeliefert

**Schweregrad: niedrig** · **live verifiziert**

Jede Antwort trägt den Kopf `x-powered-by: Next.js`. Das ist für sich harmlos, nennt einem Scanner aber ohne Not das Framework — und zusammen mit Finding 4 ist genau das die Information, mit der sich passende Angriffe aussuchen lassen. Die Version wird nicht preisgegeben.

`public/robots.txt` hält Suchmaschinen korrekt fern (`Disallow: /`), der Health-Endpunkt gibt bewusst nur „ob", nicht „wo" preis (`app/api/health/route.ts`) — die Zurückhaltung ist an anderer Stelle also schon Praxis.

**Empfehlung:** In `next.config.ts` `poweredByHeader: false` setzen. Einzeilig, ohne Nebenwirkung.

---

## Geprüft und unauffällig

Der Vollständigkeit halber, weil ein Bericht ohne diesen Teil den Eindruck erweckt, es sei nur gesucht und nichts bestätigt worden:

**Zugriff & Erreichbarkeit** — Jede Adresse außer den wenigen öffentlichen Pfaden verlangt eine Sitzung; die Aufteilung in `middleware.ts` ist eng gefasst und jede Ausnahme ist begründet. Eine Durchsicht aller 49 Routen unter `app/api/` ergab keine ungeschützte: ohne `currentSession()` arbeiten nur die Anmelde-Schnittstellen selbst (die ihre Voraussetzungen eigenständig prüfen) und `/api/health`. Der Gastzugang aus req-038 ist restlos entfernt (`migrations/0033_gastzugang_entfernen.sql`), es gibt also keinen zweiten, schwächeren Weg hinein. Passkeys verlangen `userVerification: "required"` und weisen sie auch nachgewiesen nach — ein Gerät, das die biometrische Prüfung überspringt, wird abgelehnt. Anmeldelinks sind auf drei pro Stunde und Konto gebremst, ohne dass die Antwort verrät, ob eine Adresse bekannt ist. PostgreSQL hat keine Portfreigabe, die App bindet nur auf `127.0.0.1`, und im Tunnel liegt ausschließlich die Anwendung — wie vorgegeben.

**Datenschutz & Datenhaltung** — Keine Secrets im Arbeitsbaum und keine in der Historie (263 Commits auf Muster für Schlüssel, Token und private Schlüssel durchsucht). Alle Geheimnisse kommen über die Umgebung aus `~/wegfara-env/`, außerhalb des Repos. `.gitignore` deckt `.env` in allen üblichen Formen ab. Zugangsschlüssel je Account liegen AES-256-GCM-verschlüsselt mit zweckgebundener Schlüsselableitung; zweimaliges Verschlüsseln desselben Werts ergibt verschiedene Ergebnisse, aus der Datenbank ist also nicht ablesbar, ob zwei Accounts denselben Schlüssel hinterlegt haben. Belege, Tickets und POI-Fotos liegen außerhalb des ausgelieferten Teils und gehen nur über `/api/dokumente/[id]` bzw. `/api/poi-fotos/[id]` heraus — beide prüfen die Sitzung und filtern nach `session.accountId`, ein fremdes Dokument beantworten sie mit 404 statt 403, verraten seine Existenz also nicht. Die Mandantentrennung zieht den Account durchgängig aus der Sitzung, nie aus der Anfrage; die dokumentierte Ausnahme für den Gesamt-Admin wechselt den Kontext, statt ihn aufzuweichen, ist im Schema auf genau eine Person begrenzt (`participant_single_super_admin`) und wird bei jedem Wechsel protokolliert (`account_switch`, `lib/accounts/switch-account.ts:36`).

**Betrieb** — Die Anwendung läuft als `nextjs`, nicht als root; das Einstiegsskript gibt die Rechte nach dem Einrichten der Verzeichnisse sofort ab. Der prod-Deploy hat bewusst keinen Push-Trigger, verlangt ein getipptes Bestätigungswort und fährt vorher Test-Suite und E2E-Tests als Quality-Gate.

**Wiederherstellung** — Die Funktion ist vorhanden und sorgfältig abgesichert (nur Gesamt-Admin, Bestätigungswort, App während des Laufs gesperrt, vorheriger Stand standardmäßig gesichert), und sie ist mit Unit-Tests hinterlegt. Ob ein Backup je tatsächlich zurückgespielt wurde, lässt sich aus dem Repo nicht feststellen — `security.md` verlangt das ausdrücklich (*„Ein nie zurueckgespieltes Backup ist eine Vermutung, kein Backup"*). Das ist kein Finding, sondern ein offener Punkt: der nächste Durchlauf sollte ein prod-Backup auf dev einspielen und das Ergebnis festhalten. Nach Finding 6 wäre das heute ohnehin der Anlass, den Quer-Zugriff bewusst zu gestalten.

---

## Empfohlene Reihenfolge

1. **Cloudflare „Always Use HTTPS" + HSTS** (Finding 1) — größte Wirkung, kein Code, sofort.
2. **`npm audit fix`** (Finding 4), `nodemailer` zuerst, danach Test-Suite und E2E als Nachweis.
3. **prod-Tunnel wieder in Betrieb nehmen** (Finding 5) und eine Erreichbarkeitsprüfung von außen einrichten.
4. **Backup-Ziel außerhalb des Beelink + täglicher Lauf** (Findings 2 und 3) — zusammen als ein Requirement, sie gehören sachlich zusammen.
5. Findings 6 bis 9 als Aufräumarbeiten hinterher.

Die Punkte 1 bis 4 verlangen jeweils eine Entscheidung oder einen Handgriff außerhalb des Repos (Cloudflare-Einstellung, Beelink, Backup-Ziel) und sind deshalb nichts, was der Worker autonom erledigen kann.

*Am Repo wurde für diese Prüfung nichts geändert, nichts committet und nichts gepusht.*
