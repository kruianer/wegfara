---
id: req-037
app: wegfara
area: Reise
created: 2026-09-04
---

# Goal (Why)

wegfara hat seit req-016 eine Anmeldung, aber sie fuehlt sich anders an
als die uebrigen Apps des Betreibers: es braucht einen Knopfdruck, bis
Face ID kommt, und die eigenen Geraete lassen sich weder ueberblicken
noch aus der Ferne abmelden. Dieses Requirement hebt die bestehende
Anmeldung auf den gemeinsamen Anmelde-Standard aller Apps, damit ein
Nutzer, der eine App kennt, alle kennt — und ein einmal gefundener
Fehler sich ueberall gleich beheben laesst.

**Es wird nichts abgeloest, sondern ergaenzt.** Passkeys, Anmeldelinks,
Notfallcodes, Sitzungen, Einladungen (req-023) und die
Mandantentrennung (req-024, req-025) bleiben bestehen. Bestehende
Passkeys und laufende Sitzungen bleiben gueltig; niemand muss sich neu
einrichten.

**Zwei bewusste Abweichungen vom Standard**, die hier gelten und keine
Versehen sind:

1. **Sitzungsdauer.** Der Standard sieht 7 Tage vor. wegfara bindet die
   Sitzung an den Zustand der Reise (siehe
   [security.md](../../security.md), req-023): sie gilt, solange die
   Person mindestens einer Reise im Zustand „Freigegeben" zugeordnet ist
   oder eine offene Bewertung hat; fuer den Reiseleiter 90 Tage, bei
   Nutzung verlaengert. Ein Datumsfenster traefe die Wirklichkeit nicht —
   die Vorbereitung beginnt Wochen vorher, die Abrechnung zieht sich
   danach. Diese Regel bleibt unveraendert.
2. **Notfallcodes.** Der Standard nennt sie einen moeglichen Zusatz.
   In wegfara bekommt sie der Reiseleiter (req-023), weil er unterwegs
   ohne Postfach dastehen kann. Sie bleiben, zusaetzlich zum
   E-Mail-Link, nie an dessen Stelle.

# Function (What)

Umzusetzen im bestehenden Next.js-App-Router-Aufbau: Anmeldeseite unter
`app/anmeldung/`, Passkey-Routen unter `app/api/auth/passkey/`,
Sitzungs- und Zugriffslogik in `lib/auth/`, Datenzugriff in `lib/db/`,
Schema als neue Migration in `migrations/`.

**Anmelden — die Entsperrung kommt sofort, ohne Knopf**

- Beim Oeffnen der Anmeldeseite erscheint unmittelbar die
  Geraete-Abfrage: Face ID auf iPhone/iPad, Touch ID oder Windows Hello
  auf dem Laptop. Kein „Mit Passkey anmelden"-Knopf davor.
- Technisch: Conditional UI. Die Anmeldung wird mit
  `mediation: "conditional"` gestartet (`startAuthentication` aus
  `@simplewebauthn/browser` mit `useBrowserAutofill`), und das
  Anmeldefeld traegt `autocomplete="username webauthn"`. Der Browser
  bietet den passenden Passkey damit von sich aus an.
- Der heutige sichtbare Anmeldeknopf bleibt — aber als Rueckfallweg fuer
  Browser ohne Conditional UI, kleiner und unter dem Feld, nicht als
  Normalweg.
- `userVerification` wird in
  [app/api/auth/passkey/anmeldung/route.ts](../../../app/api/auth/passkey/anmeldung/route.ts)
  und
  [app/api/auth/passkey/registrierung/route.ts](../../../app/api/auth/passkey/registrierung/route.ts)
  von `"preferred"` auf `"required"` gesetzt. Sonst gibt ein Geraet den
  Passkey unter Umstaenden ohne biometrische Pruefung frei, und der
  Schutz waere nur die Geraetenaehe.
- `residentKey: "required"` bleibt wie bisher — ohne Discoverable
  Credential kann der Browser vor der Anmeldung nicht wissen, welcher
  Passkey passt, und genau das ist die Voraussetzung dafuer, dass die
  Abfrage von selbst kommt.

**Ein Passkey pro Geraet, nicht pro Person**

