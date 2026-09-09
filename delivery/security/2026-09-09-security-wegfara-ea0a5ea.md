---
type: security
repo: Wegfara
commit: ea0a5ea
date: 2026-09-09
---

# Security: Wegfara (ea0a5ea)

Automatisch erstellt vom appbaua-Worker am 2026-09-09.

# Security-Check wegfara — Bericht

## Kurz-Zusammenfassung

Das Repo hat eine ausführliche, verbindliche `delivery/security.md` (SOLL); dagegen wurde geprüft. Auth-Fundament (Passkey/Magic-Link, Token-Entropie, Cookie-Flags, Mandantentrennung im DB-Layer, Verschlüsselung der Account-Schlüssel, Entfernung des alten Gastzugangs, Deploy-Token mit `timingSafeEqual`) ist insgesamt solide und deckt sich weitgehend mit der Vorgabe. Fünf Abweichungen wurden gefunden, zwei davon mit hohem Schweregrad und akuter Angriffsfläche (bekannte kritische CVEs in Abhängigkeiten, fehlendes Offsite-Backup), eine mit hohem Schweregrad aber geringerer Ausnutzbarkeit (fehlender Organisator-Session-Widerruf), zwei mit mittlerem/niedrigem Schweregrad (Positions-Löschung, DB-Layer-Hygiene).

---

### 1. Bekannte kritische/hohe Schwachstellen in Abhängigkeiten — **hoch**

`npm audit` gegen die gesperrten Versionen in `package-lock.json` (nicht gegen eine Live-Instanz) findet 6 Schwachstellen, davon 2 kritisch:

- **next@16.2.12** (gepinnt) — kritisch: unauthentifizierte RCE (u.a. via Image-Optimization-API, CVSS 9.0/10.0), behoben ab 16.3.3.
- **maplibre-gl@6.0.0** (gepinnt) — kritisch: XSS-Sanitizer-Bypass (CVSS 10.0), behoben ab >6.4.0.
- **nodemailer@9.0.5** (gepinnt) — hoch: mehrere Schwachstellen (Domain-Validierungs-Bypass, O(n²)-DoS in der Adress-Parsing), behoben ab 9.1.0.
- **postcss**, **sharp**, **nanoid** (transitiv über next) — hoch, mit next mitgezogen.

Alle sechs liegen innerhalb der in `package.json` erlaubten Semver-Ranges (`^16.2.12`, `^6.0.0`, `^9.0.5`) — `npm audit fix` (ohne `--force`) behebt alle sechs ohne Breaking Changes, geprüft per Dry-Run.

**Empfehlung:** `npm audit fix` ausführen, Test-Suite + E2E laufen lassen, dann normal über dev promoten. Da next eine RCE-Lücke schließt und die App von außen erreichbar ist (Cloudflare Tunnel, security.md), sollte das zeitnah passieren.
**Verifiziert:** aus Code/Config (package-lock.json + npm audit), nicht live gegen die laufende Instanz getestet.

---

### 2. Backup liegt nur auf dem Beelink selbst — kein zweites Ziel außerhalb — **hoch**

`security.md` fordert ausdrücklich: *"Ziel: ein zweites Ziel ausserhalb des Beelink. Ein Backup, das nur auf derselben Maschine liegt, gilt als nicht vorhanden."* Tatsächlich schreibt `createBackup` (`lib/backup/store.ts`) ausschließlich nach `BACKUP_DIR`, was laut `delivery/devops.md` auf `~/wegfara-backups/` auf demselben Beelink zeigt — dev und prod teilen sich sogar dasselbe Verzeichnis auf derselben Maschine. Im gesamten Repo (Code, Workflows, Compose-Datei) gibt es keinen Mechanismus, der Backups zusätzlich an ein zweites, externes Ziel überträgt (kein rclone/rsync/S3/o.ä.).

Damit ist ein Totalausfall oder Datenverlust des Beelink (Hardwaredefekt, Diebstahl, Ransomware) nicht durch das Backup abgedeckt — genau der Fall, den die Vorgabe ausschließen soll.

**Empfehlung:** Zusätzliches Sync-Ziel für `~/wegfara-backups/` einrichten (z.B. ein günstiger Cloud-Objectstore oder ein zweiter Host), entweder als Cron-Job auf dem Beelink oder als zusätzlicher Schritt im `deploy-prod.yml`-Workflow nach dem Backup-Schritt.
**Verifiziert:** aus Code/Config (store.ts, docker-compose.yml, devops.md), nicht live auf dem Beelink geprüft (kein SSH-Zugriff in dieser Session).

---

### 3. Organisator kann keine fremden Sitzungen widerrufen — **hoch**

`security.md` verspricht: *"Sitzungen lassen sich aus der Ferne beenden: bei Geraeteverlust kann der betroffene Teilnehmer — und der Organisator der Reise — alle Sitzungen des Kontos widerrufen."* Implementiert ist nur die Selbst-Variante: `logoutEverywhere()` (`lib/auth/login.ts:232`, aufgerufen über `app/api/auth/abmelden/ueberall/route.ts`) nimmt ausschließlich `session.participant.id` der gerade angemeldeten Person — es gibt keine Route, über die ein Organisator/Account-Admin die Sitzungen einer *anderen* Person beendet. Eine neue Einladung entwertet nur den Zugangslink (`invalidateAccessLinks`), nicht bestehende Sessions. Der einzige Organisator-Weg ist das vollständige Löschen der Person (`DELETE /api/participants`) — keine gezielte Sitzungs-Beendigung. `req-023-teilnehmer-einladen.md:140` listet "Beenden fremder Sitzungen bei Geräteverlust" selbst explizit als nicht umgesetzten Punkt.

