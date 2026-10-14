---
type: security
repo: Wegfara
commit: 63a6c90
date: 2026-10-14
---

# Security: Wegfara (63a6c90)

Automatisch erstellt vom appbaua-Worker am 2026-10-14.

---

# Security-Check wegfara — 14.10.2026

**Stand:** `dev` @ `63a6c90` · **SOLL:** `delivery/security.md` (vorhanden), `delivery/devops.md`, `CLAUDE.md` · **Vorlauf:** Bericht vom 07.10.2026 (`45b8821`)

## Kurz-Zusammenfassung

Geprüft wurden Requirements, Code und Config vollständig sowie die beiden laufenden Umgebungen von außen (HTTP/HTTPS, Schnittstellen-Wachen, Antwort-Header). Infrastruktur auf dem Beelink war **nicht** prüfbar: in dieser Umgebung ist kein SSH-Zugang hinterlegt (`~/.ssh` existiert nicht) — Backup-Läufe, Dateirechte und Container-Zustand sind deshalb nur aus Config erschlossen.

Die gute Nachricht zuerst: **Finding 1 des Vorberichts ist behoben.** `PUT /api/participants/account-admin` prüft jetzt `session.accountAdmin` — niemand kann sich mehr selbst zum Account-Admin machen. Ebenfalls saubere Arbeit: die Verschlüsselung der Zugangsschlüssel (AES-256-GCM, Schlüssel aus `AUTH_SECRET`, zweckgebunden abgeleitet, kein Rückkanal zum Auslesen), der zeitkonstante Vergleich des Deploy-Tokens, die Absicherung von `POST /api/backups`, und die neue Druckseite aus req-080, die mit `requireTripAccess` + `visibleTripIds` korrekt gegen Mandant **und** Sichtbarkeit prüft.

Das zentrale neue Ergebnis dieses Laufs: **die Rollenprüfung „Reiseleiter" existiert nur in den Seiten, in keiner einzigen Schnittstelle.** `darfPlanen` kommt in sechs Seiten vor und in null API-Routen. Ein gewöhnlicher Mitreisender kann damit per direktem Aufruf eine ganze Reise samt Bildern und Dokumenten löschen. Das ist für diesen Lauf das schwerwiegendste Ergebnis, und es betrifft auch die neue Chat-Schnittstelle aus req-081.

Drei Findings sind unverändert seit dem 23.09.2026 offen: die nicht erzwungene HTTPS-Pflicht, die Abhängigkeiten (inzwischen 7 Schwachstellen, 2 kritisch) und die nicht erfüllte Backup-Erwartung. Insgesamt 15 Findings: 4 hoch, 5 mittel, 6 niedrig.

---

## Finding 1 — Die Rollenprüfung „Reiseleiter" fehlt in allen Schnittstellen *(neu)*

**Schweregrad: hoch** · **aus Code erschlossen** (live nicht nachgestellt: das setzte eine Sitzung als Nicht-Reiseleiter und damit eine Veränderung am Datenbestand voraus — hier ausgeschlossen)

`lib/einstieg/ziel.ts:70` definiert `darfPlanen` — Reiseleiter oder Account-Admin. Benutzt wird die Funktion in `app/plan/page.tsx`, `app/plan/reiseplan/[tripId]/page.tsx`, `app/go/page.tsx`, `app/mein-bereich/page.tsx` und zwei Views. In **keiner** der rund 50 API-Routen. Jede schreibende Schnittstelle prüft ausschließlich „angemeldet" plus „Reise gehört zum Account":

```
app/api/trips/route.ts:251   DELETE  → currentSession() ... deleteTrip(db, session.accountId, id)
app/api/pois/route.ts:188    POST/PUT/DELETE → nur currentSession()
app/api/kostenzeilen/route.ts:96  POST/PUT/DELETE → nur currentSession()
app/api/chat/route.ts:199    DELETE  → nur currentSession() + tripBelongsToAccount
```

`DELETE /api/trips` löscht anschließend über `entferneBilddateien` und `entferneDokumentdateien` auch die Dateien — unwiederbringlich. Die Oberfläche blendet die Schaltflächen für Nicht-Planer aus, aber genau davor warnt der Kommentar in `app/api/participants/route.ts` selbst: *„es genügt nicht, Schaltflächen auszublenden"*. Für die Rolle ist das noch nirgends umgesetzt.

Der Zugriffskreis sind laut `security.md` „Familie und Freunde als Teilnehmer einer Reisegruppe" — also Personen mit gültiger Sitzung, denen das Planen bewusst nicht offensteht. Genau sie sind hier nicht abgegrenzt.