- iPhone, iPad und Windows-PC bekommen jeweils einen eigenen. Apple
  synchronisiert Passkeys ueber den iCloud-Schluesselbund, Windows Hello
  tut das nicht — der PC braucht seinen eigenen.
- Ein angemeldeter Nutzer kann jederzeit „Dieses Geraet hinzufuegen"
  waehlen und einen weiteren Passkey registrieren.

**„Meine Geraete" im Bereich Konto**

Der bestehende Bereich [app/konto/](../../../app/konto) zeigt heute nur
die Bezeichnung der Passkeys. Er wird zur vollstaendigen Geraeteliste:

- je Passkey: Name, Hinzugefuegt-am und Zuletzt-verwendet. Beide Werte
  stehen bereits in der Tabelle `credential` (`created_at`,
  `last_used_at`) und muessen nur ausgegeben werden; `last_used_at` wird
  bei jeder erfolgreichen Passkey-Anmeldung fortgeschrieben.
- je Eintrag „Entfernen", darueber „Dieses Geraet hinzufuegen".
- **Ein entfernter Passkey beendet auch seine Sitzungen.** Wer das
  verlorene iPad entfernt, erwartet, dass es damit draussen ist. Wuerde
  nur der Passkey geloescht, koennte der Finder die laufende Sitzung
  weiterbenutzen — der gefaehrlichste Moment waere genau der, in dem der
  Nutzer glaubt, gehandelt zu haben. Dafuer bekommt die Tabelle
  `session` eine Spalte `credential_id` (nullable, `on delete cascade`),
  die festhaelt, mit welchem Passkey eine Sitzung entstanden ist.
  Sitzungen aus Anmeldelink, Notfallcode oder Einladung tragen dort
  `null` und bleiben von einer Passkey-Entfernung unberuehrt.
- **Der letzte Passkey laesst sich nur entfernen, wenn eine
  E-Mail-Adresse hinterlegt ist** — sonst sperrt sich der Nutzer selbst
  aus. In wegfara traegt jeder Teilnehmer eine Adresse
  (`participant.email` ist `not null`), sodass die Pruefung praktisch
  immer durchgeht; sie gehoert trotzdem serverseitig hin, statt sich auf
  das Schema zu verlassen.
- **„Ueberall abmelden"** unten im Bereich: beendet alle Sitzungen des
  Nutzers auf allen Geraeten, auch die gerade benutzte, mit einem
  Hinweis genau darauf. Die Passkeys bleiben bestehen — es ist ein
  Abmelden, kein Aussperren.
- „Abmelden" bleibt an seiner gewohnten Stelle in der App und beendet
  weiterhin nur die Sitzung dieses Geraets, nicht den Passkey. Beim
  naechsten Oeffnen kommt wieder Face ID.

**Wiederherstellung, wenn das Geraet weg ist**

Der bestehende Anmeldelink erfuellt den Standard bereits weitgehend
(15 Minuten, einmalig, nur als Hash in `login_link`, gleiche Antwort
unabhaengig davon ob die Adresse bekannt ist, Versand ueber All-Inkl).
Zu ergaenzen ist:

- **Hoechstens 3 Anforderungen pro Stunde und Konto.**
  `lib/auth/rate-limit.ts` ist vorhanden; die Grenze wird auf diesen
  Wert gebracht, falls sie abweicht. Ein Ueberschreiten aendert die
  Antwort der App NICHT — sonst liesse sich am Verhalten ablesen, ob
  eine Adresse bekannt ist.
- **Der Link wird immer an die hinterlegte Adresse geschickt**, nie an
  eine im Formular eingegebene. Die eingegebene Adresse dient
  ausschliesslich dazu, das Konto zu finden.
- **Der Link traegt die Origin der Umgebung, aus der er stammt** — ein
  auf dev angeforderter Link zeigt auf dev, nicht auf prod. Er wird aus
  `APP_URL` gebaut, nie aus einem Header der Anfrage.
- **Nichts Vertrauliches in der Mail** ausser dem Link: keine
  Kontodaten, keine Geraeteliste.
- Der Betreff nennt die Umgebung, wenn die Mail aus dev stammt, damit
  eine dev-Mail nicht mit einer echten verwechselt wird.
- Ein fehlgeschlagener Versand gehoert ins Log, nicht in die Antwort.

**Mailversand**

