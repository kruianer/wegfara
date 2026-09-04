---
id: req-038
app: wegfara
area: Reise
created: 2026-09-04
---

# Goal (Why)

Aufbauend auf req-037, das die Anmeldung selbst auf den gemeinsamen
Standard aller Apps hebt, bringt dieses Requirement die zweite Haelfte:
Wer ausser dem Betreiber hineinkommt, und wie.

Zwei Luecken schliesst es. Erstens sind Einladungen heute ueber mehrere
Stellen verteilt (Teilnehmerverwaltung aus req-019/req-027,
Zugangslinks aus req-023) und zeigen nicht, welche Einladung noch offen
ist und wann sie ablaeuft. Zweitens gibt es fuer jemanden, der nur
mitschauen soll — der Nachbar, der die Route sehen will, der Verwandte,
der auf die Reise wartet — keinen Weg ausser einem vollwertigen Konto
mit Passkey. Ein befristeter Gastzugang per Link oder QR-Code ist dafuer
die passendere Antwort und macht aus einem kurzen Blick keine dauerhafte
Zugangsberechtigung.

# Function (What)

Umzusetzen im bestehenden Aufbau: Bereiche unter `app/plan/`, Routen
unter `app/api/`, Domaenenlogik in `lib/`, Datenzugriff in `lib/db/`,
Schema als Migration in `migrations/`. Die vorhandenen Rollen bleiben
wie sie sind — Gesamt-Admin, Account-Admin (req-027), Reiseleiter und
Teilnehmer (req-021).

**Wer darf was verwalten**

- **Account-Admin** verwaltet die Personen des Accounts: einladen,
  offene Einladungen zuruecknehmen, Personen entfernen. Das erweitert
  die bestehende Zustaendigkeit aus req-027.
- **Reiseleiter** erstellt und widerruft Gastzugaenge zu *seiner* Reise.
  Wer eine Reise fuehrt, entscheidet, wer hineinschauen darf.
- **Gesamt-Admin** kann beides in jedem Account, in den er gewechselt
  ist — wie schon heute gilt er dort als Account-Admin.
- **Teilnehmer ohne diese Kennzeichnungen** sehen die Verwaltung nicht.

**Keine offene Selbstregistrierung.** Weitere Personen kommen
ausschliesslich ueber eine Einladung hinein. Ein Versuch, sich ohne
Einladung zu registrieren, wird abgewiesen.

**Jedes Konto hat eine E-Mail-Adresse — von Anfang an.** Die Einladung
geht an eine Adresse, und diese Adresse bleibt am Konto haengen. Ohne
sie gaebe es fuer die eingeladene Person spaeter keinen Weg zurueck,
wenn ihr Geraet verloren geht. Ein Teilnehmer ohne hinterlegte Adresse
darf nicht entstehen (`participant.email` ist bereits `not null`; die
Pruefung gehoert zusaetzlich serverseitig in die Einladung).

**Bereich „Nutzer" (nur Account-Admin)**

Ein Bereich im Planer, der die verstreuten Stellen zusammenfuehrt:

- Liste der Personen des Accounts mit Name, E-Mail, Kennzeichnung
  (Account-Admin ja/nein), Beitritt und letzter Anmeldung. Die letzte
  Anmeldung wird aus der juengsten Sitzung bzw. Passkey-Nutzung
  ermittelt.
- „Einladen": E-Mail-Adresse und Name eingeben, der Zugangslink geht per
  Mail raus und wird zusaetzlich als Link und QR-Code angezeigt — genau
  einmal, unmittelbar nach dem Erstellen (siehe unten).
- Offene Einladungen als eigene Liste mit Adresse, Ablaufdatum und
  „Zurueckziehen". Ein Zurueckziehen entwertet den Link serverseitig
  sofort.
- Person entfernen. **Der letzte Account-Admin eines Accounts kann
  weder entfernt noch herabgestuft werden** — ein Account hat immer
  mindestens einen (bestaetigt req-027). Ebenso bleibt der letzte
  Reiseleiter einer Reise bestehen (req-021).
- Wird eine Person entfernt, enden ihre Sitzungen sofort.
- Einladung: 7 Tage gueltig, genau einmal verwendbar, nur als Hash
  gespeichert. Eine neue Einladung an dieselbe Person entwertet die
  vorherige (bestaetigt req-023). Beim Einloesen richtet die Person
  einen Passkey ein; der Link selbst ist kein Dauerzugang.

**Bereich „Gastzugaenge" (Reiseleiter der Reise, Account-Admin,
Gesamt-Admin)**

Neu. Ein Gast bekommt einen Link — auch als QR-Code darstellbar — und
ist damit drin: ohne Konto, ohne Passkey, ohne Geraete-Einrichtung. Das
ist bewusst schwaecher als ein Passkey, deshalb eng begrenzt:

- **Umfang: genau eine Reise, nur lesend.** Der Gast sieht deren Plan,
  Programmpunkte und POIs. Er sieht NICHT: Ausgaben, Salden,
  Ausgleich, Belege und Dokumente, Bankverbindungen, Teilnehmerdaten
  ueber die Anzeigenamen hinaus, Positionen der Gruppe, die Bereiche
  Account, Nutzer, Gastzugaenge und Account-Verwaltung. Er kann nichts
  anlegen, aendern oder loeschen und loest keine KI-Suche und keinen
  Google-Abruf aus — beides kostet Geld.
- Beim Erstellen legt der Reiseleiter fest: **Zweck** (ein kurzer Text,
  damit spaeter erkennbar ist, wem der Link gehoert), **Reise** und
  **Dauer** — waehlbar zwischen einer Stunde und hoechstens 90 Tagen,
  voreingestellt 7 Tage. Nie unbegrenzt.
- Der Link traegt ein Geheimnis mit mindestens 128 Bit Zufall, das nur
  als Hash gespeichert wird.
- **Er ist jederzeit widerrufbar, und der Widerruf wirkt sofort** — auch
  fuer eine bereits laufende Gast-Sitzung.
- **Die Gast-Sitzung ist an den Link gebunden und laeuft mit ihm ab**,
  statt eigenstaendig weiterzuleben. Sie ist damit ausdruecklich von der
  reisegebundenen Sitzungsdauer der Teilnehmer (req-023) ausgenommen und
  endet nie spaeter als der Gastzugang.
- Die Liste zeigt je Gastzugang: Zweck, Reise, Ablauf, letzte Verwendung
  und Status (aktiv, abgelaufen, widerrufen) sowie „Widerrufen".
- **Ein Gast kann jederzeit hochgestuft werden**, indem der
  Account-Admin ihn unter „Nutzer" einlaedt — dann bekommt er einen
  Passkey und ein vollwertiges Konto.

**Zwei Regeln fuer beide Bereiche**

- **Was nicht erlaubt ist, wird nicht angezeigt.** Ein Teilnehmer ohne
  Kennzeichnung sieht „Nutzer" gar nicht erst, ein Nicht-Reiseleiter
  sieht „Gastzugaenge" nicht. Das ersetzt NICHT die Pruefung auf dem
  Server — die gilt zusaetzlich und immer, auch beim direkten Aufruf der
  Adresse oder der API-Route.
- **Geheimnisse werden genau einmal gezeigt.** Gastlinks und
  Einladungslinks erscheinen unmittelbar nach dem Erstellen, als Text
  UND als QR-Code, mit dem sichtbaren Hinweis, dass sie nur jetzt
  sichtbar sind. Danach nie wieder, weil nur ihr Hash gespeichert ist.
  Wer den Link verliert, erzeugt einen neuen — der alte wird dabei
  entwertet.

**Was ein Gast sieht**

Keinen dieser Bereiche und keinen der uebrigen Verwaltungsbereiche — nur
den freigegebenen Ausschnitt der Reise. Der Begleiter (`/go`) und der
Planer (`/plan`) zeigen ihm ausschliesslich Lesbares; alle
Bedienelemente zum Aendern fehlen.

**Ablage**

Neue Migration in `migrations/`:

- `guest_access`: `id`, `account_id`, `trip_id`, `created_by`
  (Teilnehmer), `purpose`, `token_hash` (unique), `created_at`,
  `expires_at`, `last_used_at`, `revoked_at`. Wie jede Tabelle mit
  Nutzerdaten traegt sie eine Account-Zuordnung und wird immer danach
  gefiltert.
- Die Gast-Sitzung haengt an `guest_access`, nicht an `participant`.
  Entweder als eigene Spalte `session.guest_access_id` (nullable,
  `on delete cascade`, dann ist `participant_id` fuer Gaeste `null`)
  oder als getrennte Tabelle — die Entscheidung liegt beim Worker, aber
  eine Gast-Sitzung darf niemals als Teilnehmer-Sitzung durchgehen und
  muss beim Widerruf oder Ablauf des Gastzugangs sofort ungueltig sein.

Die bestehende Tabelle `access_link` aus req-023 bleibt fuer Einladungen
zustaendig; sie wird nicht fuer Gastzugaenge mitbenutzt — die beiden
haben verschiedene Lebensdauern, verschiedene Rechte und verschiedene
Widerrufsregeln.

# Acceptance Criteria

- [ ] Given jemand ohne Einladung, when er sich zu registrieren
  versucht, then wird das abgelehnt.
- [ ] Given ich bin Account-Admin, when ich unter „Nutzer" jemanden per
  E-Mail einlade, then bekommt diese Person einen Link und kann damit
  einen eigenen Passkey registrieren.
- [ ] Given ich habe jemanden eingeladen, when ich „Nutzer" oeffne, then
  sehe ich die offene Einladung mit Ablaufdatum und kann sie
  zuruecknehmen.
- [ ] Given ich habe eine Einladung zurueckgezogen, when die
  eingeladene Person den Link oeffnet, then wird er abgelehnt.
- [ ] Given eine Einladung ist aelter als 7 Tage, when sie geoeffnet
  wird, then wird sie abgelehnt.
