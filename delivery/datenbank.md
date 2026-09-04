---
project: wegfara
stand: 2026-09-04
---

# Datenbank

Beschreibung des Schemas, ausgelesen aus der laufenden dev-Datenbank
(PostgreSQL 17). Sie ist eine **Momentaufnahme** — die Wahrheit sind die
Migrationen in `migrations/`, die bei jedem Start angewendet werden
(siehe [devops.md](devops.md)). Weicht diese Datei davon ab, gilt das
Schema.

## Überblick

24 Tabellen in fünf Gruppen:

| Gruppe               | Tabellen                                                                                                        |
| -------------------- | --------------------------------------------------------------------------------------------------------------- |
| Mandant und Personen | `account`, `participant`, `account_switch`, `account_api_key`                                                   |
| Anmeldung            | `session`, `credential`, `login_link`, `access_link`, `recovery_code`, `guest_access`, `guest_session`          |
| Reise und Inhalt     | `trip`, `trip_participant`, `poi`, `poi_photo`, `activity`, `transfer`, `activity_option_selection`, `document` |
| Gruppenkasse         | `expense`, `expense_share`                                                                                      |
| Suchgebiet           | `search_area`, `search_area_point`                                                                              |

Dazu `schema_migrations`, die den Stand der angewendeten Migrationen
festhält.

Alle Schlüssel sind UUIDs. Ausnahme: `credential.id` übernimmt die
Kennung des Passkeys vom Gerät.

## Mandant und Personen

### account

Die oberste Ebene des Datenmodells — der Mandant. Derzeit existiert
genau einer (siehe [stack.md](stack.md), Mandantenfähigkeit).

Welcher Account gemeint ist, ergibt sich seit req-024 allein aus der
Anmeldung: die Sitzung führt zur Person, die Person zu ihrem Account.
Die Anwendung kennt keine feste Account-Kennung mehr und nimmt sie nie
aus der Anfrage entgegen.

Seit req-025 gibt es mehrere: der Gesamt-Admin legt Accounts an
(`participant.is_super_admin`) und kann in einen fremden wechseln
(`session.acting_account_id`). Die `email` ist die der ersten Person des
Accounts — über sie ist er erreichbar, solange er nur diese eine hat.

| Spalte  | Typ  | Nullbar | Bemerkung       |
| ------- | ---- | ------- | --------------- |
| `id`    | uuid | nein    | Primärschlüssel |
| `name`  | text | nein    |                 |
| `email` | text | nein    | eindeutig       |

### participant

Eine Person innerhalb eines Accounts. Anmeldung und Reiseteilnahme
hängen daran. Verwaltet wird sie im Planer unter „Einstellungen“, Karte
„Reiseteilnehmer“ (siehe req-019).

| Spalte             | Typ         | Nullbar | Bemerkung                                            |
| ------------------ | ----------- | ------- | ---------------------------------------------------- |
| `id`               | uuid        | nein    | Primärschlüssel                                      |
| `account_id`       | uuid        | nein    | → `account.id`                                       |
| `name`             | text        | nein    | höchstens 80 Zeichen (in der Anwendung geprüft)      |
| `nickname`         | text        | ja      | höchstens 20 Zeichen (in der Anwendung geprüft)      |
| `email`            | text        | ja      | eindeutig, soweit gesetzt; Ziel des Anmeldelinks     |
| `phone`            | text        | ja      | Telefonnummer, freies Format                         |
| `iban`             | text        | ja      | Bankverbindung ohne Leerzeichen, Prüfziffer geprüft  |
| `login_enabled`    | boolean     | nein    | Vorgabe `false`                                      |
| `is_account_admin` | boolean     | nein    | Vorgabe `false`; mindestens einmal `true` je Account |
| `is_super_admin`   | boolean     | nein    | Vorgabe `false`; höchstens einmal `true`             |
| `created_at`       | timestamptz | nein    |                                                      |

`is_super_admin` kennzeichnet den Gesamt-Admin (req-025). Ein partieller
eindeutiger Index (`participant_single_super_admin`) lässt genau einen
zu — „genau eine Person“ ist damit eine Bedingung des Schemas und keine
Absichtserklärung. Gesetzt und entzogen wird die Kennzeichnung
ausschließlich direkt in der Datenbank: die Anwendung liest die Spalte,
schreibt sie an keiner Stelle.

`created_at` ist zugleich der „Beitritt“, den der Bereich „Nutzer“ zeigt
(req-038); die „letzte Anmeldung“ daneben wird aus der jüngsten `session`
und der jüngsten Passkey-Nutzung (`credential.last_used_at`) ermittelt und
nirgends gespeichert (siehe `lib/db/account-users.ts`).

`is_account_admin` kennzeichnet den Account-Admin (req-027): nur wer sie
trägt, darf die Personen seines Accounts anlegen, ändern und entfernen —
alle übrigen sehen die Liste, können sie aber nicht verändern. Die
Kennzeichnung gilt für einen Account und ist etwas anderes als die Rolle
Reiseleiter (`trip_participant.role`), die je Reise gilt.

Anders als beim Gesamt-Admin vergibt die Anwendung sie: ein Account-Admin
ernennt weitere Personen und entzieht ihnen die Kennzeichnung wieder. Die
erste Person eines neuen Accounts erhält sie beim Anlegen
(`lib/accounts/create-account.ts`). „Ein Account hat immer mindestens
einen Account-Admin“ steht in der Anwendung, nicht im Schema (siehe
`lib/participants/account-admin.ts`): der letzte lässt sich weder
herabstufen noch entfernen — seit req-038 wird das Entfernen abgewiesen,
statt jemanden nachrücken zu lassen. Das Nachrücken der dienstältesten
verbliebenen Person bleibt als Netz für Accounts, die aus anderen Gründen
ohne Account-Admin dastehen. Der Gesamt-Admin gilt in jedem Account, in den
er gewechselt ist, als Account-Admin.