Praktische Folge: Verliert ein Teilnehmer sein Gerät, kann der Finder die laufende Sitzung weiter nutzen, selbst nachdem der Organisator einen neuen Zugangslink für die Person erzeugt hat — genau das Szenario, das security.md abdecken will.

**Empfehlung:** Eine Route/Funktion ergänzen, mit der ein Account-Admin/Reiseleiter gezielt alle Sitzungen eines bestimmten Teilnehmers beendet (Tabelle `session`, gefiltert nach `participant_id`, ohne die Person selbst zu löschen).
**Verifiziert:** live im Code bestätigt (Route- und Funktionssignaturen gelesen), kein Zugriff auf eine laufende Instanz nötig, da rein aus dem Quelltext ersichtlich.

---

### 4. Standortdaten werden nicht automatisch nach Reiseende gelöscht — **mittel**

`security.md`: *"Positionen werden nur bei aktiver Reise und nur mit Zustimmung des Teilnehmers geteilt und nach Reiseende geloescht."* Tatsächlich wird ein Eintrag in `trip_position` nur gelöscht, wenn (a) der Teilnehmer das Teilen manuell ausschaltet (`setPositionSharing`, `lib/db/position-sharing.ts:49-56`) oder (b) die ganze Reise gelöscht wird (Cascade). Der Wechsel des `Zustand`s auf „Abgeschlossen" (`PATCH /api/trips`, `setTripState`) rührt `trip_position`/`position_sharing` nicht an, und der berechnete `Zeitstatus` „Beendet" wird laut Glossar nie aktiv gesetzt bzw. abgefragt, um eine Bereinigung auszulösen. Es existiert auch kein Cron-/Batch-Job dafür (nur `lib/documents/daily-audit.ts` für verwaiste Belege, keine Entsprechung für Positionen).

Ergebnis: Die zuletzt bekannte Position eines Teilnehmers bleibt nach Reiseende in der Datenbank stehen, solange niemand aktiv das Teilen ausschaltet oder die Reise löscht — ein personenbezogenes Datum (Standort) wird länger vorgehalten als in der Datenschutz-Vorgabe zugesagt.

**Empfehlung:** Beim Setzen des Zustands „Abgeschlossen" (oder beim Erreichen des Zeitstatus „Beendet") automatisch `trip_position`/`position_sharing` für die betroffene Reise leeren — analog zum bereits vorhandenen Muster in `setPositionSharing`.
**Verifiziert:** aus Code/Config (kein Aufrufpfad gefunden, der die Löschfunktion mit einem Zustandswechsel verknüpft).

---

### 5. Mandantenprüfung im DB-Layer nicht durchgängig erzwungen (POI/Foto-Funktionen) — **niedrig**

`delivery/stack.md` fordert, dass *jede* Abfrage auf Nutzerdaten nach Account filtert. Drei Funktionen weichen davon ab, indem sie selbst keine `accountId` entgegennehmen oder prüfen und sich stattdessen auf den Aufrufer verlassen:

- `createPois(db, tripId, drafts)` — `lib/db/pois.ts:160` — fügt POIs allein anhand der übergebenen `tripId` ein, ohne zu prüfen, ob sie zum aufrufenden Account gehört.
- `listPhotosOfPoi`, `listPhotoFileNamesOfPoi`, `replacePoiPhotos` — `lib/db/poi-photos.ts:46/80/229` — arbeiten nur mit `poiId`/`tripId`, ohne Account-Filter.

Aktuell besteht kein ausnutzbarer Pfad: Der einzige Aufrufer, `app/api/poi-search/route.ts`, prüft vorher per `findTrip(db, accountId, tripId)`, ob die Reise zum Account gehört (Zeile ~76–83), und für Fotos läuft die `poiId` über bereits accountgeprüfte `createPoi`/`createPois`-Ergebnisse. Damit ist es aktuell kein IDOR, aber eine Architekturabweichung: Fügt jemand künftig einen zweiten Aufrufer hinzu, der diese Prüfung vergisst, entsteht sofort eine Lücke, ohne dass der DB-Layer selbst sie verhindert. Die zugehörigen Tests (`pois.test.ts`, `poi-photos.test.ts`) decken diesen Fall nicht ab (keine account-fremde ID im Testszenario).

**Empfehlung:** `accountId` als Pflichtparameter in diese drei Funktionen aufnehmen und per `... and trip_id in (select id from trip where account_id = $x)` filtern, wie es die übrigen `lib/db/`-Funktionen bereits konsequent tun; einen Test mit account-fremder `tripId`/`poiId` ergänzen.
**Verifiziert:** aus Code/Config (Funktionssignaturen, Aufrufkette, Testabdeckung geprüft); kein Live-Exploit versucht.
