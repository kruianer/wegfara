---
type: security
repo: Wegfara
commit: 66e0c16
date: 2026-07-29
---

# Security: Wegfara (66e0c16)

Automatisch erstellt vom appbaua-Worker am 2026-07-29.

Repo is clean again. Here is the security check report:

# Security-Check — 2026-07-29

## Kurz-Zusammenfassung

`delivery/security.md` liegt vor und wurde als SOLL herangezogen. Die App befindet sich noch in einer sehr frühen Ausbauphase (nur req-001 bis req-006 umgesetzt) — Login/Zugriffsschutz und die Backup-Funktion der Anwendung, die security.md fordert, existieren im Code noch nicht. Dadurch ist der aktuell auf dev live erreichbare `/go`-Bereich unauthentifiziert einsehbar und zeigt reale, personenbezogene Reisedaten des Betreibers. Das ist der schwerwiegendste Befund. Daneben: ein unauthentifizierter Schreib-Endpunkt, ein Backup, das (Stand Code) nur an einem Deploy-Trigger hängt und nicht auf ein zweites, externes Ziel zeigt, sowie zwei hoch eingestufte transitive npm-Schwachstellen (postcss, sharp) ohne sauberen Fix ohne Breaking Change.

Keiner der Befunde deutet auf Bösartigkeit hin — sie spiegeln den erwarteten Zustand eines Projekts, das Auth und Backup laut Requirements-Backlog noch nicht gebaut hat. Weil die App aber schon live auf einer öffentlich erreichbaren Domain mit echten Daten läuft, sind sie trotzdem meldenswert.

## Befunde

### 1. `/go` zeigt reale Reisedaten ohne jede Authentifizierung (hoch)

`app/go/page.tsx` rendert `listTrips`/`listActivities`/`listTransfers` für den fest hinterlegten `ACCOUNT_ID` ohne jegliche Login- oder Sitzungsprüfung. Im Repo gibt es keine `middleware.ts`, keine Auth-Bibliothek und keinen Session-Code — weder Passkey/WebAuthn noch Magic Link sind implementiert.

**Live verifiziert:** `https://dev.wegfara.com/go` liefert ohne Login die echte Wien-Reise des Betreibers (9.–11. Oktober 2026, Hotel "Am Stephansplatz", Restaurant Figlmüller) — vollständig lesbar für jeden, der die URL kennt oder errät.

`delivery/security.md` fordert unter "Zugriffskreis": *"Login ist Pflicht. Jeder Zugriff auf Reisedaten setzt eine angemeldete Person voraus."* Das ist im IST nicht erfüllt.

**Empfehlung:** Vor jedem weiteren Feature-Ausbau die Auth-Anforderung (Passkey + Magic Link, Sitzungsdauer an Reisezeitraum gekoppelt) als eigenes Requirement einlasten und umsetzen, bevor `/go` oder `/plan` mit echten Daten weiter öffentlich erreichbar bleiben. Bis dahin ersatzweise: dev-Umgebung nicht mit echten personenbezogenen Reisedaten seeden, oder den Zugriff temporär z. B. per Cloudflare Access vor der Anwendung einschränken.

### 2. Schreibender API-Endpunkt ohne Auth- und Mandantenprüfung (hoch)

`app/api/activity-option-selection/route.ts` (POST) nimmt `tripId`, `startAt`, `endAt`, `activityId` direkt aus dem Request-Body entgegen und ruft `setActivityOptionSelection` auf. Weder die Route noch `lib/db/activity-option-selections.ts:37-51` prüfen, ob die anfragende Person angemeldet ist oder ob `tripId` zum aktuellen Account gehört — im Unterschied zu allen lesenden Funktionen (`listTrips`, `listActivities`, `listTransfers`, `listActivityOptionSelections`), die konsequent nach `account_id` filtern.

Aus Code erschlossen (nicht live gegen Produktivdaten getestet, um keine Daten zu verändern). Solange nur ein Account existiert, ist der Mandantenbezug praktisch nicht verletzbar; der Endpunkt lässt sich aber schon jetzt ohne jede Anmeldung von außen beschreiben.