Der `nickname` ist freiwillig und ersetzt den Namen nur in der Anzeige
(req-020) — gespeichert bleiben beide. Wo eine Bankverbindung oder eine
Zahlung dargestellt wird, gilt immer der volle Name.

`login_enabled` entscheidet über den Zugang: erfasste Personen erhalten
keinen — weder per Anmeldelink noch per Notfallcode. Gesetzt wird das
Kennzeichen, wenn die Person ihren Zugangslink einlöst (req-023), nicht
schon beim Erzeugen der Einladung — so ist in der Liste erkennbar, wer
tatsächlich hereingekommen ist.

Eine E-Mail-Adresse ist dafür nicht nötig: seit req-023 kommt man per
Einladung herein, nicht per Anmeldelink. Die Prüfbedingung
`participant_login_needs_email` aus req-019 ist deshalb entfallen. Wer
keine Adresse hinterlegt hat, dem steht der Anmeldelink schlicht nicht
zur Verfügung.

Telefonnummer und Bankverbindung sind personenbezogene Daten und nur
für angemeldete Personen desselben Accounts sichtbar (siehe
[security.md](security.md)). Der Begleiter bekommt sie deshalb nicht mit
der Seite ausgeliefert: die `iban` holt er seit req-031 einzeln über
`/api/bankverbindung`, wenn jemand den Überweisungscode zu einer Zahlung
anfordert — und nur die des Empfängers.

### account_switch

Das Protokoll der Account-Wechsel (req-025): wer, in welchen Account,
wann. Es wird geschrieben, aber nicht in der Oberfläche gezeigt — die
Ansicht ist ausdrücklich nicht Teil des Requirements. Nur der Wechsel in
einen **fremden** Account erzeugt einen Eintrag; die Rückkehr in den
eigenen nicht.

| Spalte           | Typ         | Nullbar | Bemerkung                               |
| ---------------- | ----------- | ------- | --------------------------------------- |
| `id`             | uuid        | nein    | Primärschlüssel                         |
| `participant_id` | uuid        | nein    | → `participant.id`, `ON DELETE CASCADE` |
| `account_id`     | uuid        | nein    | → `account.id`                          |
| `switched_at`    | timestamptz | nein    |                                         |

### account_api_key

Die Zugangsschlüssel eines Accounts (req-028): einer für die KI-Suche
(req-014), einer für den Import aus einem Google-Maps-Link (req-026).
Jeder Account trägt damit seine eigenen Kosten; ohne hinterlegten
Schlüssel ist die zugehörige Funktion für ihn gesperrt, und auf den
Schlüssel eines anderen Accounts wird nie zurückgegriffen.

| Spalte       | Typ         | Nullbar | Bemerkung                                                |
| ------------ | ----------- | ------- | -------------------------------------------------------- |
| `account_id` | uuid        | nein    | → `account.id`, `ON DELETE CASCADE`; Teil des Schlüssels |
| `kind`       | text        | nein    | zwei Werte, siehe unten; Teil des Schlüssels             |
| `ciphertext` | text        | nein    | der verschlüsselte Zugangsschlüssel                      |
| `last_four`  | text        | nein    | die letzten vier Zeichen, zur Unterscheidung             |
| `updated_at` | timestamptz | nein    |                                                          |

**Arten:** `ki_suche`, `google`

Anders als die Geheimnisse der Anmeldung liegt der Wert hier nicht als
Prüfsumme, sondern **verschlüsselt** (AES-256-GCM, siehe
`lib/secrets/encryption.ts`) — er wird zum Anfragen bei OpenAI und Google
im Klartext gebraucht. Der Schlüssel zum Entschlüsseln wird aus der
Umgebungsvariablen `AUTH_SECRET` abgeleitet und steht bewusst nicht in
der Datenbank: ein Backup allein lässt sich damit nicht auswerten
(req-028, Constraints). Wird `AUTH_SECRET` ausgetauscht, sind die
hinterlegten Schlüssel neu zu setzen.

`last_four` ist die einzige Angabe, die je wieder ausgegeben wird. Der
Schlüssel selbst verlässt den Server nach dem Speichern nie — weder in
der Oberfläche noch über eine Schnittstelle; es gibt dafür bewusst kein
GET (siehe `app/api/zugangsschluessel/route.ts`). Setzen und Entfernen
darf nur ein Account-Admin, serverseitig geprüft.

Der Primärschlüssel aus `account_id` und `kind` lässt je Account und Art
genau einen Eintrag zu: ein zweites Hinterlegen ersetzt den vorhandenen,
statt einen weiteren anzulegen.

## Anmeldung

Alle Tabellen dieser Gruppe speichern Geheimnisse **ausschließlich als
Prüfsumme**, nie im Klartext (siehe [security.md](security.md)). Die
ersten fünf hängen mit `ON DELETE CASCADE` am Teilnehmer: wird er
entfernt, verschwinden Sitzungen, Passkeys, Links und Codes mit — er ist
damit sofort abgemeldet (req-038). `guest_access` und `guest_session`
gehören zu keinem Teilnehmer; sie hängen an der Reise bzw. am Gastzugang
(siehe unten).

### session

