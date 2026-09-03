---
project: wegfara
stand: 2026-09-03
---

# Datenbank

Beschreibung des Schemas, ausgelesen aus der laufenden dev-Datenbank
(PostgreSQL 17). Sie ist eine **Momentaufnahme** — die Wahrheit sind die
Migrationen in `migrations/`, die bei jedem Start angewendet werden
(siehe [devops.md](devops.md)). Weicht diese Datei davon ab, gilt das
Schema.

## Überblick

18 Tabellen in vier Gruppen:

| Gruppe               | Tabellen                                                                                            |
| -------------------- | --------------------------------------------------------------------------------------------------- |
| Mandant und Personen | `account`, `participant`, `account_switch`                                                          |
| Anmeldung            | `session`, `credential`, `login_link`, `access_link`, `recovery_code`                               |
| Reise und Inhalt     | `trip`, `trip_participant`, `poi`, `poi_photo`, `activity`, `transfer`, `activity_option_selection` |
| Suchgebiet           | `search_area`, `search_area_point`                                                                  |

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

| Spalte           | Typ         | Nullbar | Bemerkung                                           |
| ---------------- | ----------- | ------- | --------------------------------------------------- |
| `id`             | uuid        | nein    | Primärschlüssel                                     |
| `account_id`     | uuid        | nein    | → `account.id`                                      |
| `name`           | text        | nein    | höchstens 80 Zeichen (in der Anwendung geprüft)     |
| `nickname`       | text        | ja      | höchstens 20 Zeichen (in der Anwendung geprüft)     |
| `email`          | text        | ja      | eindeutig, soweit gesetzt; Ziel des Anmeldelinks    |
| `phone`          | text        | ja      | Telefonnummer, freies Format                        |
| `iban`           | text        | ja      | Bankverbindung ohne Leerzeichen, Prüfziffer geprüft |
| `login_enabled`  | boolean     | nein    | Vorgabe `false`                                     |
| `is_super_admin` | boolean     | nein    | Vorgabe `false`; höchstens einmal `true`            |
| `created_at`     | timestamptz | nein    |                                                     |

`is_super_admin` kennzeichnet den Gesamt-Admin (req-025). Ein partieller
eindeutiger Index (`participant_single_super_admin`) lässt genau einen
zu — „genau eine Person“ ist damit eine Bedingung des Schemas und keine
Absichtserklärung. Gesetzt und entzogen wird die Kennzeichnung
ausschließlich direkt in der Datenbank: die Anwendung liest die Spalte,
schreibt sie an keiner Stelle.

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
[security.md](security.md)).

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

## Anmeldung

Alle fünf Tabellen speichern Geheimnisse **ausschließlich als
Prüfsumme**, nie im Klartext (siehe [security.md](security.md)). Sie
hängen mit `ON DELETE CASCADE` am Teilnehmer: wird er entfernt,
verschwinden Sitzungen, Passkeys, Links und Codes mit.

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
| `state`           | text             | nein    | drei Werte, Vorgabe `in_planung` |

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
| `ort`             | text             | nein    |                                               |
| `type`            | text             | nein    | sieben Werte, siehe unten                     |
| `lat` / `lng`     | double precision | nein    |                                               |
| `status`          | text             | nein    | fünf Werte, Vorgabe `weiss_nicht`             |
| `web`             | text             | ja      |                                               |
| `address`         | text             | ja      | volle Anschrift (req-026)                     |
| `phone`           | text             | ja      | Telefonnummer (req-026)                       |
| `opening_hours`   | text             | ja      | eine Zeile je Wochentag (req-026)             |
| `google_place_id` | text             | ja      | Kennung des Ortes bei Google (req-026)        |

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

### poi_photo

Ein Foto eines POI (req-026). Nach der Regel aus [stack.md](stack.md) liegt
die **Datei** im Bildverzeichnis (`IMAGE_DIR`) und die Datenbank hält den
zugehörigen Datensatz — kein Bild ohne Datensatz, kein Datensatz ohne Datei.
Höchstens drei je POI.

| Spalte       | Typ         | Nullbar | Bemerkung                                                             |
| ------------ | ----------- | ------- | --------------------------------------------------------------------- |
| `id`         | uuid        | nein    | Primärschlüssel; zugleich die Bildadresse unter `/api/poi-fotos/<id>` |
| `poi_id`     | uuid        | nein    | → `poi.id`, `ON DELETE CASCADE`                                       |
| `position`   | integer     | nein    | Reihenfolge ab 1, eindeutig je POI                                    |
| `file_name`  | text        | nein    | Dateiname im Bildverzeichnis                                          |
| `created_at` | timestamptz | nein    |                                                                       |

Das Foto an Position 1 ersetzt in der POI-Zeile des Planers die farbige
Fläche des Typs; ohne Fotos bleibt es bei der Fläche (req-010).

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

- Gruppenkasse: Ausgaben, Belege, Saldenausgleich
- Bewertungsrunden mit Stimmen und Kommentaren
- Dokumente und Reiseunterlagen
- Standort der Teilnehmer während der Reise
- Unterschiedliche Rechte je Rolle — die Rolle entscheidet seit req-023
  darüber, wer eine Reise sieht und wie lange seine Sitzung gilt, aber
  noch nicht darüber, wer was ändern darf
- Beenden fremder Sitzungen bei Geräteverlust
- Reise-Eckdaten wie Reiseart, Budget, Währung