- [ ] Given eine Einladung wurde bereits eingeloest, when derselbe Link
  erneut geoeffnet wird, then wird er abgelehnt.
- [ ] Given ich lade jemanden ein, when ich versuche, das ohne
  E-Mail-Adresse zu tun, then wird das abgelehnt — es entsteht kein
  Konto ohne hinterlegte Adresse.
- [ ] Given ich bin Teilnehmer ohne Account-Admin-Kennzeichnung, when
  ich die App benutze, then sehe ich „Nutzer" nicht — und ein direkter
  Aufruf der Adresse und der zugehoerigen API-Route wird ebenfalls
  abgelehnt.
- [ ] Given ich bin der letzte Account-Admin des Accounts, when ich mich
  entfernen oder herabstufen will, then wird das abgelehnt.
- [ ] Given eine Person ist auf einem Geraet angemeldet, when ein
  Account-Admin sie entfernt, then ist sie sofort abgemeldet.
- [ ] Given ich bin Reiseleiter, when ich einen Gastzugang zu meiner
  Reise erstelle, then sehe ich den Link als Text und als QR-Code,
  zusammen mit dem Hinweis, dass er nur jetzt sichtbar ist — und spaeter
  finde ich ihn nirgends wieder.
- [ ] Given ich erstelle einen Gastzugang, when ich keine Dauer waehle,
  then gilt er 7 Tage; when ich mehr als 90 Tage waehle, then wird das
  abgelehnt.
- [ ] Given ein Gastlink, when der Gast ihn oeffnet, then sieht er Plan,
  Programmpunkte und POIs der freigegebenen Reise ohne Passkey — und
  nichts darueber hinaus.
- [ ] Given ein Gast ist eingeloggt, when er Ausgaben, Salden, Belege,
  Dokumente, Bankverbindungen oder eine andere Reise aufruft, then wird
  der Zugriff abgelehnt.
- [ ] Given ein Gast ist eingeloggt, when er eine schreibende
  Schnittstelle, eine KI-Suche oder einen Google-Abruf ausloest, then
  wird das abgelehnt.
- [ ] Given ein Gast ist eingeloggt, when er die Bereiche Account,
  Nutzer, Gastzugaenge oder die Account-Verwaltung aufruft, then wird
  der Zugriff abgelehnt und er sieht sie auch nicht in der
  Oberflaeche.
- [ ] Given ein Gast ist gerade in der App, when der Reiseleiter seinen
  Zugang widerruft, then endet seine Sitzung sofort und der naechste
  Aufruf wird abgelehnt.
- [ ] Given ein abgelaufener Gastlink, when er geoeffnet wird, then wird
  der Zugriff abgelehnt.
- [ ] Given ein Gastzugang laeuft ab, when die Gast-Sitzung noch laeuft,
  then endet auch sie — nie spaeter als der Gastzugang.
- [ ] Given ich bin Reiseleiter, when ich „Gastzugaenge" oeffne, then
  sehe ich je Zugang Zweck, Reise, Ablauf, letzte Verwendung und Status
  und kann ihn widerrufen.
- [ ] Given ich bin Teilnehmer und nicht Reiseleiter dieser Reise, when
  ich Gastzugaenge dieser Reise aufrufen oder erstellen will, then wird
  das abgelehnt.
- [ ] Given ein Gastzugang eines anderen Accounts, when ich dessen ID
  angebe, then bekomme ich ihn NICHT zu sehen.
- [ ] Given ein Gast, when der Account-Admin ihn unter „Nutzer"
  einlaedt, then kann er einen Passkey einrichten und ist danach ein
  vollwertiger Teilnehmer.

# Constraints

- Baut auf req-037 auf: Anmeldung, Sitzungen, Schutz der ganzen App und
  Mailversand kommen von dort.
- Gast-Sitzungen duerfen nie in die reisegebundene Sitzungslogik aus
  req-023 fallen — sie haengen ausschliesslich am Gastzugang.
- Gastlink und Einladung werden ausschliesslich als Hash gespeichert und
  serverseitig entwertet, nicht nur in der Anzeige.
- Die Pruefung der Berechtigung liegt immer auf dem Server. Das
  Ausblenden in der Oberflaeche ist Bequemlichkeit, kein Schutz.
- Die Migration muss die prod-Daten erhalten
  ([devops.md](../../devops.md)) — bestehende Teilnehmer, Einladungen
  und Sitzungen bleiben gueltig.
- Der Gastzugang gibt nie Zugriff auf kostenpflichtige Dienste (KI,
  Google Places) — der Account traegt die Kosten seiner
  Zugangsschluessel (req-028).

# Out of Scope

- Passwort-Login, offene oeffentliche Registrierung.
- Feingliedrige Rollen- und Rechteverwaltung ueber Gesamt-Admin,
  Account-Admin, Reiseleiter, Teilnehmer und Gast hinaus.
- Schreibrechte fuer Gaeste, auch nicht als spaeter freischaltbare
  Option.
- Gastzugaenge, die mehrere Reisen oder einen ganzen Account umfassen.
- Aenderungen an der Anmeldung selbst — die stehen in req-037.