Eine angemeldete Sitzung. Läuft 90 Tage und verlängert sich bei Nutzung.
Ob sie darüber hinaus gilt, entscheidet der Zustand der Reisen der
Person (req-023): ein Teilnehmer bleibt nur angemeldet, solange er
mindestens einer freigegebenen Reise zugeordnet ist — sonst endet die
Sitzung beim nächsten Aufruf. Für den Reiseleiter gilt das nicht.

| Spalte              | Typ         | Nullbar          | Bemerkung                   |
| ------------------- | ----------- | ---------------- | --------------------------- |
| `id`                | uuid        | nein             |                             |
| `participant_id`    | uuid        | nein             |                             |
| `token_hash`        | text        | nein (eindeutig) |                             |
| `created_at`        | timestamptz | nein             |                             |
| `expires_at`        | timestamptz | nein             |                             |
| `acting_account_id` | uuid        | ja               | → `account.id`; siehe unten |
| `credential_id`     | text        | ja               | → `credential.id`; cascade  |

`credential_id` hält fest, mit welchem Passkey die Sitzung entstanden ist
(req-037). Wird das Gerät unter „Meine Geräte" entfernt, endet die
Sitzung mit ihm (`ON DELETE CASCADE`) — wer sein verlorenes iPad
entfernt, hat es damit wirklich draußen. Sitzungen aus Anmeldelink,
Notfallcode oder Einladung tragen hier dauerhaft leer und bleiben von
einer Passkey-Entfernung unberührt; ebenso alle Sitzungen, die es vor
der Migration schon gab.

`acting_account_id` hält fest, in welchem fremden Account der
Gesamt-Admin gerade arbeitet (req-025); leer heißt: im eigenen. Der Wert
hängt an der Sitzung und nicht an der Person — die Rückkehr in den
eigenen Account ist damit nichts weiter als das Leeren dieser Spalte, und
ein Abmelden beendet den Wechsel in jedem Fall. Ohne die Kennzeichnung
`participant.is_super_admin` wird der Wert nicht beachtet.

### credential

Ein eingerichteter Passkey. Ein Teilnehmer kann mehrere haben — je
Gerät einen. Passkeys gelten je Domain: einer für dev funktioniert auf
prod nicht.

| Spalte           | Typ         | Nullbar | Bemerkung                          |
| ---------------- | ----------- | ------- | ---------------------------------- |
| `id`             | text        | nein    | Kennung vom Gerät, Primärschlüssel |
| `participant_id` | uuid        | nein    |                                    |
| `public_key`     | text        | nein    | nur der öffentliche Teil           |
| `counter`        | bigint      | nein    | Zähler gegen Wiedereinspielung     |
| `transports`     | text        | nein    |                                    |
| `label`          | text        | nein    | Bezeichnung des Geräts             |
| `created_at`     | timestamptz | nein    |                                    |
| `last_used_at`   | timestamptz | ja      |                                    |

### login_link

Ein Anmeldelink aus der E-Mail. 15 Minuten gültig, genau einmal
verwendbar — `used_at` entwertet ihn.

| Spalte           | Typ         | Nullbar          |
| ---------------- | ----------- | ---------------- |
| `id`             | uuid        | nein             |
| `participant_id` | uuid        | nein             |
| `token_hash`     | text        | nein (eindeutig) |
| `created_at`     | timestamptz | nein             |
| `expires_at`     | timestamptz | nein             |
| `used_at`        | timestamptz | ja               |

### access_link

Der Zugangslink einer Einladung (req-023) — was der Reiseleiter als
QR-Code zeigt oder als Link verschickt. **7 Tage** gültig, genau einmal
verwendbar; `used_at` entwertet ihn. Eine neue Einladung für dieselbe
Person entwertet die vorherige.

| Spalte           | Typ         | Nullbar          |
| ---------------- | ----------- | ---------------- |
| `id`             | uuid        | nein             |
| `participant_id` | uuid        | nein             |
| `token_hash`     | text        | nein (eindeutig) |
| `created_at`     | timestamptz | nein             |
| `expires_at`     | timestamptz | nein             |
| `used_at`        | timestamptz | ja               |

Der Link ist an genau diese Person gebunden: wer ihn einlöst, wird zu
ihr — es entsteht kein neuer, eigener Zugang. Einen frei einlösbaren
Gruppenlink gibt es bewusst nicht.

### recovery_code

Notfallcodes, acht Stück je Satz, einmalig angezeigt. Jeder ist einmal
verwendbar. Sie bekommt nur, wer mindestens eine Reise als Reiseleiter
führt (req-023) — ein Teilnehmer hat immer jemanden, der ihn mit einer
neuen Einladung wieder hereinholt.

| Spalte           | Typ         | Nullbar          |
| ---------------- | ----------- | ---------------- |
| `id`             | uuid        | nein             |
| `participant_id` | uuid        | nein             |
| `code_hash`      | text        | nein (eindeutig) |
| `created_at`     | timestamptz | nein             |
| `used_at`        | timestamptz | ja               |

### guest_access

Ein befristeter Gastzugang zu **genau einer** Reise, nur lesend (req-038).
Ein Gast bekommt einen Link — auch als QR-Code — und ist damit drin: ohne
Konto, ohne Passkey, ohne Geräte-Einrichtung.

