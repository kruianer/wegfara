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

14 Tabellen in vier Gruppen:

| Gruppe               | Tabellen                                                           |
| -------------------- | ------------------------------------------------------------------ |
| Mandant und Personen | `account`, `participant`                                           |
| Anmeldung            | `session`, `credential`, `login_link`, `recovery_code`             |
| Reise und Inhalt     | `trip`, `poi`, `activity`, `transfer`, `activity_option_selection` |
| Suchgebiet           | `search_area`, `search_area_point`                                 |

Dazu `schema_migrations`, die den Stand der angewendeten Migrationen
festhält.

Alle Schlüssel sind UUIDs. Ausnahme: `credential.id` übernimmt die
Kennung des Passkeys vom Gerät.

## Mandant und Personen

### account

Die oberste Ebene des Datenmodells — der Mandant. Derzeit existiert
genau einer (siehe [stack.md](stack.md), Mandantenfähigkeit).

| Spalte  | Typ  | Nullbar | Bemerkung       |
| ------- | ---- | ------- | --------------- |
| `id`    | uuid | nein    | Primärschlüssel |
| `name`  | text | nein    |                 |
| `email` | text | nein    | eindeutig       |

### participant

Eine Person innerhalb eines Accounts. Anmeldung und Reiseteilnahme
hängen daran. Verwaltet wird sie im Planer unter „Einstellungen“, Karte
„Reiseteilnehmer“ (siehe req-019).

| Spalte          | Typ         | Nullbar | Bemerkung                                           |
| --------------- | ----------- | ------- | --------------------------------------------------- |
| `id`            | uuid        | nein    | Primärschlüssel                                     |
| `account_id`    | uuid        | nein    | → `account.id`                                      |
| `name`          | text        | nein    | höchstens 80 Zeichen (in der Anwendung geprüft)     |
| `nickname`      | text        | ja      | höchstens 20 Zeichen (in der Anwendung geprüft)     |
| `email`         | text        | ja      | eindeutig, soweit gesetzt; Ziel des Anmeldelinks    |
| `phone`         | text        | ja      | Telefonnummer, freies Format                        |
| `iban`          | text        | ja      | Bankverbindung ohne Leerzeichen, Prüfziffer geprüft |
| `login_enabled` | boolean     | nein    | Vorgabe `false`                                     |
| `created_at`    | timestamptz | nein    |                                                     |

Der `nickname` ist freiwillig und ersetzt den Namen nur in der Anzeige
(req-020) — gespeichert bleiben beide. Wo eine Bankverbindung oder eine
Zahlung dargestellt wird, gilt immer der volle Name.

`login_enabled` entscheidet über den Zugang: erfasste Personen erhalten
keinen — weder per Anmeldelink noch per Notfallcode. Wer Zugang hat,
braucht eine E-Mail-Adresse; eine Prüfbedingung erzwingt das.

Telefonnummer und Bankverbindung sind personenbezogene Daten und nur
für angemeldete Personen desselben Accounts sichtbar (siehe
[security.md](security.md)).

## Anmeldung

Alle vier Tabellen speichern Geheimnisse **ausschließlich als
Prüfsumme**, nie im Klartext (siehe [security.md](security.md)). Sie
hängen mit `ON DELETE CASCADE` am Teilnehmer: wird er entfernt,
verschwinden Sitzungen, Passkeys und Codes mit.

### session

Eine angemeldete Sitzung. Läuft 90 Tage und verlängert sich bei
Nutzung.

| Spalte           | Typ         | Nullbar          |
| ---------------- | ----------- | ---------------- |
| `id`             | uuid        | nein             |
| `participant_id` | uuid        | nein             |
| `token_hash`     | text        | nein (eindeutig) |
| `created_at`     | timestamptz | nein             |
| `expires_at`     | timestamptz | nein             |

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

### recovery_code

Notfallcodes, acht Stück je Satz, einmalig angezeigt. Jeder ist einmal
verwendbar.

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

| Spalte            | Typ              | Nullbar | Bemerkung                |
| ----------------- | ---------------- | ------- | ------------------------ |
| `id`              | uuid             | nein    | Primärschlüssel          |
| `account_id`      | uuid             | nein    | → `account.id`           |
| `title`           | text             | nein    |                          |
| `start_date`      | date             | nein    |                          |
| `end_date`        | date             | nein    | muss ≥ `start_date` sein |
| `main_place_name` | text             | nein    |                          |
| `main_place_lat`  | double precision | nein    |                          |
| `main_place_lng`  | double precision | nein    |                          |

### poi

Ein gesammelter Ort — eine Idee für die Reise, **ohne feste Zeit**.
Nicht zu verwechseln mit `activity` (siehe Glossar in
[stack.md](stack.md)).

| Spalte        | Typ              | Nullbar | Bemerkung                                     |
| ------------- | ---------------- | ------- | --------------------------------------------- |
| `id`          | uuid             | nein    | Primärschlüssel                               |
| `trip_id`     | uuid             | nein    | → `trip.id`                                   |
| `number`      | integer          | nein    | fortlaufend je Reise, eindeutig mit `trip_id` |
| `name`        | text             | nein    |                                               |
| `ort`         | text             | nein    |                                               |
| `type`        | text             | nein    | sieben Werte, siehe unten                     |
| `lat` / `lng` | double precision | nein    |                                               |
| `status`      | text             | nein    | fünf Werte, Vorgabe `weiss_nicht`             |
| `web`         | text             | ja      |                                               |

**Typen:** `sehenswuerdigkeit`, `stadt_dorf`, `restaurant`, `strand`,
`aktivitaet`, `hotel`, `weltkulturerbe`

**Status:** `gesetzt`, `wahrscheinlich`, `weiss_nicht`, `wenn_zeit`,
`auf_keinen_fall`

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

| Tabelle       | Zeilen |
| ------------- | ------ |
| `account`     | 1      |
| `participant` | 1      |
| `trip`        | 3      |
| `poi`         | 20     |
| `activity`    | 42     |
| `transfer`    | 9      |
| `search_area` | 1      |

## Was noch fehlt

Aus der Vision, aber noch nicht im Schema:

- Teilnehmer je Reise (wer reist mit) und Einladungen per QR-Code —
  `participant` hängt am Account, nicht an einer Reise (req-019)
- Gruppenkasse: Ausgaben, Belege, Saldenausgleich
- Bewertungsrunden mit Stimmen und Kommentaren
- Dokumente und Reiseunterlagen
- Standort der Teilnehmer während der Reise
- Rollen (Reiseleiter, Teilnehmer)
- Reise-Eckdaten wie Reiseart, Budget, Währung
