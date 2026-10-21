---
type: security
repo: Wegfara
commit: 3e05f3e
date: 2026-10-21
---

# Security: Wegfara (3e05f3e)

Automatisch erstellt vom appbaua-Worker am 2026-10-21.

# Security-Check wegfara — Bericht

**Grundlage:** `delivery/security.md` und `CLAUDE.md` lagen vor und dienten als SOLL. Geprüft wurden Code, Config und Dependencies (`npm audit`). Es gab keinen Zugang zu Infrastruktur oder SSH, und keine Live-Verifikation gegen dev oder prod. Alles hier ist aus Code oder Config erschlossen. Im Repo wurde nichts geändert.

## Kurz-Zusammenfassung

Zugriff, Auth und Secret-Handling entsprechen weitgehend der Vorgabe. Das Hauptproblem sind Abhängigkeiten: `npm audit --omit=dev` meldet 7 Schwachstellen (2 kritisch, 5 hoch), darunter unauthentifizierte Remote Code Execution in Next.js. Das Backup-Ziel außerhalb des Beelink konnte ich im Repo nicht finden.

| # | Finding | Schweregrad |
|---|---|---|
| 1 | Next.js mit kritischen Schwachstellen (16.2.12) | hoch |
| 2 | maplibre-gl 6.0.0: XSS-Sanitizer-Bypass (kritisch gemeldet) | mittel |
| 3 | nodemailer 9.0.5: mehrere Schwachstellen (hoch) | mittel |
| 4 | sharp, postcss, nanoid, source-map-js (transitiv, hoch) | mittel |
| 5 | Backup-Ziel außerhalb des Beelink im Repo nicht erkennbar | mittel |
| 6 | Docker-Image `cloudflared:latest` ist nicht gepinnt | niedrig |
| 7 | Wiederherstellungstest nicht nachweisbar | niedrig |

## Findings

### 1. Next.js 16.2.12 mit kritischen Schwachstellen — hoch
- **Befund:** `npm audit` listet für `next` unter anderem:
  - unauthentifizierte RCE in der Image-Optimization-API bei AVIF-Dateien,
  - RCE in `next/og` `ImageResponse`,
  - SSRF in der Image Optimization,
  - Cache Poisoning bei SSG/ISR im Self-Hosting, mit Inhaltsvertauschung zwischen Nutzern,
  - Information Disclosure in Metadata-Image-Routes.
- **Relevanz:** Die App ist laut Vorgabe über Cloudflare aus dem Internet erreichbar. Ob die betroffenen Features (Image Optimization, `next/og`) tatsächlich genutzt werden, habe ich nicht geprüft.
- **Empfehlung:** `npm audit fix` bzw. Next auf die gepatchte Version anheben, Tests laufen lassen, zuerst nach dev deployen. Solange das offen ist: Image Optimization abschalten (`images.unoptimized` oder `images.loader`), falls sie nicht gebraucht wird.
- **Verifikation:** aus Code/Config erschlossen (`npm audit`, `npm ls`), nicht live.

### 2. maplibre-gl 6.0.0 (direkte Abhängigkeit) — mittel
- **Befund:** XSS-Sanitizer-Bypass in `DOM.sanitize()`. npm stuft ihn als kritisch ein. Betroffen sind Versionen bis 6.4.0.
- **Relevanz:** Mittel statt hoch, weil die Nutzung vermutlich nur eigene Kartendaten betrifft. Das habe ich nicht im Detail geprüft.
- **Empfehlung:** Auf eine Version über 6.4.0 aktualisieren. Die mitgelieferte Kopie unter `/maplibre` (öffentlicher Worker-Pfad in `middleware.ts`) dabei mit aktualisieren.
- **Verifikation:** aus Code/Config erschlossen.

### 3. nodemailer 9.0.5 — mittel
- **Befund:** Betroffen sind Versionen bis 10.0.5. Gemeldet werden:
  - Umgehung der Empfängerdomain-Validierung, so dass Mails an eine Angreiferdomain gehen können,
  - ein prozessglobaler DNS-Cache, der TLS-`servername` über Transports hinweg wiederverwendet und so SMTP-Zugangsdaten offenlegen kann,
  - mehrere DoS-Schwachstellen im Adress-Parser.
- **Relevanz:** Die App versendet Magic-Link- und Anmeldemails. Die Adressen kommen aus der Datenbank, das Angriffsfenster ist daher begrenzt.
- **Empfehlung:** Auf eine gepatchte Version aktualisieren.
- **Verifikation:** aus Code/Config erschlossen.