| Spalte         | Typ         | Nullbar          | Bemerkung                                      |
| -------------- | ----------- | ---------------- | ---------------------------------------------- |
| `id`           | uuid        | nein             | Primärschlüssel                                |
| `account_id`   | uuid        | nein             | → `account.id`, `ON DELETE CASCADE`            |
| `trip_id`      | uuid        | nein             | → `trip.id`, `ON DELETE CASCADE`               |
| `created_by`   | uuid        | ja               | → `participant.id`, `ON DELETE SET NULL`       |
| `purpose`      | text        | nein             | Zweck, höchstens 80 Zeichen (in der Anwendung) |
| `token_hash`   | text        | nein (eindeutig) | die Prüfsumme des Geheimnisses                 |
| `created_at`   | timestamptz | nein             |                                                |
| `expires_at`   | timestamptz | nein             | eine Stunde bis höchstens 90 Tage              |
| `last_used_at` | timestamptz | ja               | die Liste zeigt die letzte Verwendung          |
| `revoked_at`   | timestamptz | ja               | gesetzt heißt: sofort ungültig                 |

Anders als beim Zugangslink einer Einladung (`access_link`) ist er bis zum
Ablauf **mehrfach** verwendbar — festgehalten wird nur, wann zuletzt. Er
ist bewusst schwächer als ein Passkey und deshalb eng begrenzt: eine
Reise, nur lesend, nie unbegrenzt, jederzeit widerrufbar. Der Widerruf
wirkt sofort, auch für eine bereits laufende Gast-Sitzung.

Die `account_id` steht redundant neben der Reise, damit jede Abfrage ohne
Umweg über `trip` nach dem Mandanten filtern kann. `created_by` löst sich
mit `ON DELETE SET NULL`: der Zugang gehört der Reise, nicht der Person,
die ihn erstellt hat.

Der Zustand (Aktiv, Abgelaufen, Widerrufen) steht **nicht** im Schema — er
wird aus `expires_at` und `revoked_at` gerechnet (siehe
`lib/guests/status.ts`); getrennt geführt könnten beide auseinanderlaufen.

### guest_session

Die Sitzung eines Gastes (req-038). Sie liegt bewusst in einer eigenen
Tabelle und nicht in `session`.

| Spalte            | Typ         | Nullbar          | Bemerkung                                |
| ----------------- | ----------- | ---------------- | ---------------------------------------- |
| `id`              | uuid        | nein             | Primärschlüssel                          |
| `guest_access_id` | uuid        | nein             | → `guest_access.id`, `ON DELETE CASCADE` |
| `token_hash`      | text        | nein (eindeutig) |                                          |
| `created_at`      | timestamptz | nein             |                                          |
| `expires_at`      | timestamptz | nein             | der Ablauf des Gastzugangs               |

Dass sie nicht in `session` liegt, ist der eigentliche Schutz: jede
vorhandene Abfrage auf `session` führt über `participant_id` zu einer
Person. Eine Gast-Sitzung hat keine — sie kann deshalb **nirgends** als
Teilnehmer-Sitzung durchgehen, und jede bestehende Schnittstelle weist
einen Gast ab, ohne ihn kennen zu müssen (siehe `guest-scope.test.ts`).

Sie übernimmt den Ablauf ihres Gastzugangs und endet damit nie später als
er. Von der reisegebundenen Sitzungsdauer der Teilnehmer (req-023) ist sie
ausdrücklich ausgenommen. Ob der Gastzugang noch gilt, wird bei **jedem**
Aufruf mitgeprüft, nicht nur beim Anlegen — so wirken Widerruf und Ablauf
sofort.

Beide Sitzungen benutzen dasselbe Cookie: welche gemeint ist, entscheidet,
in welcher Tabelle das Token gefunden wird.

## Reise und Inhalt

### trip

Eine Reise mit Zeitraum und Hauptort. Der Hauptort dient als
Ortsbezug, etwa für die Wetteranzeige.

| Spalte            | Typ              | Nullbar | Bemerkung                        |
| ----------------- | ---------------- | ------- | -------------------------------- |
| `id`              | uuid             | nein    | Primärschlüssel                  |
| `account_id`      | uuid             | nein    | → `account.id`                   |
| `title`           | text             | nein    |                                  |
| `start_date`      | date             | nein    |                                  |
| `end_date`        | date             | nein    | muss ≥ `start_date` sein         |
| `main_place_name` | text             | nein    |                                  |
| `main_place_lat`  | double precision | nein    |                                  |
| `main_place_lng`  | double precision | nein    |                                  |
| `description`     | text             | nein    | freiwillig, Vorgabe leer         |
| `state`           | text             | nein    | drei Werte, Vorgabe `in_planung` |

Die `description` ist der freiwillige Text für die Gruppe (req-033) — was
geplant ist, was mitzubringen, worauf zu achten. Leer und „nicht gesetzt“
sind dasselbe, deshalb `not null` mit leerer Vorgabe statt nullbar. Die
Höchstlänge von 2000 Zeichen steht in der Anwendung
(`lib/trips/validate.ts`), nicht im Schema — wie schon die 80 Zeichen des
Titels.

**Zustände:** `in_planung`, `freigegeben`, `abgeschlossen`

Der Zustand wird vom Reiseleiter gesetzt, nie berechnet (req-022): er sagt,
ob noch geplant wird, ob die zugeordneten Personen zugreifen dürfen und ob
die Reise samt Abrechnung erledigt ist. Er lässt sich jederzeit in beide
Richtungen wechseln.

Vom Zeitraum ist er unabhängig — der daraus berechnete Zeitstatus (Aktiv,
Geplant, Beendet) steht weiterhin nur im Code (`lib/trips/status.ts`) und
nicht in der Datenbank. Beide werden nebeneinander angezeigt.

