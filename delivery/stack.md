---
project: wegfara
template: A
---

# Tech Stack

Diese Datei ist bindend für den autonomen Worker. Befolge sie exakt.

## Languages & Frameworks

- Sprache: TypeScript auf Node.
- Framework: Next.js (App Router) — fullstack, ein Deploy-Ziel.
- Auslieferung ans Smartphone: PWA (installierbar auf dem Homescreen),
  kein App Store. Kamera (Belege) und GPS über Web-APIs. Kein
  Hintergrund-Standort — Positionen werden nur bei geöffneter App
  aktualisiert.
- Database: PostgreSQL, selbst gehostet im Container auf dem Beelink.
- Mandantenfähigkeit: Das Datenmodell ist von Anfang an
  mehrmandantenfähig. `account` ist die oberste Tabelle; jede weitere
  Tabelle mit Nutzerdaten (Reisen, Gruppen, Belege, Ausgaben, Nutzer)
  hängt direkt oder indirekt daran und trägt eine Mandanten-Zuordnung.
  Jede Abfrage auf Nutzerdaten filtert nach Mandant — es gibt keine
  Abfrage über alle Mandanten hinweg.
  Betrieben wird vorerst genau ein Mandant (der Betreiber), fest
  hinterlegt. Funktionen zur Verwaltung von Accounts (Anlegen,
  Umschalten, Abrechnung) werden bewusst NICHT gebaut, solange es keine
  Anforderung dafür gibt. Nachträglich ist der Mandantenbezug im
  Datenmodell kaum noch einzuziehen — die Funktionen dagegen jederzeit.
- Bilder (Belege, Tickets, Fotos): Die Datei liegt im Dateisystem, nicht
  in der DB. Zu jeder Datei existiert zwingend ein Datensatz in der DB
  mit Pfad, Metadaten und Zugehörigkeit — die DB ist die
  Wahrheitsquelle, das Dateisystem nur der Ablageort. Kein Bild ohne
  Datensatz, kein Datensatz ohne Datei; verwaiste Dateien und
  Datensätze ohne Datei sind ein Fehlerzustand.
  Die Dateien liegen auf dem Beelink in einem eigenen Verzeichnis
  außerhalb des Repos, dessen Pfad über eine Umgebungsvariable
  konfiguriert wird — nie ein fest verdrahteter Pfad im Code.
- Backup ist Teil der Anwendung, nicht der Infrastruktur: wegfara
  sichert DB-Inhalt und Bilddateien selbst, in einem gemeinsamen Lauf.
  Beide Hälften müssen zueinander passen — ein Backup, das Datensätze
  ohne die zugehörigen Dateien enthält (oder umgekehrt), ist kaputt.
  Wiederherstellung muss vollständig aus dem Backup möglich sein, ohne
  Handarbeit an DB oder Dateisystem.
- Karten & POI: OpenStreetMap-Daten (Nominatim für Suche, Overpass für
  POI, MapLibre für die Darstellung). Navigation wird per Link an
  Google Maps übergeben — wegfara gibt dabei keine Nutzerdaten an
  Google weiter.
- Auth: Passkey (WebAuthn) als Standardverfahren, Magic Link per E-Mail
  als Alternative für Geräte ohne Passkey-Unterstützung. Keine
  Passwörter — kein Passwort-Feld, kein Hashing, kein Reset-Flow.
  Sitzungsdauer ergibt sich aus dem Reisezeitraum in der DB (siehe
  [security.md](security.md)).
- Erreichbarkeit: Cloudflare Tunnel (`cloudflared`) auf dem Beelink,
  HTTPS durch Cloudflare terminiert. Die Anwendung selbst lauscht nur
  lokal — sie wird nie direkt aus dem Internet angesprochen.
- E-Mail-Versand: SMTP bei All-Inkl, wo die Domain wegfara.com und die
  Postfächer liegen. Zugangsdaten (Host, Port, Benutzer, Passwort,
  Absenderadresse) ausschließlich in Umgebungsvariablen. Versand nur
  für Anmeldelinks und später Einladungen — kein Newsletter, keine
  Benachrichtigungen ohne eigenes Requirement.