### 4. Transitive Abhängigkeiten — mittel
- **Befund:**
  - `sharp` ≤ 0.35.5-rc.1: libvips-, libheif- und librsvg-Lücken. Installiert ist 0.34.5, und es verarbeitet Bilder und Belege der Nutzer.
  - `postcss` ≤ 8.5.22: XSS und Dateilesen über Source-Maps.
  - `nanoid` < 3.3.18.
  - `source-map-js` ≤ 1.2.1: DoS.
- **Empfehlung:** `npm audit fix` ausführen, `sharp` bei Bedarf per `overrides` anheben. Ein regelmäßiger `npm audit` in CI (dev-Workflow) verhindert, dass das erneut unbemerkt liegen bleibt.
- **Verifikation:** aus Code/Config erschlossen.

### 5. Backup-Ziel außerhalb des Beelink nicht erkennbar — mittel
- **SOLL:** Ein zweites Ziel außerhalb des Beelink. Ein Backup auf derselben Maschine gilt als nicht vorhanden.
- **IST:** Der prod-Deploy sichert nach `~/wegfara-backups/`, das ist ein Verzeichnis auf dem Beelink (`delivery/devops.md`). Der tägliche Lauf hängt in `instrumentation.ts`. In `deploy/`, `.github/` und `lib/backup/` fand ich keine Spur einer Kopie auf ein externes Ziel (kein rclone, rsync oder Ähnliches). Die Backup-Seite der App bietet einen Download (req-071), der aber manuell ist.
- **Einschränkung:** Eine externe Kopie könnte außerhalb des Repos eingerichtet sein, etwa als Cronjob auf dem Host. Das konnte ich ohne Serverzugang nicht prüfen.
- **Empfehlung:** Täglichen Offsite-Transfer einrichten, z. B. per Job auf dem Beelink, der `~/wegfara-backups/` verschlüsselt auf externen Speicher kopiert. Das Ziel als Umgebungsvariable führen (so verlangt es die Vorgabe) und in `devops.md` dokumentieren.
- **Verifikation:** nur aus Code/Config erschlossen.

### 6. `cloudflare/cloudflared:latest` ungepinnt — niedrig
- **Befund:** `deploy/docker-compose.yml:110` nutzt `latest`. Ein Redeploy kann unbemerkt eine andere, möglicherweise inkompatible oder kompromittierte Version ziehen. Die Datenbank ist dagegen mit `postgres:17-alpine` gepinnt.
- **Empfehlung:** Auf eine konkrete Version pinnen und kontrolliert aktualisieren.
- **Verifikation:** aus Code/Config erschlossen.

### 7. Wiederherstellungstest nicht nachweisbar — niedrig
- **Befund:** Die Vorgabe verlangt ein getestetes Restore. Im Code gibt es eine Restore-Funktion samt Tests (`wiederherstellen/route.test.ts`, `import.test.ts`). Einen dokumentierten Restore auf realen Daten, z. B. prod-Backup nach dev, konnte ich nicht nachweisen.
- **Empfehlung:** Einen Restore-Test auf dev durchführen und das Datum dokumentieren, danach regelmäßig wiederholen.
- **Verifikation:** aus Code/Config erschlossen.

## Positiv bestätigt (aus Code/Config)

- **Zugang:**
  - `middleware.ts` verlangt für alle Pfade eine Sitzung, bis auf eine kleine Liste öffentlicher Pfade (Anmeldung, Einladung, Ersteinrichtung, Health, Backups, Kartenworker, Icon).
  - Der öffentliche Pfad `/api/backups` prüft die Berechtigung selbst: Deploy-Token (`lib/backup/deploy-token.ts`) oder Sitzung des Gesamt-Admins.
- **Erreichbarkeit:** Die App bindet nur an `127.0.0.1`. Der Zugang läuft über den Cloudflare Tunnel, und der Datenbank-Port ist nicht veröffentlicht.
- **Secrets:** Keine `.env`-, Schlüssel- oder Zertifikatsdateien sind eingecheckt. Die Pattern-Suche nach hartcodierten Secrets (Code ohne `delivery/`) fand nichts. Die Treffer in der Git-History zu `AUTH_SECRET=` sind nur Commits früherer Security-Berichte, also Dokumentation, keine Werte. Eine vollständige History-Prüfung auf Secrets habe ich nicht gemacht.

## Nicht geprüft

- Live-Zustand von dev.wegfara.com und app.wegfara.com: HTTPS, Tunnel-Konfiguration, Header
- Rechte von `~/wegfara-env/*.env` auf dem Beelink
- Cloudflare-Access-Regeln und SSH
- Inhalt der Backups (Verschlüsselung)