Seit req-023 entscheidet der Zustand, wer die Reise sieht: der
Reiseleiter sieht seine Reisen in jedem Zustand, die übrigen
Zugeordneten erst, wenn sie auf „Freigegeben“ steht. Wer der Reise gar
nicht zugeordnet ist, sieht sie nicht.

### trip_participant

Wer bei welcher Reise mitfährt und in welcher Rolle (req-021). Die Rolle
gehört zur **Zuordnung**, nicht zur Person: dieselbe Person kann bei einer
Reise Reiseleiter und bei einer anderen Teilnehmer sein.

| Spalte           | Typ  | Nullbar | Bemerkung                               |
| ---------------- | ---- | ------- | --------------------------------------- |
| `trip_id`        | uuid | nein    | → `trip.id`, Teil des Primärschlüssels  |
| `participant_id` | uuid | nein    | → `participant.id`, Teil des Schlüssels |
| `role`           | text | nein    | zwei Werte, siehe unten                 |

**Rollen:** `reiseleiter`, `teilnehmer`

Der Primärschlüssel sorgt dafür, dass eine Person derselben Reise nur
einmal zugeordnet ist. Die Zuordnungen hängen mit `ON DELETE CASCADE` am
Teilnehmer: wird er aus dem Account entfernt, fährt er nirgends mehr mit.

Zwei Regeln stehen in der Anwendung, nicht im Schema (siehe
`lib/trip-participants/rules.ts`): wer eine Reise anlegt, ist ihr als
Reiseleiter zugeordnet, und der letzte Reiseleiter einer Reise lässt sich
weder entfernen noch herabstufen. Verliert eine Reise ihren letzten
Reiseleiter — etwa weil die Person aus dem Account entfernt wurde —, rückt
die dienstälteste verbliebene Person nach.

Die Rolle wird erfasst und angezeigt, schränkt aber noch nichts ein: alle
angemeldeten Personen können dasselbe tun (req-021).

### poi

Ein gesammelter Ort — eine Idee für die Reise, **ohne feste Zeit**.
Nicht zu verwechseln mit `activity` (siehe Glossar in
[stack.md](stack.md)).

| Spalte            | Typ              | Nullbar | Bemerkung                                     |
| ----------------- | ---------------- | ------- | --------------------------------------------- |
| `id`              | uuid             | nein    | Primärschlüssel                               |
| `trip_id`         | uuid             | nein    | → `trip.id`                                   |
| `number`          | integer          | nein    | fortlaufend je Reise, eindeutig mit `trip_id` |
| `name`            | text             | nein    |                                               |
| `ort`             | text             | nein    | abgeleitet, leer erlaubt (req-041)            |
| `type`            | text             | nein    | sieben Werte, siehe unten                     |
| `lat` / `lng`     | double precision | nein    |                                               |
| `status`          | text             | nein    | fünf Werte, Vorgabe `weiss_nicht`             |
| `web`             | text             | ja      |                                               |
| `address`         | text             | ja      | volle Anschrift (req-026)                     |
| `phone`           | text             | ja      | Telefonnummer (req-026)                       |
| `opening_hours`   | text             | ja      | eine Zeile je Wochentag (req-026)             |
| `google_place_id` | text             | ja      | Kennung des Ortes bei Google (req-026)        |
| `manual_fields`   | text             | nein    | von Hand geänderte Angaben (req-035)          |

**Typen:** `sehenswuerdigkeit`, `stadt_dorf`, `restaurant`, `strand`,
`aktivitaet`, `hotel`, `weltkulturerbe`

**Status:** `gesetzt`, `wahrscheinlich`, `weiss_nicht`, `wenn_zeit`,
`auf_keinen_fall`

Die vier letzten Spalten stammen aus req-026 und sind freiwillig — von Hand
oder per KI-Suche angelegte POIs tragen sie nicht. `google_place_id` erkennt
denselben Ort wieder: ein partieller eindeutiger Index
(`poi_trip_google_place_id_key`) lässt dieselbe Kennung je Reise nur einmal
zu, sodass ein zweites Einfügen desselben Links den vorhandenen POI
auffrischt statt ihn zu verdoppeln. Nummer und Status bleiben dabei erhalten.

Dass die abgerufenen Angaben überhaupt gespeichert werden, ist eine bewusste,
vorläufige Abweichung von Googles Nutzungsbedingungen für den privaten
Betrieb (siehe req-026, Constraints, und [stack.md](stack.md)).

Seit req-035 lassen sich POIs auch von Hand anlegen, ändern und entfernen.
`manual_fields` hält fest, welche Angaben dabei geändert wurden —
kommagetrennte Feldnamen, leer heißt „nichts von Hand geändert“ (die Liste
der möglichen Namen steht in `lib/pois/manual-fields.ts`). Der Google-Import
frischt nur Felder auf, die dort **nicht** stehen; ohne diese Spalte wäre
jede Korrektur beim nächsten Einfügen des Links wieder weg. Vermerkt wird
nur, was sich tatsächlich geändert hat, und ein neu angelegter POI beginnt
mit leerem Wert — ein später eingefügter Google-Link darf ihn noch ergänzen.

Seit req-041 wird `ort` nicht mehr eingegeben, sondern bei jedem Speichern
abgeleitet: aus `address`, sonst aus `lat`/`lng`, über die Ortssuche von
OpenStreetMap. Gespeichert wird nur die Ortschaft, ohne Region und ohne Land.
Lässt sich keine ermitteln, bleibt der gespeicherte Wert stehen; bei einem
neuen POI bleibt die Spalte leer. `ort` steht deshalb nicht mehr in
`manual_fields` — ein dort noch aus der Zeit davor vermerktes `ort` wird beim
Lesen übergangen.