Bleibt wie er ist: SMTP bei All-Inkl ueber `lib/mail/smtp-mailer.ts`,
konfiguriert aus `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`
und `SMTP_FROM` der env-Datei der jeweiligen Umgebung
(`~/wegfara-env/dev.env` bzw. `prod.env`). Kein zweiter Versandweg
daneben. Zu pruefen und, wo noetig, herzustellen:

- `SMTP_HOST` ist `w0089340.kasserver.com`, Port `587` mit STARTTLS.
  TLS ist Pflicht — im Link steckt ein Zugang zum Konto.
- Absender `Wegfara <noreply@wegfara.com>` (aus der prod-Domain der
  [devops.md](../../devops.md)). Beide Umgebungen verschicken unter
  derselben Adresse; unterschieden wird im Betreff.

**Mandanten**

Das Geruest steht seit req-024/req-025 und bleibt unveraendert. Dieses
Requirement bestaetigt es nur und darf es nicht aufweichen:

- Jeder Datensatz gehoert zu genau einem Account; jede Abfrage auf
  Nutzerdaten filtert danach.
- Der Account kommt IMMER aus der Sitzung (`session.accountId`, beim
  Gesamt-Admin `acting_account_id`), nie aus einem Parameter der
  Anfrage. Eine geaenderte ID in der URL darf keinen fremden Account
  erreichbar machen.
- Die Account-Auswahl bleibt unsichtbar, solange ein Nutzer nur zu einem
  Account gehoert.

**Ersteinrichtung**

Fuer eine frisch deployte, leere Umgebung braucht es einen Weg ohne
Kommandozeile:

- Solange die Tabelle `participant` leer ist, zeigt die Anmeldeseite
  zusaetzlich „Ersteinrichtung starten". Mit dem ersten Teilnehmer
  verschwindet dieser Weg dauerhaft — auch ueber die direkte URL.
- Wer ihm folgt, registriert seinen ersten Passkey. Dabei entstehen in
  einem Zug: der erste Account, der Betreiber als Teilnehmer mit
  `uwe@kremmel.org` als hinterlegter Adresse (ueberschreibbar per
  `BOOTSTRAP_EMAIL`, ohne Zutun genau diese) und dessen erster Passkey.
  Der Betreiber ist Account-Admin dieses Accounts.
- Danach ist er angemeldet, und der Wiederherstellungsweg steht ab der
  ersten Minute — nicht erst, wenn jemand daran denkt, eine Adresse zu
  hinterlegen.
- Die bestehenden Umgebungen haben bereits Teilnehmer; dort ist der Weg
  von vornherein unsichtbar. Die Migration aus req-016, die den
  Betreiber einfuegt, bleibt unangetastet.
- Die Sicherheit liegt darin, dass der Weg nur bei leerer Tabelle
  existiert: wer ihn sieht, ist der Erste. Das Zeitfenster zwischen
  Deploy und Ersteinrichtung ist der einzige verwundbare Moment.

**Geraete ohne Passkey**

Die Anmeldeseite bekommt „Anderes Geraet verwenden": Der Browser zeigt
den QR-Code des Cross-Device-Flows, der Nutzer scannt ihn mit dem Handy,
entsperrt dort per Face ID — und der Laptop ist angemeldet. Das kann
jeder aktuelle Browser und braucht auf dem Laptop selbst keine
Passkey-Faehigkeit. Es ist die erste Antwort auf ein Geraet ohne
Passkey, nicht die Ausnahme; danach kommen Anmeldelink und (fuer
Reiseleiter) Notfallcode.

Ein Passwort-Login ist und bleibt ausgeschlossen.

**Schutz der ganzen App**

Nicht einzelne Seiten werden abgesichert, sondern alles ausser dem
Anmeldeweg selbst. Offen bleiben nur die Startseite (`/`), die
Anmeldeseite, die Einloesung von Anmeldelink und Einladung sowie deren
API-Routen. Eine neue Seite ist damit automatisch geschuetzt und nicht
versehentlich offen. Die vorhandenen Bausteine `lib/auth/api-guard.ts`,
`lib/auth/session-access.ts` und `lib/auth/paths.ts` werden darauf
geprueft und, wo noetig, auf eine Positivliste umgestellt: geschuetzt
ist, was nicht ausdruecklich offen ist.

**Technische Grundlagen**