- KI: OpenAI API über das offizielle OpenAI-SDK. Modell:
  `gpt-5.6-luna` — die kostengünstige Variante der GPT-5.6-Reihe,
  passend zu den kurzen Anfragen der POI-Suche. Der Modellname steht an
  genau einer Stelle im Code und ist über eine Umgebungsvariable
  übersteuerbar — ein Modellwechsel darf keine Codeänderung erfordern.
  Der Zugriff liegt zwingend hinter einer eigenen, austauschbaren
  Schnittstelle in `lib/ai/` — kein direkter SDK-Aufruf aus der
  Anwendungslogik. Ein späterer Wechsel auf ein lokales Modell (Ollama
  auf dem Beelink) muss ohne Änderung der aufrufenden Logik möglich
  sein.

## Commands

Der Worker führt diese aus; halte sie copy-paste-fähig und aktuell.

- Install: `npm install`
- Build:   `npm run build`
- Test:    `npm test`
- Lint:    `npm run lint`
- Format:  `npm run format`
- Types:   `npx tsc --noEmit`

Test-Framework: Vitest. Lint/Format: ESLint + Prettier. E2E:
Playwright, sobald es kritische Nutzerflüsse gibt.

<TODO: Die Kommandos sind Template-Defaults — beim Anlegen der
package.json prüfen und hier korrigieren, falls sie abweichen.>

## Testing

Bindende Test-Policy für den Worker.

- Jedes Requirement wird mit automatisierten Tests geliefert, die seine
  Akzeptanzkriterien abdecken. Eine Änderung ohne Test für ihr
  Verhalten ist nicht fertig.
- Jeder Bugfix beginnt mit einem fehlschlagenden Test, der den Bug
  reproduziert; dann macht der Fix ihn grün (reproduce-first). Kein
  Repro-Test → nicht gefixt.
- Test-Ebenen: Unit für Logik; Integration für alles, was eine Grenze
  überschreitet (DB, API, externer Dienst); E2E nur für kritische
  Nutzerflüsse, wenige und stabile.
- Externe Dienste (OpenAI, Nominatim, Overpass) werden in Tests
  gemockt — kein Test darf im Netz hängen oder Kosten verursachen.
- Die vollständige Test-Suite (siehe Commands) muss vor der Promotion
  nach prod grün sein — das ist die automatisierte Hälfte des
  Quality-Gates; die manuelle Abnahme des Nutzers auf der dev-URL ist
  die andere.

## Conventions

- Formatierung/Linting werden von den Tools oben durchgesetzt; vor dem
  Fertigmelden einer Änderung ausführen.
- Eine Anwendung, eine URL, zwei Bereiche: `/plan/*` ist der Planer,
  `/go/*` der Begleiter. Beide teilen sich Datenmodell, Auth und
  Gruppenlogik — es gibt keine zweite Anwendung und kein zweites
  Deploy. Welche Bereiche ein Nutzer sieht, entscheidet seine Rolle,
  nicht sein Gerät.
- `/plan` ist für Desktop optimiert, `/go` fürs Smartphone. Beide
  bleiben auf dem jeweils anderen Gerät benutzbar — eine Funktion, die
  auf einem Gerät gar nicht erreichbar ist, verletzt die Vision.
- Ordnerstruktur: `app/plan/` Planer-Routen, `app/go/`
  Begleiter-Routen, `lib/` Domänenlogik ohne UI-Bezug, `lib/ai/` die
  austauschbare KI-Schnittstelle, `components/` wiederverwendbare
  UI-Bausteine, `tests/` Testdaten und Helfer.
- Geteilte Logik gehört nach `lib/`, niemals aus `app/plan/` nach
  `app/go/` importiert (oder umgekehrt) — die beiden Bereiche kennen
  einander nicht. Das hält eine spätere Trennung in eine native
  Begleiter-App offen.