Beim Entfernen eines POI bleibt ein Programmpunkt, der aus ihm entstanden
ist, bestehen und verliert nur die Verknüpfung (`activity.poi_id` wird
geleert, ebenso `document.poi_id`); seine Foto-Datensätze und ihre Dateien
verschwinden mit ihm (siehe `deletePoi` in `lib/db/pois.ts`).

### poi_photo

Ein Foto eines POI (req-026). Nach der Regel aus [stack.md](stack.md) liegt
die **Datei** im Bildverzeichnis (`IMAGE_DIR`) und die Datenbank hält den
zugehörigen Datensatz — kein Bild ohne Datensatz, kein Datensatz ohne Datei.
Der Google-Import bringt höchstens drei mit; von Hand hinzugefügte kommen
seit req-035 dazu.

| Spalte       | Typ         | Nullbar | Bemerkung                                                             |
| ------------ | ----------- | ------- | --------------------------------------------------------------------- |
| `id`         | uuid        | nein    | Primärschlüssel; zugleich die Bildadresse unter `/api/poi-fotos/<id>` |
| `poi_id`     | uuid        | nein    | → `poi.id`, `ON DELETE CASCADE`                                       |
| `position`   | integer     | nein    | Reihenfolge ab 1, eindeutig je POI                                    |
| `file_name`  | text        | nein    | Dateiname im Bildverzeichnis                                          |
| `created_at` | timestamptz | nein    |                                                                       |
| `source`     | text        | nein    | zwei Werte, Vorgabe `google` (req-035)                                |

**Herkunft:** `google`, `manuell`

Das Foto an Position 1 ersetzt in der POI-Zeile des Planers die farbige
Fläche des Typs; ohne Fotos bleibt es bei der Fläche (req-010). Die
Reihenfolge ändert der Nutzer seit req-035 selbst.

`source` entscheidet, was ein erneutes Einfügen des Google-Links ersetzt:
`replacePoiPhotos` löst nur die Fotos aus Google ab, die von Hand
hinzugefügten bleiben erhalten und stehen danach vorn. Die Art des Bildes
steht nicht in der Datenbank — sie ergibt sich aus der Endung des von der
Anwendung vergebenen `file_name` (siehe `lib/pois/photo-upload.ts`); der
hochgeladene Name bestimmt den Ablageort nie.

Beim Entfernen eines POI verschwinden seine Foto-Datensätze mit ihm. Die
Dateien dazu räumt die Anwendung: `deleteTrip` löscht die Datensätze, und der
Aufrufer entfernt vorher geholte Dateinamen aus der Ablage (siehe
`lib/db/poi-photos.ts`, `app/api/trips/route.ts`).

### activity

Ein Programmpunkt mit fester Zeit, einem Reisetag zugeordnet. Entsteht,
wenn ein POI verplant wird — `poi_id` hält diese Verknüpfung. Ein
Programmpunkt gehört zu dem Reisetag, an dem er **beginnt**, auch wenn
er über Mitternacht reicht.

| Spalte                | Typ              | Nullbar | Bemerkung                             |
| --------------------- | ---------------- | ------- | ------------------------------------- |
| `id`                  | uuid             | nein    | Primärschlüssel                       |
| `trip_id`             | uuid             | nein    | → `trip.id`                           |
| `poi_id`              | uuid             | ja      | → `poi.id`; gesetzt bedeutet verplant |
| `type`                | text             | nein    | sechs Werte (ohne `strand`)           |
| `title`               | text             | nein    |                                       |
| `short_text`          | text             | nein    |                                       |
| `long_text`           | text             | nein    | aufklappbarer Text                    |
| `start_at` / `end_at` | timestamp        | nein    | `end_at` muss später sein             |
| `lat` / `lng`         | double precision | ja      | für Karte und Navigation              |
| `booked`              | boolean          | nein    | Vorgabe `false`                       |
| `booking_url`         | text             | ja      | Rangfolge: Web vor E-Mail vor Telefon |
| `booking_email`       | text             | ja      |                                       |
| `booking_phone`       | text             | ja      |                                       |

**Zeitstempel ohne Zeitzone:** Die Uhrzeit gilt als Ortszeit am
Reiseziel und wird nicht umgerechnet (siehe bug-004).

Seit req-039 entsteht ein Programmpunkt auch im Planer: ein POI wird auf den
Zeitstrahl gezogen, `poi_id` hält die Verknüpfung, und der POI verschwindet
damit aus „Noch unverplant“. Sein Status bleibt dabei unverändert — verplant
und bewertet sind zwei verschiedene Dinge. Beim Entfernen eines
Programmpunkts gehen die Wege von und zu ihm (`transfer`) sowie eine Wahl,
die auf ihn zeigt (`activity_option_selection`), mit ihm; beide Tabellen
verweisen ohne `on delete`-Regel auf ihn, geräumt wird deshalb in der
Anwendung (siehe `deleteActivity` in `lib/db/activities.ts`).

### transfer

Ein Weg zwischen zwei Programmpunkten desselben Reisetages. An- und
Abreise sind gewöhnliche Transfers mit den Verkehrsmitteln `flug`,
`bahn` oder `faehre` (siehe req-018).

| Spalte             | Typ              | Nullbar | Bemerkung                 |
| ------------------ | ---------------- | ------- | ------------------------- |
| `id`               | uuid             | nein    | Primärschlüssel           |
| `trip_id`          | uuid             | nein    | → `trip.id`               |
| `from_activity_id` | uuid             | nein    | → `activity.id`           |
| `to_activity_id`   | uuid             | nein    | → `activity.id`           |
| `mode`             | text             | nein    | sieben Werte, siehe unten |
| `title`            | text             | nein    |                           |
| `duration_min`     | integer          | nein    | muss > 0 sein             |
| `distance_km`      | double precision | nein    | muss > 0 sein             |