**Empfehlung:** Eine Wache analog `unauthorized()`/`forbidden()` in `lib/auth/api-guard.ts` ergänzen, die `tripParticipants` lädt und `darfPlanen` serverseitig auswertet, und sie in jeder schreibenden Routen-Funktion aufrufen, die zur Planung gehört (`trips`, `pois`, `programmpunkte`, `kostenzeilen`, `transfers`, `bewertungsrunden`, `dokumente`, `chat`). Die bestehende Testdatei `app/api/api-guard.test.ts` ist der Ort, an dem sich das für alle Routen gemeinsam festnageln lässt — dasselbe Muster, mit dem `session-scope.test.ts` die Sitzungspflicht absichert.

---

## Finding 2 — HTTPS-Pflicht nicht durchgesetzt; über HTTP setzt die App Cookies ohne `Secure`

**Schweregrad: hoch** · **live verifiziert** · *unverändert offen seit dem 23.09.2026 (vierter Lauf)*

`security.md` ist hier unmissverständlich: *„HTTPS: Pflicht fuer beide Umgebungen. Kein unverschluesselter Zugriff."* Der Ist-Zustand, gerade gemessen:

```
GET  http://dev.wegfara.com/anmeldung   → 200 (kein Redirect, kein HSTS)
POST http://dev.wegfara.com/api/auth/passkey/anmeldung
     → set-cookie: wegfara_webauthn=; Path=/; Max-Age=0; HttpOnly; SameSite=lax
POST https://dev.wegfara.com/api/auth/passkey/anmeldung
     → set-cookie: wegfara_webauthn=; Path=/; Max-Age=0; Secure; HttpOnly; SameSite=lax
```

Die Anwendung liefert über Klartext-HTTP vollständig aus. `connectionIsSecure` (`lib/auth/cookies.ts:33`) arbeitet korrekt — es wertet `x-forwarded-proto` aus und setzt `Secure` folgerichtig **nicht**, wenn Cloudflare `http` weitergibt. Der Fehler liegt eine Ebene höher: es gibt nichts, was HTTP abweist. Wer in einem fremden WLAN `wegfara.com` ohne Schema eintippt, überträgt sein Sitzungs-Cookie im Klartext; ein Mitlesender im selben Netz übernimmt damit die Sitzung, und die hält laut `security.md` 90 Tage.

Betroffen sind dev **und** prod (`https://app.wegfara.com` antwortet ebenfalls ohne HSTS).

**Empfehlung:** Zwei Schritte, beide klein. (1) In Cloudflare je Zone „Always Use HTTPS" einschalten — das erledigt die Weiterleitung, bevor die Anfrage den Tunnel erreicht. (2) HSTS setzen (`max-age=31536000; includeSubDomains`), damit der Browser beim zweiten Mal gar nicht erst über HTTP fragt; am besten über die `headers()`-Funktion in `next.config.ts`, dann steht die Vorgabe im Repo und nicht nur im Cloudflare-Dashboard. Zusätzlich hat `middleware.ts` den `x-forwarded-proto` schon in der Hand (Zeile 68) — eine Weiterleitung dort ist die Absicherung für den Fall, dass die Cloudflare-Einstellung einmal verloren geht.

---

## Finding 3 — Sieben bekannte Schwachstellen in den Abhängigkeiten, zwei davon kritisch

**Schweregrad: hoch** · **live verifiziert** (`npm audit` gegen die installierten `node_modules`) · *offen seit dem 23.09.2026, unverändert zum Vorbericht*

| Paket | installiert | Fix in | aktuell | Schwere | Relevanz für wegfara |
| --- | --- | --- | --- | --- | --- |
| `next` | 16.2.12 | 16.3.8 | 16.4.0 | **kritisch** | Acht Advisories. RCE in `next/og` (`GHSA-vcvr-r3jv-pc5j`) ist unmittelbar einschlägig: `app/icon/[groesse]/route.tsx` ist eine `next/og`-Route und laut `middleware.ts:50` **öffentlich erreichbar**. Dazu SSRF in der Image-Optimization (CVSS 6,5) und zwei Cache-Poisoning-Lücken. Die Windows-RCE trifft hier nicht (Beelink ist Linux). |
| `maplibre-gl` | 6.0.0 | 6.5.0 | 6.14.0 | **kritisch** | XSS-Sanitizer-Bypass in `DOM.sanitize()`, **CVSS 10,0**. Die Karte ist der Mittelpunkt von Planer und Begleiter; POI-Namen und -Texte stammen aus Nutzereingaben und aus Google. |
| `nodemailer` | 9.0.5 | 10.0.6 | 10.1.0 | hoch | Sieben Advisories: Zustellung an angreiferkontrollierte Domains über IDN/Punycode- und RFC-5322-Kommentar-Fehlparsing, Offenlegung von SMTP-Zugangsdaten über den prozessglobalen DNS-Cache. Betrifft genau den Weg, auf dem Anmelde- und Einladungslinks verschickt werden — seit req-066 der **einzige** Rückfallweg in die App. |
| `sharp` | transitiv (`next`) | 0.35.5 | — | hoch | Geerbte libvips-, libheif- und librsvg-Lücken. Erreichbar über die Bildverarbeitung; `lib/documents/validate.ts` nimmt HEIC/HEIF an. |
| `postcss` | transitiv (`next`) | 8.5.23 | — | hoch | XSS über unescaptes `</style>`, Pfad-Traversal und Offenlegung beliebiger `.map`-Dateien. Primär Bauzeit. |
| `source-map-js` | transitiv | > 1.2.1 | — | hoch | DoS der Event-Loop. Primär Bauzeit. |
| `nanoid` | transitiv | 3.3.18 | — | hoch | Endlosschleife bei Größe 0. |