- Sitzung im httpOnly-Cookie, `sameSite: lax`, `secure` ausserhalb
  localhost. Nie im localStorage — ein Skript darf nicht an die Sitzung
  kommen. (Ist bereits so; bleibt so.)
- WebAuthn-Challenge: 5 Minuten.
- Passkeys sind je Umgebung getrennt und das ist beabsichtigt —
  dev-Zugang ist kein prod-Zugang. rpId und Origin ergeben sich aus
  `APP_URL`: dev `dev.wegfara.com` / `https://dev.wegfara.com`, prod
  `app.wegfara.com` / `https://app.wegfara.com`.

**Ablage**

Neue Migration in `migrations/`:

- `session.credential_id text null references credential (id) on delete cascade`
  — haelt fest, mit welchem Passkey eine Sitzung entstanden ist
  (`credential.id` ist `text`). Bestehende Sitzungen bekommen `null` und
  bleiben gueltig.

Sonst kommt dieses Requirement mit dem vorhandenen Schema aus.

# Acceptance Criteria

- [ ] Given ich bin auf diesem Geraet bekannt, when ich die
  Anmeldeseite oeffne, then erscheint die Geraete-Entsperrung (Face ID /
  Touch ID / Windows Hello) von selbst, ohne dass ich vorher einen Knopf
  druecke.
- [ ] Given mein Browser kann kein Conditional UI, when ich die
  Anmeldeseite oeffne, then sehe ich einen Anmeldeknopf, der zum selben
  Ziel fuehrt.
- [ ] Given ich richte einen Passkey ein oder melde mich damit an, when
  mein Geraet die biometrische Pruefung ueberspringen wollte, then wird
  die Anmeldung abgelehnt (`userVerification: "required"`).
- [ ] Given ich bin auf dem iPhone angemeldet, when ich die App auf dem
  Windows-PC oeffne und dort einen Passkey hinzufuege, then kann ich
  mich auf beiden Geraeten anmelden.
- [ ] Given ein Geraet ohne Passkey-Faehigkeit, when ich „Anderes Geraet
  verwenden" waehle und den QR-Code mit dem Handy scanne, then bin ich
  auf diesem Geraet angemeldet.
- [ ] Given ich bin angemeldet, when ich „Meine Geraete" oeffne, then
  sehe ich je Passkey Name, Hinzugefuegt-am und Zuletzt-verwendet.
- [ ] Given ich melde mich mit einem Passkey an, when ich danach „Meine
  Geraete" oeffne, then ist dessen Zuletzt-verwendet auf jetzt
  fortgeschrieben.
- [ ] Given ich bin auf dem iPad und auf dem Laptop angemeldet, when ich
  auf dem Laptop unter „Meine Geraete" das iPad entferne, then ist das
  iPad sofort abgemeldet und zeigt beim naechsten Aufruf die
  Anmeldeseite.
- [ ] Given ich bin ueber einen Anmeldelink angemeldet, when ich einen
  Passkey entferne, then bleibt meine laufende Sitzung bestehen.
- [ ] Given ich bin auf mehreren Geraeten angemeldet, when ich „Ueberall
  abmelden" waehle, then sind alle Geraete abgemeldet — auch das, an dem
  ich gerade sitze — und meine Passkeys funktionieren weiterhin.
- [ ] Given ich habe genau einen Passkey und keine hinterlegte
  E-Mail-Adresse, when ich diesen Passkey entfernen will, then wird das
  abgelehnt, damit ich mich nicht selbst aussperre.
- [ ] Given ich bin angemeldet, when ich „Abmelden" waehle, then ist die
  App gesperrt — und beim naechsten Oeffnen komme ich per Face ID wieder
  hinein, ohne den Passkey neu einzurichten.
- [ ] Given ich habe mein Geraet verloren, when ich einen Anmeldelink
  anfordere und oeffne, then kann ich einen neuen Passkey registrieren —
  und der Link ist danach verbraucht.
- [ ] Given ein Anmeldelink ist aelter als 15 Minuten, when ich ihn
  oeffne, then wird er abgelehnt.
- [ ] Given ich habe innerhalb einer Stunde bereits 3 Anmeldelinks
  angefordert, when ich einen vierten anfordere, then wird keiner
  verschickt — und die Antwort der App unterscheidet sich NICHT von der
  bei einer erfolgreichen Anforderung.