**Verkehrsmittel:** `fuss`, `auto`, `bus`, `boot`, `flug`, `bahn`,
`faehre`

### activity_option_selection

Die gewählte Alternative einer Optionsgruppe. Mehrere Programmpunkte
desselben Tages mit **identischem Beginn und Ende** gelten als
Alternativen zueinander; der Schlüssel bildet genau das ab.

| Spalte                 | Typ       | Nullbar | Bemerkung                 |
| ---------------------- | --------- | ------- | ------------------------- |
| `trip_id`              | uuid      | nein    | Teil des Primärschlüssels |
| `start_at`             | timestamp | nein    | Teil des Primärschlüssels |
| `end_at`               | timestamp | nein    | Teil des Primärschlüssels |
| `selected_activity_id` | uuid      | nein    | → `activity.id`           |

Die Wahl gilt für alle Teilnehmer der Reise, nicht je Person.

### document

Ein abgelegtes Dokument einer Reise (req-034): Ticket,
Buchungsbestätigung, Mietwagenvertrag. Nach der Regel aus
[stack.md](stack.md) liegt die **Datei** im Bildverzeichnis (`IMAGE_DIR`)
und die Datenbank hält den zugehörigen Datensatz — kein Dokument ohne
Datensatz, kein Datensatz ohne Datei.

| Spalte         | Typ         | Nullbar | Bemerkung                                                         |
| -------------- | ----------- | ------- | ----------------------------------------------------------------- |
| `id`           | uuid        | nein    | Primärschlüssel; zugleich die Adresse unter `/api/dokumente/<id>` |
| `trip_id`      | uuid        | nein    | → `trip.id`                                                       |
| `name`         | text        | nein    | der angezeigte Name, z.B. „Flugticket.pdf“                        |
| `file_name`    | text        | nein    | Dateiname in der Ablage, eindeutig; von der Anwendung vergeben    |
| `content_type` | text        | nein    | Bilder und PDF, siehe unten                                       |
| `size_bytes`   | integer     | nein    | muss > 0 sein; höchstens 20 MB (in der Anwendung geprüft)         |
| `page_count`   | integer     | ja      | Seitenzahl einer PDF-Datei, sonst leer                            |
| `poi_id`       | uuid        | ja      | → `poi.id`, `ON DELETE SET NULL`                                  |
| `transfer_id`  | uuid        | ja      | → `transfer.id`, `ON DELETE SET NULL`                             |
| `uploaded_by`  | uuid        | ja      | → `participant.id`, `ON DELETE SET NULL`                          |
| `created_at`   | timestamptz | nein    | die Liste zeigt das neueste zuerst                                |

**Arten:** `application/pdf`, `image/jpeg`, `image/png`, `image/webp`,
`image/gif`, `image/heic`, `image/heif`

Die Prüfbedingung `document_single_link` lässt höchstens eine Verknüpfung
zu: ein Dokument gehört zur Reise und ist zusätzlich mit einem POI **oder**
einem Transfer dieser Reise verknüpft, nie mit beidem. Dass die
Verknüpfung zu derselben Reise gehört, steht in der Anwendung (siehe
`lib/db/documents.ts`).

Beide Verknüpfungen lösen sich mit `ON DELETE SET NULL`, wenn ihr Ziel
verschwindet — das Dokument bleibt, es hängt an der Reise. Dasselbe gilt
für `uploaded_by`: ein Ticket verliert seinen Wert nicht, weil jemand die
Gruppe verlassen hat; auf der Karte fehlt dann nur der Name.

Die Datei liegt in einem eigenen Unterverzeichnis `dokumente/` des
Bildverzeichnisses (siehe `lib/images/document-store.ts`). Das ist
Bedingung für die tägliche Prüfung (req-034): sie entfernt Dateien ohne
Datensatz und darf dabei die POI-Fotos daneben nicht anfassen. Datensätze
ohne Datei werden gemeldet, nicht entfernt.

Ihr Name wird von der Anwendung vergeben (Zufallskennung + Endung) und nie
aus dem hochgeladenen Namen abgeleitet — sonst ließe sich über einen Namen
wie `../` außerhalb des Verzeichnisses schreiben (req-034, Constraints).

Beim Entfernen einer Reise verschwinden ihre Dokumente; die Dateien dazu
räumt der Aufrufer (siehe `lib/db/trips.ts`, `app/api/trips/route.ts`).

## Gruppenkasse

### expense

Eine erfasste Ausgabe einer Reise (req-029). Die Mandantentrennung läuft
wie bei `poi` und `activity` über die Reise.

| Spalte                  | Typ              | Nullbar | Bemerkung                                       |
| ----------------------- | ---------------- | ------- | ----------------------------------------------- |
| `id`                    | uuid             | nein    | Primärschlüssel                                 |
| `trip_id`               | uuid             | nein    | → `trip.id`                                     |
| `title`                 | text             | nein    | höchstens 80 Zeichen (in der Anwendung geprüft) |
| `amount_cents`          | integer          | nein    | Gesamtbetrag in Euro-Cent, muss > 0 sein        |
| `original_amount_cents` | integer          | nein    | der erfasste Betrag in seiner Währung           |
| `currency`              | text             | nein    | vier Werte, siehe unten                         |
| `exchange_rate`         | double precision | nein    | Euro je eine Einheit von `currency`; bei Euro 1 |
| `payer_id`              | uuid             | nein    | → `participant.id`, `ON DELETE CASCADE`         |
| `split_mode`            | text             | nein    | zwei Werte, siehe unten                         |
| `created_at`            | timestamptz      | nein    | die Liste zeigt die neueste zuerst              |