**Empfehlung:** Sobald der Auth-Task umgesetzt ist, diesen Endpunkt an die Sitzungsprüfung koppeln und zusätzlich serverseitig verifizieren, dass `tripId` zum Account der angemeldeten Person gehört — nach demselben Muster wie die Lese-Funktionen.

### 3. Backup erfüllt die Vorgabe aus security.md nicht (mittel)

security.md fordert: täglich, automatisch, durch die Backup-Funktion der Anwendung, DB und Bilddateien in einem gemeinsamen Lauf, mit einem zweiten Ziel außerhalb des Beelink, und eine getestete Wiederherstellung.

Im Code (`lib/`, `scripts/`) existiert keine Backup-Implementierung. Die einzige vorhandene Sicherung ist der Schritt "Backup vor dem Deploy" in `.github/workflows/deploy-prod.yml`: Sie läuft nur unmittelbar vor einem manuell ausgelösten prod-Deploy (nicht täglich/automatisch, unabhängig von einem Deploy) und legt DB-Dump und Bild-Archiv unter `~/wegfara-backups/` auf **demselben** Beelink ab — also nicht auf einem zweiten, externen Ziel. Ein Restore-Test ist nirgends im Repo hinterlegt.

Aus Code/Config erschlossen, nicht live geprüft (kein SSH-Zugang zum Beelink in dieser Session).

**Empfehlung:** Backup als eigenständiges Requirement (Anwendungsfunktion, wie in stack.md vorgesehen) einlasten: täglicher, automatischer Lauf, DB + Bilder gemeinsam, Übertragung an ein Ziel außerhalb des Beelink, plus ein dokumentierter/automatisierter Restore-Test.

### 4. Zwei hoch eingestufte transitive Schwachstellen in Dependencies (niedrig-mittel)

`npm audit --production` meldet 3 "high"-Findings über transitive Abhängigkeiten von `next@16.2.12`: `postcss` (<=8.5.17, u. a. XSS im CSS-Stringify-Output, Path Traversal/Info-Disclosure über `sourceMappingURL`) und `sharp` (<0.35.0, mehrere libvips-CVEs). Ein Fix ist laut `npm audit` nur über `npm audit fix --force` verfügbar, was ein Downgrade auf `next@9.3.3` (Breaking Change) erzwingen würde.

Aus `npm audit`-Output erschlossen, nicht live gegen einen konkreten Angriffspfad getestet. `postcss`/`sharp` werden im Next-Build-Prozess verwendet, nicht direkt zur Laufzeit mit Nutzereingaben aus dem Internet konfrontiert — das Risiko ist eher build-seitig als ein direkt ausnutzbarer Pfad.

**Empfehlung:** Regelmäßig prüfen, ob eine neuere `next`-16.x-Version die transitive `postcss`/`sharp`-Version ohne Breaking Change anhebt. Kein akuter Blocker für den aktuellen Ausbauzustand.

## Was in Ordnung war

- Secrets (DB-Zugang, `AUTH_SECRET`, OpenAI-Key, Tunnel-Token) liegen ausschließlich in env-Dateien außerhalb des Repos; im Code kein hartkodiertes Secret, keine `.env`-Datei in der Git-Historie.
- Alle vorhandenen Lese-Zugriffe filtern konsequent nach `account_id` — die geforderte Mandantentrennung ist im Datenzugriffs-Layer eingehalten.
- PostgreSQL und Bildverzeichnis sind nicht portfreigegeben; nur die App lauscht lokal, alles läuft über den Cloudflare Tunnel.
- `dev.wegfara.com` live per HTTPS erreichbar, kein Zertifikatsfehler (live verifiziert).
- `robots.txt` schließt Suchmaschinen aus.
- Der prod-Deploy-Workflow hat korrekt keinen Push-Trigger, nur `workflow_dispatch` mit Bestätigungswort.
- `app.wegfara.com` antwortete beim Live-Check mit HTTP 530 (Cloudflare-Fehler) — plausibel, da prod laut Backlog noch nicht befüllt ist; kein Datenleck, da keine Antwort ausgeliefert wird.