`npm audit` meldet für alle sieben `fixAvailable: true`.

**Empfehlung:** `npm audit fix` löst die transitiven Fälle; `next`, `maplibre-gl` und `nodemailer` sind direkte Abhängigkeiten und brauchen ein bewusstes Hochziehen mit anschließendem Lauf der vollen Suite plus `npm run test:e2e` (`maplibre-gl` 6.0 → 6.14 ist ein Sprung über 14 Minor-Versionen und berührt die Karte in beiden Bereichen). Vorrang hat `next`, solange die `next/og`-Icon-Route öffentlich ist. Damit das nicht jeden Monat neu auffällt: `npm audit --audit-level=high` als Schritt in `deploy-prod.yml` vor dem Quality-Gate — dann bricht die Promotion, statt den Befund in einen Bericht zu schreiben.

---

## Finding 4 — Zugriffsgrenze der Schnittstellen ist der Account, nicht die Reisegruppe

**Schweregrad: hoch** · **aus Code erschlossen** · *offen seit dem 23.09.2026, hier um die Chat-Schnittstelle erweitert*

`security.md`: *„Teilnehmer sehen nur Daten der Reisen, zu denen sie gehoeren."* Der Code kennt beide Muster, benutzt aber überwiegend das schwächere:

- **richtig** — `listTripsForSession` (`lib/db/trips.ts:130`) verzweigt auf `listTripsForParticipant`; `app/api/positionen/route.ts:29` filtert darüber, ebenso die Druckseite aus req-080.
- **zu weit** — `tripBelongsToAccount` (`lib/db/trips.ts:145`) prüft nur `account_id`. Daran hängen `activities`, `activity-option-selections`, `search-area`, `trip-positions`, `position-sharing` und seit req-081 `chat-nachrichten`.
- **zu weit** — `app/api/dokumente/[id]/route.ts` holt über `findDocumentFile(pool, session.accountId, id)`; Belege und Tickets jeder Reise des Accounts sind damit für jede Person des Accounts abrufbar. `security.md` verlangt: *„Belege und Tickets sind nur fuer Mitglieder der zugehoerigen Gruppe abrufbar."*

Die neue Chat-Schnittstelle ist der klarste Fall, weil ihr eigener Kommentar das Gegenteil behauptet (`app/api/chat/route.ts:22`): *„Wer eine Reise nicht sieht, sieht ihre Unterhaltung nicht (req-023, security.md)"* — geprüft wird dann `tripBelongsToAccount`. Wer zu Reise A gehört, liest die Planungsunterhaltung zu Reise B mit und kann sie per `DELETE` löschen.

Solange ein Account eine Familie ist, ist der Schaden gering. Die Vorgabe ist trotzdem eine andere, und `security.md` benennt genau diese Logik als Mangel: *„Auch solange nur ein Mandant existiert, ist ein fehlender Mandantenfilter ein Sicherheitsmangel — er faellt erst auf, wenn es zu spaet ist."*

**Empfehlung:** Ein `tripAccessibleToSession(db, session, tripId)` neben `tripBelongsToAccount` stellen, das `actingAccount` wie `listTripsForSession` berücksichtigt, und die sechs Aufrufer darauf umstellen. `tripBelongsToAccount` behält seinen Platz, wo wirklich nur der Mandant gemeint ist. Für Dokumente die Reisezugehörigkeit in `findDocumentFile` mit in die Abfrage nehmen.

---

## Finding 5 — Backup-Erwartung nicht erfüllt: kein täglicher Lauf, kein Ziel außerhalb des Beelink

**Schweregrad: mittel** · **aus Config erschlossen** (ohne SSH-Zugang nicht live prüfbar) · *offen seit dem 23.09.2026*

`security.md` verlangt drei Dinge. Stand:

| Vorgabe | Ist |
| --- | --- |
| „Taeglich, automatisch" | **nicht erfüllt.** `grep` über `.github/workflows/` findet keinen `schedule`-Trigger. Gesichert wird nur in `deploy-prod.yml` („Backup vor dem Deploy") und von Hand in der Verwaltung. Zwischen zwei prod-Deploys liegt kein Backup. |
| „ein zweites Ziel ausserhalb des Beelink" | **nicht erfüllt.** `docker-compose.yml` hängt `${HOME}/wegfara-backups` ein, das Backup-Verzeichnis liegt auf derselben Maschine wie die Datenbank. `security.md` wertet das selbst: *„Ein Backup, das nur auf derselben Maschine liegt, gilt als nicht vorhanden."* Kein `rclone`, kein S3, kein NAS im Repo. |
| „Wiederherstellung muss getestet sein" | **teilweise.** `app/api/backups/[id]/wiederherstellen/route.ts` existiert samt Test, ein echter Rückspiel-Lauf ist von hier nicht nachweisbar. |

Streng genommen heißt das: die prod-Daten dieser App sind derzeit gegen einen Ausfall des Beelink nicht gesichert.

**Empfehlung:** Für den täglichen Lauf ist das Muster schon im Haus — `instrumentation.ts` startet `startDocumentAudit()` mit genau der Begründung, die hier auch gilt (*„eine vergessene Einrichtung waere sonst der wahrscheinlichste Grund, warum die Pruefung nie liefe"*). Ein `startDailyBackup()` daneben nutzt dieselbe Backup-Funktion wie Verwaltung und Deploy. Für das zweite Ziel genügt ein `rclone`-Ziel (Backblaze B2, Hetzner Storage Box) im Anschluss an den Lauf, verschlüsselt, mit den Zugangsdaten in `~/wegfara-env/prod.env`. Und einmal ein prod-Backup auf dev einspielen — `devops.md` beschreibt das als vorgesehenen Weg; danach ist die Wiederherstellung belegt statt vermutet.

---

## Finding 6 — Keine Sicherheits-Header

**Schweregrad: mittel** · **live verifiziert** · *offen seit dem 23.09.2026*

Die Antwort von `https://dev.wegfara.com/anmeldung` und `https://app.wegfara.com/anmeldung` enthält keinen einzigen Schutz-Header: kein `Content-Security-Policy`, kein `Strict-Transport-Security`, kein `X-Content-Type-Options`, kein `X-Frame-Options`/`frame-ancestors`, keine `Referrer-Policy`, keine `Permissions-Policy`. Gesetzt wird allein `Cache-Control: no-store` aus `middleware.ts` — das ist bug-012 geschuldet und hat einen anderen Zweck.

Umgekehrt steht `x-powered-by: Next.js` in jeder Antwort und nennt das Framework, dessen RCE-Advisories unter Finding 3 offen sind.

Das Fehlen von CSP wiegt hier mehr als üblich, weil mit `maplibre-gl` eine Bibliothek mit offenem XSS-Bypass (CVSS 10,0) im Spiel ist: eine CSP ist genau die zweite Linie für den Fall, dass ein Sanitizer versagt. `X-Content-Type-Options: nosniff` fehlt dort, wo Finding 9 Dateien `inline` ausliefert.

**Empfehlung:** Eine `headers()`-Funktion in `next.config.ts` mit `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Frame-Options: DENY` und `poweredByHeader: false`. Die CSP braucht einen eigenen Schritt, weil `next/font` und maplibre Stilregeln zur Laufzeit erzeugen — zuerst `Content-Security-Policy-Report-Only` auf dev, Verstöße einsammeln, dann scharf schalten.

---

## Finding 7 — Das zustandsabhängige Sitzungsende greift nur auf Seiten, nicht in den Schnittstellen

**Schweregrad: mittel** · **aus Code erschlossen** · *offen seit dem 23.09.2026*

`security.md` bindet die Sitzungsdauer an den Zustand der Reise: *„eine Sitzung gilt, solange die Person mindestens einer Reise im Zustand ‚Freigegeben' zugeordnet ist oder eine offene Bewertung hat."* Umgesetzt ist das in `requireTripAccess` (`lib/auth/current-session.ts:58`) über `sessionRemainsValid` — und `requireTripAccess` ist eine Seiten-Funktion mit `redirect()`. Die Schnittstellen rufen durchweg `currentSession()`, das nur Cookie, Datenbankeintrag und Ablauf prüft.

Wer also nach Reiseende aus der Oberfläche hinausfliegt, behält bis zu 90 Tage ein funktionsfähiges Sitzungs-Cookie für alle API-Routen — und über Finding 1 und Finding 4 reicht das weit. Es ist dieselbe Kluft zwischen Seiten-Wache und Schnittstellen-Wache wie bei Finding 1.

**Empfehlung:** Die Prüfung in eine gemeinsame Wache ziehen, die beide Einstiege benutzen — Seiten mit `redirect`, Schnittstellen mit `401`. Mit Finding 1 zusammen umsetzen: es ist derselbe Platz im Code.

---

## Finding 8 — Die neue Chat-Schnittstelle ist ungedrosselt, und der Verlauf wächst unbegrenzt mit

**Schweregrad: mittel** · **aus Code erschlossen** *(erweitert Finding 10 des Vorberichts)*

Eine Bremse gibt es genau einmal im Projekt: `lib/auth/rate-limit.ts`, benutzt allein von `app/api/auth/anmeldelink/route.ts`. Die kostenpflichtigen Endpunkte haben keine — und mit req-081 ist der teuerste dazugekommen:

- `POST /api/chat` rechnet über den Anthropic-Schlüssel **des Accounts** ab (`accountApiKey(db, accountId, "anthropic")`). Pro Aufruf bis `MAX_TOKENS = 8192` Ausgabe-Token.
- `listChatNachrichten` holt den Verlauf **ohne Limit** (`lib/db/chat-nachrichten.ts:58`, `order by created_at asc`, kein `limit`) und `app/api/chat/route.ts:158` schickt ihn vollständig mit. Die Kosten je Frage wachsen also mit der Länge der Unterhaltung — quadratisch über eine Sitzung hinweg. Der Kommentar in `lib/chat/validate.ts` sieht das Problem für die einzelne Nachricht (4000 Zeichen) und benennt die Begründung sogar — *„was hier hineinkommt, geht als Zusammenhang mit jeder weiteren Frage erneut an den Dienst"* —, aber die Summe ist nirgends begrenzt.
- Dieselbe Lücke bei `ki-planung`, `poi-beschreibung`, `poi-ki-bild`, `poi-vervollstaendigen`, `place-search`.

Zusammen mit Finding 1 heißt das: jede eingeladene Person kann in einer Schleife die Rechnung des Betreibers hochtreiben. Die Einladung ist laut `security.md` an Familie und Freunde gerichtet, ein Angriff ist also nicht das Hauptszenario — ein verklemmtes Skript oder ein neugieriges Ausprobieren genügt.

**Empfehlung:** Den vorhandenen `createRateLimiter` auf die kostenpflichtigen Routen anwenden, gestaffelt je Person und Tag; der Zähler im Arbeitsspeicher reicht aus demselben Grund wie beim Anmeldelink (eine Instanz je Umgebung). Für den Verlauf ein `limit` in `listChatNachrichten` oder ein Fenster der letzten *n* Nachrichten beim Zusammenbauen des Zusammenhangs — die Anzeige kann weiter alles zeigen.

---

## Finding 9 — Der Content-Type hochgeladener Dateien wird geglaubt und `inline` ausgeliefert

**Schweregrad: mittel** · **aus Code erschlossen**

`app/api/dokumente/route.ts:93` bestimmt die Art über `documentContentType(datei.type, datei.name)` — Angabe des Browsers, ersatzweise die Dateiendung. Beides stammt vom Client. Geprüft wird nur gegen die Positivliste in `lib/documents/validate.ts`; der Inhalt selbst wird nie angesehen (keine Magic-Byte-Prüfung).

Ausgeliefert wird dann mit `Content-Type: document.contentType` und `Content-Disposition: inline` (`app/api/dokumente/[id]/route.ts`). Dass `image/svg+xml` nicht auf der Liste steht, nimmt dem Ganzen die Spitze — das wäre der direkte Weg zu gespeichertem XSS. Es bleibt: eine Datei, die `image/png` behauptet und HTML enthält, wird vom Browser als Bild angeboten, und ohne `X-Content-Type-Options: nosniff` (Finding 6) hängt das Verhalten allein am Browser. PDFs werden `inline` im Viewer geöffnet; Chrome sandboxt den, aber die Annahme steht nirgends geschrieben.

**Empfehlung:** Die ersten Bytes gegen die behauptete Art prüfen und bei Abweichung abweisen — in `lib/documents/validate.ts`, damit Oberfläche und Schnittstelle dieselbe Regel benutzen. Zusätzlich `nosniff` setzen (kommt mit Finding 6) und `inline` auf Bilder und PDF beschränken, alles andere als `attachment`.

---

## Finding 10 — Standortdaten werden bei Reiseende nicht gelöscht

**Schweregrad: niedrig** · **aus Code erschlossen** · *offen seit dem 23.09.2026*

`security.md`: *„Positionen werden nur bei aktiver Reise und nur mit Zustimmung des Teilnehmers geteilt und nach Reiseende geloescht."* Die erste Hälfte stimmt — `zeigtLiveStatus` und `sichtbarePositionen` (`lib/positions/sichtbar.ts`) blenden außerhalb des Zeitraums und veraltete Punkte aus. Die zweite Hälfte fehlt: `lib/db/trip-positions.ts` kennt `deleteTripPosition` nur für den Einzelfall, und niemand ruft es beim Reiseende. Die Zeilen in `trip_position` bleiben stehen; ausgeblendet ist nicht gelöscht, und in einem Backup sind sie ohnehin wieder da.

Dass je Person nur die letzte Position gespeichert wird (kein Bewegungsprofil), ist eingehalten — der Mangel ist allein die ausbleibende Löschung.

**Empfehlung:** Ein Löschen im Anschluss an den Zustandswechsel der Reise nach „abgeschlossen", oder als Teil des täglichen Laufs in `instrumentation.ts`: Positionen zu Reisen, deren Enddatum vorbei ist, entfernen.

---

## Finding 11 — `AUTH_SECRET` trägt zwei Rollen, und seine Stärke wird nie geprüft

**Schweregrad: niedrig** · **aus Code erschlossen** · *offen seit dem 30.09.2026*

`AUTH_SECRET` ist (1) Ableitungsquelle für den AES-Schlüssel der Zugangsschlüssel (`lib/secrets/encryption.ts:48`) und (2) das Deploy-Token für `POST /api/backups` (`lib/backup/deploy-token.ts`). Die zweite Rolle schickt das Geheimnis als HTTP-Header über die Leitung — im Workflow nur über `127.0.0.1`, das ist in Ordnung, aber es steht damit in der Prozessliste und in jedem Log, das Header mitschreibt.

`envGeheimnis` prüft ausschließlich „nicht leer". Ein `AUTH_SECRET=test` ergibt einen vollgültigen, aber trivial erratbaren AES-Schlüssel und ein trivial erratbares Deploy-Token — ohne jede Warnung. Dass dieselbe Doppelrolle bewusst gewählt wurde, steht im Kommentar (*„Ein zweites Geheimnis waere ein zweiter Ort, an dem es verloren gehen kann"*) und ist nachvollziehbar; die fehlende Mindeststärke ist es nicht.

