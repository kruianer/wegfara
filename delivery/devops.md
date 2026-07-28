---
project: wegfara
setup: 1
---

# DevOps Convention

Diese Datei ist bindend für den autonomen Worker. Befolge sie exakt.

## Environments

| Environment | Branch | URL                     |
|-------------|--------|-------------------------|
| dev         | dev    | https://dev.wegfara.com |
| prod        | main   | https://app.wegfara.com |

Hosting platform: Beelink (selbst gehostet). Beide Umgebungen laufen auf
derselben Maschine als getrennte Instanzen — eigene Container, eigene
PostgreSQL-Datenbank und eigenes Bildverzeichnis je Umgebung. dev und
prod teilen sich niemals Daten.

Erreichbar sind beide über einen Cloudflare Tunnel (`cloudflared`); der
Beelink hat keine feste IP und keine Portfreigabe. Weil kein eingehender
Zugriff möglich ist, deployt die GitHub Action nicht per SSH: auf dem
Beelink läuft ein self-hosted Runner, der die Jobs abholt.

## Deploy Trigger

- **dev: vollautomatisch.** Jeder Push nach `dev` löst eine GitHub
  Action aus, die die dev-Umgebung deployt. Kein manueller Schritt.
- **prod: nie automatisch.** Ein Merge nach `main` deployt NICHT. Der
  prod-Deploy ist immer ein eigener, bewusst ausgelöster Schritt —
  entweder manuell durch den Nutzer oder auf seine ausdrückliche
  Anweisung in einer Chat-Session.

Die Workflows liegen in `.github/workflows/`. Der prod-Workflow wird
ausschließlich manuell gestartet (`workflow_dispatch`, mit Eingabe des
Wortes `deploy` als Bestätigung) und hat keinen Push- oder
Merge-Trigger. Er sichert vor jedem Deploy DB und Bilddateien nach
`~/wegfara-backups/`.

## Aufbau auf dem Beelink

- Runner: systemd-Dienst `actions.runner.kruianer-wegfara.beelink-wegfara`,
  Label `wegfara` — die Workflows verlangen `runs-on: [self-hosted, wegfara]`.
- Konfiguration: `~/wegfara-env/dev.env` und `~/wegfara-env/prod.env`
  (Rechte 600, außerhalb des Repos). Enthalten DB-Zugang, `AUTH_SECRET`,
  Tunnel-Token, `APP_PORT` und `DATA_DIR`.
- Daten: `~/wegfara-data/{dev,prod}/images/` für Bilddateien,
  `~/wegfara-backups/` für Sicherungen.
- Ports: dev `127.0.0.1:8092`, prod `127.0.0.1:8093` — nur lokal
  gebunden. PostgreSQL hat keine Portfreigabe.
- Compose-Projekte: `wegfara-dev` und `wegfara-prod`, beide aus
  `deploy/docker-compose.yml` mit der jeweiligen env-Datei.

Auf derselben Maschine laufen fremde Projekte (livinggardentwin,
appbaua, cellarvoice, mytravelcompass). Deren Container, Ports und
Verzeichnisse werden nie angefasst.

## Promotion (dev → prod)

Promotion ist zweistufig — Merge und Deploy sind getrennte Schritte:

1. Pull Request von `dev` nach `main`. NUR der Nutzer merged ihn. Der
   Worker öffnet ihn höchstens.
2. Danach der prod-Deploy als eigener, manuell ausgelöster Schritt. Ein
   Merge nach `main` allein verändert prod nicht.

Der zweite Schritt darf nur auf ausdrückliche Anweisung des Nutzers
erfolgen — von ihm selbst ausgelöst oder in einer Chat-Session, in der
er es unmissverständlich verlangt.

## Acceptance / Quality Gate

- Der Nutzer nimmt Änderungen auf https://dev.wegfara.com ab, bevor
  promotet wird.
- Eine Änderung, die auf der dev-URL nicht manuell überprüfbar ist, ist
  nicht fertig.
- Die vollständige Test-Suite (siehe [stack.md](stack.md)) muss vor der
  Promotion grün sein — automatisierte Hälfte des Gates; die manuelle
  Abnahme ist die andere.

## Datenbank-Migrationen

- Schemaänderungen laufen als versionierte Migrationen im Repo mit, nie
  von Hand auf der Datenbank.
- Eine Migration wird auf dev angewendet und dort abgenommen, bevor sie
  über die Promotion nach prod gelangt.
- Migrationen müssen die prod-Daten erhalten — kein Zurücksetzen der
  Datenbank als Teil eines Deploys.

## Backup

- Die Backup-Funktion der Anwendung (siehe [stack.md](stack.md)) sichert
  DB und Bilddateien der prod-Umgebung.
- Vor der Promotion nach prod muss ein aktuelles Backup vorliegen.

## Server-Zugriff (SSH)

Claude hat SSH-Zugriff auf den Beelink und darf dort Betrieb und
Fehlersuche selbst durchfuehren — Logs lesen, Container-Status pruefen,
Dienste neu starten, Datenbank abfragen.

- **dev: uneingeschraenkt.** Auch der autonome Worker darf sich auf dev
  selbst helfen — Logs, Neustarts, Zuruecksetzen der Umgebung.
- **prod, in einer Session mit dem Nutzer: voller Zugriff** fuer Betrieb
  und Fehlerbehebung, einschliesslich eingreifender Massnahmen wie
  Neustarts und Korrekturen.
- **prod, autonomer Worker: kein Zugriff.** Ohne den Nutzer am
  Bildschirm wird auf prod nicht gearbeitet — weder lesend noch
  schreibend.

Eine einzige Ausnahme gilt auch bei vollem Zugriff:

- **Kein prod-Deploy ohne ausdrueckliche Zustimmung** — auch nicht per
  SSH. Neuen Stand nach prod bringen erfolgt nur, wenn der Nutzer es in
  der laufenden Session verlangt, und ueber den manuell ausgeloesten
  Workflow (siehe Deploy Trigger). Der SSH-Zugang ist Betriebswerkzeug,
  kein zweiter Deploy-Kanal.

Alles andere ist erlaubt. Eingriffe auf prod werden dem Nutzer
gegenueber benannt: was getan wurde und warum.

## Hard Rules

- Der Worker committet ausschließlich nach `dev`.
- Der autonome Worker deployt NIE nach prod, merged NIE nach `main`,
  pusht NIE direkt nach `main`. Ohne den Nutzer am Bildschirm gibt es
  keinen prod-Deploy — das ist die Absicherung gegen Fehldeploys in der
  Nacht.
- Ein prod-Deploy aus einer Chat-Session ist nur zulässig, wenn der
  Nutzer ihn in genau dieser Session ausdrücklich verlangt. Eine frühere
  Erlaubnis gilt nicht fort, und aus "es ist fertig" oder "sieht gut
  aus" folgt kein Deploy-Auftrag.
- Im Zweifel nicht deployen, sondern fragen.
- Der autonome Worker fasst die prod-Datenbank und das
  prod-Bildverzeichnis nie an — weder lesend noch schreibend. In einer
  Session mit dem Nutzer ist der Zugriff erlaubt (siehe
  Server-Zugriff).
