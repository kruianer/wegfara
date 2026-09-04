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
  gibt es nicht. Ist keine E-Mail-Adresse hinterlegt, steht dieser Weg
  nicht zur Verfuegung; hereingekommen ist die Person dann per Einladung
  (req-023).
- Sitzungsdauer richtet sich nach dem **Zustand der Reise**, nicht nach
  ihrem Datum und nicht nach einer festen Frist (req-023): eine Sitzung
  gilt, solange die Person mindestens einer Reise im Zustand
  „Freigegeben" zugeordnet ist oder eine offene Bewertung hat. Trifft
  beides nicht mehr zu, endet sie beim naechsten Aufruf; die Person
  landet auf der Anmeldeseite mit dem Hinweis, dass sie derzeit keiner
  laufenden Reise zugeordnet ist. Fuer den Reiseleiter gilt die
  Einschraenkung nicht — er bleibt angemeldet, solange seine Sitzung
  nicht abgelaufen ist (90 Tage, bei Nutzung verlaengert).
  Ein Datumsfenster traefe das nicht: die Vorbereitung beginnt Wochen
  vorher, die Abrechnung zieht sich danach.
- Notfallcodes bekommt nur der Reiseleiter (req-023). Teilnehmer
  brauchen keine — sie haben immer jemanden, der ihnen einen neuen
  Zugangslink gibt; jeder zusaetzliche Zugangsweg waere nur
  Angriffsflaeche.
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
  falsche Person geraten kann, ist er kurz gueltig (sieben Tage) und
  genau einmal verwendbar. Nach der Nutzung — oder nach Ablauf — ist er
  wertlos; eine neue Einladung entwertet die vorherige. Beim Einloesen
  richtet der Teilnehmer einen neuen Passkey ein; der Link selbst ist
  nur der Weg zurueck, kein Dauerzugang. Er ist an genau eine Person
  gebunden: wer ihn einloest, wird zu ihr (req-023).
- Sitzungen lassen sich aus der Ferne beenden: bei Geraeteverlust kann
  der betroffene Teilnehmer — und der Organisator der Reise — alle
  Sitzungen des Kontos widerrufen, ohne die Reise fuer die anderen zu
  stoeren.
- Beitritt ausschliesslich per Einladung (QR-Code/Einladungslink). Keine
  offene Registrierung. Auch ein neuer Account entsteht ausschliesslich
  durch den Gesamt-Admin; seine erste Person kommt ueber einen
  Zugangslink herein (req-025).
- Einladungslinks laufen ab und gelten nur fuer die eine Person, fuer
  die sie erzeugt wurden (req-023) — einen frei einloesbaren
  Gruppenlink gibt es nicht. Ein Link ist kein Dauerzugang.
- Teilnehmer sehen nur Daten der Reisen, zu denen sie gehoeren.
- Ausnahme Gast (req-038): Wer nur mitschauen soll, bekommt vom
  Reiseleiter einen befristeten Gastzugang zu **genau einer** Reise, **nur
  lesend** — ohne Konto und ohne Passkey. Er sieht Plan, Programmpunkte
  und POIs; nicht dagegen Ausgaben, Salden, Ausgleich, Belege, Dokumente,
  Bankverbindungen, Teilnehmerdaten ueber die Anzeigenamen hinaus,
  Positionen der Gruppe und die Verwaltungsbereiche. Er loest weder
  KI-Suche noch Google-Abruf aus — beides kostet Geld und wird vom
  Zugangsschluessel des Accounts bezahlt (req-028).
  Der Link traegt mindestens 128 Bit Zufall und liegt nur als Pruefsumme
  in der Datenbank; er gilt zwischen einer Stunde und hoechstens 90 Tagen
  (voreingestellt 7) und ist nie unbegrenzt. Widerruf wirkt sofort, auch
  fuer eine laufende Gast-Sitzung, und die Gast-Sitzung endet nie spaeter
  als ihr Gastzugang.
  Getragen wird das nicht von einer Aufzaehlung verbotener
  Schnittstellen, sondern vom Aufbau: eine Gast-Sitzung liegt in einer
  eigenen Tabelle und geht nirgends als Teilnehmer-Sitzung durch.
- Mandantentrennung: Jede Abfrage auf Nutzerdaten filtert nach Account
  (siehe [stack.md](stack.md)). Auch solange nur ein Mandant existiert,
  ist ein fehlender Mandantenfilter ein Sicherheitsmangel — er faellt
  erst auf, wenn es zu spaet ist.
- Ausnahme Gesamt-Admin (req-025): Genau eine Person traegt die
  Kennzeichnung „Gesamt-Admin". Sie legt Accounts an und kann in einen
  fremden Account wechseln, wo sie mit denselben Rechten arbeitet wie
  dessen Personen. Das ist eine bewusste Ausnahme von der
  Mandantentrennung — aber keine Aufweichung: sie **wechselt** den
  Kontext und sieht nie mehrere Accounts gleichzeitig. In wessen Account
  gearbeitet wird, steht in der Sitzung (`session.accountId`), nie in
  der Anfrage; der Mandantenfilter jeder Abfrage bleibt unveraendert
  bestehen. Ohne Wechsel sieht der Gesamt-Admin von fremden Accounts nur
  Namen, Personenzahl und Zugangsstatus der ersten Person — keine
  Reisedaten und keine Kontaktdaten.
  Die Kennzeichnung wird ausschliesslich direkt in der Datenbank
  gesetzt. Es gibt keine Schaltflaeche und keine Schnittstelle, ueber
  die sich jemand selbst oder andere dazu machen kann; das Schema laesst
  nur einen Gesamt-Admin zu.
  Jeder Wechsel in einen fremden Account wird festgehalten: wer, in
  welchen Account, wann.

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