**Empfehlung:** Beim Hochfahren in `instrumentation.ts` eine Mindestlänge prüfen (32 Zeichen) und bei Unterschreitung laut ins Protokoll schreiben — dort steht schon die Prüfung der Bildablage, das ist der passende Ort. Für die Trennung der Rollen genügt ein zweiter abgeleiteter Wert mit eigenem `PURPOSE`, wie es `encryption.ts` für die Verschlüsselung bereits vormacht; dann geht nie das Wurzelgeheimnis selbst als Header hinaus.

---

## Finding 12 — Kein `.dockerignore`, und die Container-Images hängen nur an Tags

**Schweregrad: niedrig** · **aus Config erschlossen** · *offen seit dem 30.09.2026*

`.dockerignore` existiert nicht. Der Build-Kontext ist `context: ..`, also das ganze Repo — samt `.git` (vollständige Historie), `node_modules`, `.next`, `test-results` und `tsconfig.tsbuildinfo` (415 KB). Das verlangsamt jeden Build und bringt Material ins Image, das dort nicht hingehört. Dass `next.config.ts` den Quelltext per `outputFileTracingExcludes` aus dem Standalone-Bundle hält, ist die halbe Miete — der Build-Kontext ist die andere.

Dazu zwei unfixierte Images in `docker-compose.yml`: `postgres:17-alpine` und `cloudflare/cloudflared:latest`. `latest` beim Tunnel heißt, dass jeder `up -d --build` eine andere, ungeprüfte Version der Komponente holen kann, die die App ins Internet hängt.