- Domänenlogik gehört nach `lib/` und ist ohne laufendes Next.js
  testbar — keine Geschäftsregeln in Komponenten oder Route-Handlern.
- Datenbankzugriff läuft ausschließlich über einen gekapselten
  Datenzugriffs-Layer in `lib/db/`. Kein SQL und kein ORM-Aufruf
  außerhalb davon — weder in Komponenten noch in Route-Handlern.
- Schreibende Zugriffe werden im Datenzugriffs-Layer gebündelt und mit
  15 Sekunden Verzögerung ausgeführt (Debounce): mehrfache Änderungen
  am selben Datensatz innerhalb dieses Fensters ergeben einen
  Schreibvorgang. Grund: unterwegs im Mobilnetz sollen Tippen und
  Umschalten keine Schreiblast pro Tastendruck erzeugen.
  Ausgenommen sind Vorgänge, bei denen Datenverlust droht oder der
  Nutzer eine Bestätigung erwartet (Anlegen, Löschen, Abmelden) — die
  werden sofort geschrieben. Ausstehende Schreibvorgänge müssen beim
  Verlassen der Seite oder Wechsel in den Hintergrund gesichert werden.
- Lesende Zugriffe sind nie verzögert.
- Naming: Dateien kebab-case, React-Komponenten PascalCase, Funktionen
  und Variablen camelCase. Domänenbegriffe im Code exakt wie im Glossar.
- Secrets (OpenAI-Key, DB-Zugang) nur über Umgebungsvariablen, nie im
  Repo.
- Das Repo liegt unter OneDrive: `.next` und `node_modules` müssen von
  der OneDrive-Synchronisation ausgeschlossen sein, sonst zerlegt der
  Sync den Build. Bei kaputtem Build zuerst `.next` löschen.

## Glossary

Domänenbegriffe, die in Requirements, Bugs und Code einheitlich
verwendet werden. capture-requirement prüft neue Begriffe gegen diese
Liste und ergänzt sie hier.

| Term | Meaning |
|------|---------|
| Account | Der Mandant — die oberste Ebene des Datenmodells, an der alle Nutzerdaten hängen. Derzeit existiert genau einer. Nicht zu verwechseln mit dem Konto eines einzelnen Teilnehmers. |
| Teilnehmer | Eine Person innerhalb eines Accounts, die an einer Reise teilnimmt. |
| Nickname | Wie ein Teilnehmer angesprochen wird — freiwillig, höchstens 20 Zeichen. Ersetzt den Namen in der Anzeige, nie in der Ablage; wo eine Bankverbindung oder Zahlung steht, gilt immer der volle Name (req-020). |
| Reise | Ein geplanter Trip mit Zeitraum, Teilnehmern und Plan. |
| Plan | Die geplante Abfolge von Programmpunkten einer Reise. |
| POI | Ein gesammelter Ort — eine Idee für die Reise, ohne feste Zeit, mit Name, Ort, Typ, Position und Status. Wird im Planer gesammelt und bewertet. |
| Programmpunkt | Ein einzelnes Element des Plans mit fester Zeit, einem Reisetag zugeordnet. Entsteht, wenn ein POI verplant wird. Nicht mit dem POI selbst zu verwechseln. |
| Gruppe | Die Teilnehmer einer Reise; Beitritt per QR-Code. |
| Anpassung | Ein von der KI vorgeschlagener Änderungsvorschlag am Plan, den der Nutzer bestätigt oder verwirft. |
| Begleiter | Der Bereich für unterwegs auf dem Smartphone (`/go`). |
| Planer | Der Bereich für die Planung vorab inklusive Gruppenabstimmung (`/plan`). |
| Beleg | Ein abgelegtes Bild (Quittung, Ticket) mit Datensatz in der DB und Datei im Dateisystem. |
| Rolle | Bestimmt, welche Bereiche ein Teilnehmer sieht — Planer, Begleiter oder beides. |