- [ ] Given eine unbekannte E-Mail-Adresse, when ich damit einen Link
  anfordere, then unterscheidet sich die Antwort der App nicht von der
  bei einer bekannten Adresse.
- [ ] Given ich fordere auf https://dev.wegfara.com einen Anmeldelink
  an, when die Mail ankommt, then zeigt der Link auf dev und der Betreff
  nennt die Umgebung.
- [ ] Given der Mailversand faellt aus, when ich einen Anmeldelink
  anfordere, then aendert sich die Antwort der App nicht und der Fehler
  steht im Log.
- [ ] Given eine frisch deployte Umgebung ohne Teilnehmer, when ich die
  App aufrufe, then sehe ich „Ersteinrichtung starten" und kann darueber
  ohne Kommandozeile einen Account, den Betreiber mit hinterlegter
  Adresse (`uwe@kremmel.org`, sofern `BOOTSTRAP_EMAIL` nicht anders
  gesetzt ist) und dessen ersten Passkey anlegen.
- [ ] Given es existiert bereits ein Teilnehmer, when ich die
  Anmeldeseite aufrufe, then ist „Ersteinrichtung starten" nicht mehr
  vorhanden — auch nicht ueber die direkte URL.
- [ ] Given ein frisch per Ersteinrichtung angelegter Betreiber, when er
  sofort einen Anmeldelink anfordert, then kommt dieser an.
- [ ] Given ich bin nicht angemeldet, when ich eine geschuetzte Seite
  oder API-Route direkt aufrufe, then sehe ich die Anmeldeseite bzw.
  werde abgewiesen — und NICHT den Inhalt.
- [ ] Given eine neu hinzugefuegte Seite ohne eigene Absicherung, when
  ich sie nicht angemeldet aufrufe, then ist sie geschuetzt.
- [ ] Given Daten eines anderen Accounts, when ich dessen ID in der URL
  angebe, then bekomme ich sie NICHT zu sehen.
- [ ] Given ich registriere einen Passkey auf https://dev.wegfara.com,
  when ich mich auf https://app.wegfara.com anmelden will, then gilt er
  dort NICHT.
- [ ] Given eine bestehende Umgebung mit Passkeys und laufenden
  Sitzungen, when die Migration eingespielt ist, then bleiben beide
  gueltig und niemand muss sich neu einrichten.

# Constraints

- WebAuthn funktioniert nur im „secure context": beide Umgebungen
  brauchen gueltiges TLS (steht ueber Cloudflare, siehe
  [security.md](../../security.md)). `localhost` gilt als sicher.
- Conditional UI setzt Discoverable Credentials voraus
  (`residentKey: "required"`) — ohne die kann der Browser den passenden
  Passkey vor der Anmeldung nicht finden.
- Die Wiederherstellung braucht `SMTP_USER` und `SMTP_PASSWORD` in der
  env-Datei der jeweiligen Umgebung. Ohne sie laesst sich kein Link
  verschicken.
- Die Umstellung auf `userVerification: "required"` darf bestehende
  Passkeys nicht entwerten. Weist ein altes Geraet die Pruefung ab, ist
  der Weg zurueck der Anmeldelink — nicht ein Zurueckdrehen der Vorgabe.
- Die Migration muss die prod-Daten erhalten
  ([devops.md](../../devops.md)): `session.credential_id` wird
  hinzugefuegt, nichts geloescht oder zurueckgesetzt.
- Es gibt keinen Zugang, der die Anmeldung umgeht — weder einen
  hinterlegten Notzugang noch einen Schalter zum Abschalten.

# Out of Scope

- Passwort-Login, offene oeffentliche Registrierung.
- Gastzugaenge per Link/QR ohne Passkey sowie die Bereiche „Nutzer" und
  „Gastzugaenge" — das ist req-038.
- Feingliedrige Rollen- und Rechteverwaltung ueber Gesamt-Admin,
  Account-Admin, Reiseleiter, Teilnehmer und Gast hinaus.
- Aenderung der reisegebundenen Sitzungsdauer aus req-023 und
  [security.md](../../security.md) — sie bleibt bewusst bestehen.
- Abschaffung der Notfallcodes fuer Reiseleiter.
- Cloudflare Tunnel, TLS und Erreichbarkeit — steht bereits.