**Empfehlung:** Ein `.dockerignore` mit `.git`, `node_modules`, `.next`, `delivery`, `test-results`, `*.tsbuildinfo`. Beide Images auf einen Digest festnageln (`image: cloudflare/cloudflared@sha256:...`) und beim Hochziehen bewusst wechseln.

---

## Finding 13 — Abrufe bei externen Diensten ohne Zeitgrenze

**Schweregrad: niedrig** · **aus Code erschlossen** · *offen seit dem 30.09.2026*

Acht `fetch`-Aufrufe an fremde Dienste, keiner mit `AbortSignal.timeout` oder vergleichbarem:

```
lib/google/places-client.ts:207,237,304,329
lib/osm/place-search.ts:146 · lib/osm/reverse-geocode.ts:19 · lib/osm/ort-lookup.ts:22
lib/weather/open-meteo-client.ts:19
```

Antwortet der Dienst nicht und hält die Verbindung offen, hängt die Anfrage, bis Node oder Cloudflare abbricht. Bei einer einzelnen Instanz je Umgebung reicht eine Handvoll solcher Aufrufe, um die App auszulasten. `lib/google/places-client.ts:237` ist zusätzlich ein `redirect: "follow"` auf eine aus einem Nutzer-Link gewonnene Adresse — da gehört eine Grenze doppelt dazu.