**Währungen:** `EUR`, `CHF`, `USD`, `GBP`

**Arten der Aufteilung:** `gleichmaessig`, `individuell`

Beträge liegen als ganze Cent, nicht als Gleitkommazahl: bei Geld muss die
Summe der Anteile den Gesamtbetrag exakt treffen, und das hält keine
Gleitkommazahl durch. Geführt werden alle Beträge in Euro — Euro ist die
Währung der Abrechnung (req-029, Constraints); der ursprünglich erfasste
Betrag samt Währung steht daneben und bleibt sichtbar.

`exchange_rate` wird beim Erfassen bei frankfurter.dev ermittelt (die
Referenzkurse der EZB, siehe [stack.md](stack.md)) und danach **nie wieder
geändert** — sonst verschöben sich bereits abgerechnete Beträge
nachträglich. Nur ein Wechsel der Währung einer Ausgabe holt einen eigenen
Kurs (siehe `app/api/ausgaben/route.ts`). Ist die Kursquelle beim Erfassen
nicht erreichbar, wird eine Ausgabe in fremder Währung nicht gespeichert;
Ausgaben in Euro sind davon nicht betroffen.

`payer_id` hängt mit `ON DELETE CASCADE` an der Person: ohne das ließe sich
jemand, der einmal gezahlt hat, nicht mehr aus dem Account entfernen
(req-019). Mit ihm verschwinden also seine Ausgaben.

Dass Zahler und Beteiligte Teilnehmer der Reise sind (`trip_participant`),
steht in der Anwendung und nicht im Schema (siehe `lib/db/expenses.ts`).

### expense_share

Der Anteil je beteiligter Person, ebenfalls in Euro-Cent (req-029). Der
Primärschlüssel lässt je Ausgabe und Person genau einen Anteil zu.

| Spalte           | Typ     | Nullbar | Bemerkung                               |
| ---------------- | ------- | ------- | --------------------------------------- |
| `expense_id`     | uuid    | nein    | → `expense.id`, `ON DELETE CASCADE`     |
| `participant_id` | uuid    | nein    | → `participant.id`, `ON DELETE CASCADE` |
| `amount_cents`   | integer | nein    | der Anteil dieser Person in Euro-Cent   |

Die Summe der Anteile einer Ausgabe ergibt ihren Gesamtbetrag — auch bei
einer Teilung, die nicht aufgeht: den Rest von wenigen Cent trägt der
Zahler (siehe `lib/expenses/split.ts`). Ist der Zahler selbst nicht
beteiligt, hat er nur ausgelegt und bekommt keinen Anteil; den Rest trägt
dann die erste beteiligte Person.

## Suchgebiet

### search_area

Das gezeichnete Polygon einer Reise. **Höchstens eines je Reise** —
`trip_id` ist eindeutig.

| Spalte    | Typ  | Nullbar          |
| --------- | ---- | ---------------- |
| `id`      | uuid | nein             |
| `trip_id` | uuid | nein (eindeutig) |

### search_area_point

Die Eckpunkte, geordnet über `position`. Hängt mit `ON DELETE CASCADE`
am Suchgebiet.

| Spalte           | Typ              | Nullbar | Bemerkung                        |
| ---------------- | ---------------- | ------- | -------------------------------- |
| `id`             | uuid             | nein    |                                  |
| `search_area_id` | uuid             | nein    |                                  |
| `position`       | integer          | nein    | Reihenfolge, eindeutig je Gebiet |
| `lat` / `lng`    | double precision | nein    |                                  |

## Bestand auf dev

| Tabelle            | Zeilen |
| ------------------ | ------ |
| `account`          | 1      |
| `participant`      | 1      |
| `trip`             | 3      |
| `trip_participant` | 3      |
| `poi`              | 20     |
| `activity`         | 42     |
| `transfer`         | 9      |
| `search_area`      | 1      |

## Was noch fehlt

Aus der Vision, aber noch nicht im Schema:

- Gruppenkasse: Belege zu einer Ausgabe. Die Ausgaben selbst stehen seit
  req-029 in `expense` und `expense_share`. Salden je Person und der
  Ausgleich stehen bewusst **nicht** im Schema: sie werden seit req-030
  aus den Ausgaben gerechnet (`lib/expenses/balances.ts`,
  `lib/expenses/settlement.ts`) — getrennt gefuehrt könnten beide
  auseinanderlaufen. Eine abgehakte Zahlung wird als gewöhnliche Ausgabe
  in `expense` abgelegt (Zahler ist der Zahlende, einziger Anteil der des
  Empfängers); eine zweite Ablage für Zahlungen zwischen Teilnehmern gibt
  es nicht
- Bewertungsrunden mit Stimmen und Kommentaren
- Standort der Teilnehmer während der Reise
- Unterschiedliche Rechte je Rolle — die Rolle entscheidet seit req-023
  darüber, wer eine Reise sieht und wie lange seine Sitzung gilt, aber
  noch nicht darüber, wer was ändern darf. Die Personenverwaltung hängt
  seit req-027 am Account-Admin, nicht an der Rolle
- Beenden fremder Sitzungen bei Geräteverlust
- Reise-Eckdaten wie Reiseart, Budget, Währung
