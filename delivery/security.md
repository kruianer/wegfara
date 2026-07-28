---
project: wegfara
---

# Security-Vorgaben

Bindende Vorgabe fuer den Security-Task des autonomen Workers (req-014).
Er prueft bei jedem Lauf das IST des Repos gegen dieses SOLL.

## Erreichbarkeit

- Zugriff: auch von aussen (Internet). Der Begleiter muss unterwegs im
  Mobilnetz funktionieren — eine rein interne Loesung scheidet aus.
- Der Beelink hat keine feste IP. Beide Umgebungen sind ueber einen
  Cloudflare Tunnel (`cloudflared`) erreichbar: der Beelink baut die
  Verbindung nach aussen auf. Keine Portfreigabe im Router, kein
  eingehender Zugriff auf das Heimnetz.
- HTTPS: Pflicht fuer beide Umgebungen (dev.wegfara.com und
  app.wegfara.com), terminiert durch Cloudflare. Kein unverschluesselter
  Zugriff, keine Zertifikatswarnung. Ohne HTTPS liefern Browser weder
  Standort noch Kamera — die App waere funktionsunfaehig, nicht bloss
  unsicher.
- Nur die Anwendung ist von aussen erreichbar. PostgreSQL, das
  Bildverzeichnis und Verwaltungszugaenge des Beelink sind nie aus dem
  Internet erreichbar und gehoeren nie in den Tunnel.

## Zugriffskreis

- Nutzer: mehrere Personen — der Betreiber sowie Familie und Freunde als
  Teilnehmer einer Reisegruppe.
- Zugangsschutz: Login ist Pflicht. Jeder Zugriff auf Reisedaten setzt
  eine angemeldete Person voraus.
- Anmeldeverfahren: Passkey (WebAuthn) als Standard. Fuer Teilnehmer,
  deren Geraet keine Passkeys unterstuetzt, gibt es einen Magic Link per
  E-Mail als Alternative — kurz gueltig, einmal verwendbar. Passwoerter
  gibt es nicht.
- Sitzungsdauer richtet sich nach dem Reisezeitraum aus der Datenbank,
  nicht nach einer festen Frist: ein Teilnehmer bleibt von einigen Tagen
  vor Reisebeginn bis einige Tage nach Reiseende angemeldet und muss
  sich waehrend der Reise nie neu anmelden. Danach laeuft die Sitzung
  automatisch ab.
- Die Sitzung ueberdauert Schliessen der App, Neustart des Geraets und
  System-Updates — sie liegt in einem persistenten Cookie, nicht im
  Arbeitsspeicher. Nur aktives Abmelden, ein neues Geraet oder das
  Loeschen der Browserdaten beendet sie vorzeitig.
- Wer waehrend einer laufenden Reise ausgesperrt ist (neues Geraet,
  Browserdaten geloescht, kein Zugriff aufs Postfach), muss ohne E-Mail
  wieder hineinkommen: der Organisator kann jederzeit einen neuen
  Zugangslink fuer diesen Teilnehmer erzeugen und ihm auf jedem Weg
  zukommen lassen — als QR-Code zum Abscannen vom Geraet eines
  Mitreisenden oder verschickt ueber einen beliebigen Kanal
  (Messenger, SMS). Niemand darf unterwegs dauerhaft ausgesperrt
  bleiben.
- Weil ein solcher Link ueber unsichere Kanaele laeuft und an die
  falsche Person geraten kann, ist er kurz gueltig und genau einmal
  verwendbar. Nach der Nutzung — oder nach Ablauf — ist er wertlos.
  Beim Einloesen richtet der Teilnehmer einen neuen Passkey ein; der
  Link selbst ist nur der Weg zurueck, kein Dauerzugang.
- Sitzungen lassen sich aus der Ferne beenden: bei Geraeteverlust kann
  der betroffene Teilnehmer — und der Organisator der Reise — alle
  Sitzungen des Kontos widerrufen, ohne die Reise fuer die anderen zu
  stoeren.
- Beitritt ausschliesslich per Einladung (QR-Code/Einladungslink). Keine
  offene Registrierung.
- Einladungslinks laufen ab und gelten nur fuer die eine Gruppe, fuer
  die sie erzeugt wurden. Ein Link ist kein Dauerzugang.
- Teilnehmer sehen nur Daten der Reisen, zu denen sie gehoeren.
- Mandantentrennung: Jede Abfrage auf Nutzerdaten filtert nach Account
  (siehe [stack.md](stack.md)). Auch solange nur ein Mandant existiert,
  ist ein fehlender Mandantenfilter ein Sicherheitsmangel — er faellt
  erst auf, wenn es zu spaet ist.

## Backup & Wiederherstellung

- Backup erwartet: ja. Taeglich, automatisch, durch die Backup-Funktion
  der Anwendung (siehe [stack.md](stack.md)) — DB-Inhalt und
  Bilddateien in einem gemeinsamen, zueinander passenden Lauf.
- Ziel: ein zweites Ziel ausserhalb des Beelink. Ein Backup, das nur auf
  derselben Maschine liegt, gilt als nicht vorhanden.
- Zusaetzlich muss vor jedem prod-Deploy ein aktuelles Backup vorliegen
  (siehe [devops.md](devops.md)).
- Wiederherstellung: muss getestet sein. Ein nie zurueckgespieltes
  Backup ist eine Vermutung, kein Backup.

## Datenschutz

- Sensible/personenbezogene Daten: ja — Standorte der Teilnehmer,
  Reiseplaene, Belege und Tickets (koennen Namen, Adressen und
  Zahlungsdaten enthalten), Ausgaben innerhalb der Gruppe.
- Standort: nur die jeweils letzte bekannte Position je Teilnehmer wird
  gespeichert und beim naechsten Update ueberschrieben. Keine Historie,
  kein Bewegungsprofil. Positionen werden nur bei aktiver Reise und nur
  mit Zustimmung des Teilnehmers geteilt und nach Reiseende geloescht.
- Belege und Tickets sind nur fuer Mitglieder der zugehoerigen Gruppe
  abrufbar — nie ueber eine erratbare oder oeffentlich teilbare URL.
- Secrets (OpenAI-Key, DB-Zugang, Backup-Ziel) liegen ausschliesslich in
  Umgebungsvariablen, nie im Repo.
- An externe Dienste gehen nur die fuer die Anfrage noetigen Daten. An
  Google Maps werden keine Nutzerdaten uebergeben — Navigation nur als
  Link (siehe [vision.md](vision.md)).
- Ein Teilnehmer kann seine Daten loeschen lassen; mit dem Loeschen
  einer Reise verschwinden auch ihre Bilddateien.