Der neue Anthropic-Client setzt `maxRetries: 0`, aber keinen `timeout`; weil gestromt wird, fällt das weniger ins Gewicht.

**Empfehlung:** `signal: AbortSignal.timeout(5000)` an alle acht Stellen (für die KI-Aufrufe entsprechend großzügiger), und die bestehenden `try/catch`-Zweige behandeln den Abbruch wie jeden anderen Fehlschlag des Dienstes.

---

## Finding 14 — dev und prod teilen das Backup-Verzeichnis, und dev deployt bei jedem Push

**Schweregrad: niedrig** · **aus Config erschlossen** · *offen seit dem 23.09.2026*

`docker-compose.yml` hängt `${HOME}/wegfara-backups` in **beide** Container unter `/data/backups`. Das ist in `devops.md` ausdrücklich gewollt (ein prod-Backup auf dev einspielen, um mit echten Daten zu prüfen) — die Nebenwirkung steht dort nicht: der dev-Container hat Schreib- und Löschzugriff auf die prod-Backups, und `app/api/backups/[id]/route.ts` kann löschen. dev wird bei jedem Push nach `dev` neu gebaut und ausgerollt, also von genau dem autonomen Worker, der prod nie anfassen darf.

Dass `security.md` die prod-Daten als das zu schützende Gut benennt und `devops.md` dem Worker jeden prod-Zugriff untersagt, passt nicht dazu, dass derselbe Worker über dev an den prod-Backups sitzt.

**Empfehlung:** Das Verzeichnis für dev nur lesend einhängen (`:ro`) — das Einspielen eines prod-Backups auf dev braucht keinen Schreibzugriff, nur Lesen. dev sichert dann in ein eigenes Unterverzeichnis.

---

## Finding 15 — Name und E-Mail des Betreibers stehen als Klartext in den Migrationen

**Schweregrad: niedrig** · **aus Code erschlossen**

`migrations/0002_seed_demo_data.sql:6` und `migrations/0015_auth.sql:81` legen den Account und die erste Person mit echten personenbezogenen Daten an (`'Uwe Kremmel'`, `'uwe@kremmel.org'`). Der Kommentar hält fest, dass das Absicht ist (*„Er ist kein Demo-Datum"*), und req-037 hat mit `BOOTSTRAP_EMAIL` inzwischen den richtigen Weg: Konfiguration statt Migration.

Es ist kein Geheimnis — es sind aber personenbezogene Daten in einer Historie, die sich nicht mehr ändern lässt, und `security.md` legt auf Datenschutz ausdrücklich Wert. Für ein öffentliches Repository wäre das ein eigenes Thema; für ein privates ist es vor allem ein Hinweis darauf, dass die alten Migrationen den Standard von req-037 noch nicht kennen.

**Empfehlung:** Nichts rückbauen — bestehende Migrationen zu ändern bricht `devops.md` („versionierte Migrationen", prod-Daten erhalten). Für die Zukunft `BOOTSTRAP_EMAIL` als den einzigen Weg behandeln und keine Personen mehr in Migrationen anlegen. Falls das Repo je öffentlich werden soll, ist das vorher zu bereinigen.

---

## Was geprüft wurde und in Ordnung war

- **Secrets im Repo** — nichts gefunden. Weder in den verfolgten Dateien (Suche nach `sk-`, `sk-ant-`, `AIza`, privaten Schlüsseln, Zuweisungen von `PASSWORD`/`SECRET`/`TOKEN` an Literale) noch in der Git-Historie. `.gitignore` deckt `.env`, `.env.local`, `.env*.local` ab; keine `.env`-, `.pem`- oder `.key`-Datei ist verfolgt. Alle Geheimnisse kommen über `docker-compose.yml` aus `~/wegfara-env/<umgebung>.env` — genau wie `security.md` es verlangt.
- **Verschlüsselung der Zugangsschlüssel (req-028)** — AES-256-GCM mit Zufalls-IV und Auth-Tag, Schlüssel zweckgebunden aus `AUTH_SECRET` abgeleitet, bewusst aus der Umgebung und nicht aus der Datenbank (ein Backup allein nützt nichts). Kein Rückkanal: `/api/zugangsschluessel` hat kein `GET`, liefert nur Zustand und die letzten vier Zeichen, und verlangt `accountAdmin`. Ohne `AUTH_SECRET` wird nichts gespeichert, statt im Klartext abzulegen. Sauber gelöst.
- **Finding 1 des Vorberichts behoben** — `PUT /api/participants/account-admin` prüft `session.accountAdmin`, bevor es ernennt.
- **Deploy-Token** — `timingSafeEqual` mit vorheriger Längenprüfung, leeres Geheimnis passt nie (`lib/backup/deploy-token.ts`).
- **`POST /api/backups`** — trotz Eintrag in `PUBLIC_PATHS` korrekt abgesichert: entweder Deploy-Token oder `session.superAdmin`. Live bestätigt (`401` ohne beides). `GET` verlangt immer `superAdmin`.
- **Sitzungspflicht der Schnittstellen** — live bestätigt: `/api/trips`, `/api/chat` antworten ohne Cookie mit `401 {"error":"nicht angemeldet"}`. `/api/health` ist wie vorgesehen offen und gibt nur Status und Zustand der Bildablage heraus.
- **Die Druckseite aus req-080** — `requireTripAccess`, dann `darfPlanen`, dann `visibleTripIds`. Die einzige Stelle in diesem Lauf, die alle drei Ebenen prüft; sie ist das Vorbild für Finding 1.
- **Chat-Oberfläche (req-081)** — kein `dangerouslySetInnerHTML`, kein `innerHTML` im ganzen Projekt. Antworten der KI werden als Text gerendert; die KI bekommt keine Werkzeuge und keine Reisedaten im Zusammenhang, der System-Prompt ist knapp und ohne Nutzerdaten. Keine Prompt-Injection-Fläche in diesem Schritt.
- **Cookie-Eigenschaften** — `httpOnly`, `sameSite=lax` (mit nachvollziehbarer Begründung für „lax" statt „strict": der Anmeldelink aus dem Postfach), `path=/`. `Secure` korrekt an `x-forwarded-proto` gebunden — das Problem ist nicht das Cookie, sondern der fehlende HTTPS-Zwang (Finding 2).
- **Keine offene Registrierung** — `middleware.ts` lässt nur `/anmeldung`, `/api/auth`, `/einladung`, `/ersteinrichtung`, `/api/health`, `/api/backups`, `/maplibre` und das Icon öffentlich. Der Gastzugang aus req-038 ist restlos entfernt, Notfallcodes (req-066) ebenso — beides wie in `security.md` beschrieben.
- **Datenbank nicht erreichbar** — keine Portfreigabe in `docker-compose.yml`, nur im Compose-Netz. App auf `127.0.0.1:${APP_PORT}` gebunden, von außen ausschließlich über den Cloudflare Tunnel. Entspricht der Vorgabe.
- **Keine erratbaren URLs für Belege** — Dokumente liegen außerhalb des ausgelieferten Teils und gehen nur über `/api/dokumente/[id]` heraus, mit Sitzungsprüfung. Die Grenze ist zu weit (Finding 4), aber nicht offen.
- **Schriften selbst ausgeliefert** — `next/font/google` lädt beim Bauen, der Browser spricht keinen fremden Dienst an.
- **prod-Workflow** — kein Push-Trigger, nur `workflow_dispatch` mit Eingabe des Wortes `deploy`, Test-Suite und E2E als Gate vor Backup und Deploy. Entspricht `devops.md` exakt.

## Grenzen dieser Prüfung

- **Kein SSH-Zugang.** `devops.md` sieht für dev uneingeschränkten Zugriff vor, in dieser Umgebung ist aber kein Schlüssel hinterlegt (`~/.ssh` existiert nicht). Nicht geprüft werden konnten damit: ob tatsächlich Backups in `~/wegfara-backups/` liegen und wie alt sie sind, die Rechte (600) der env-Dateien, die Stärke des gesetzten `AUTH_SECRET`, die laufenden Container, die Konfiguration des Tunnels und die Cloudflare-Einstellungen. Finding 5 und Finding 11 wären mit Zugang belastbarer zu beurteilen.
- **prod nur von außen.** Als autonomer Lauf ohne Nutzer am Bildschirm wurde auf prod nichts angefasst — geprüft wurden nur die Antwort-Header und das HTTP/HTTPS-Verhalten der öffentlichen Adresse.
- **Keine Sitzung, kein Datenbestand.** Alles, was eine angemeldete Person voraussetzt, ist aus dem Code erschlossen und nicht live nachgestellt: das hätte Daten verändert. Betrifft Finding 1, 4, 7, 8, 9, 10.
- **Keine Veränderung am Repo.** Nur gelesen und `npm audit` ausgeführt; der Arbeitsbaum ist unverändert (`git status` leer).
