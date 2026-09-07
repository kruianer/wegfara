-- req-054: Die Bewertungsrunde -- der Reiseleiter stellt POIs einer Reise zur
-- Abstimmung, jeder Teilnehmer gibt je POI genau eine Stimme ab.
--
-- Status und Stimme sind zweierlei und stehen deshalb getrennt: `poi.status`
-- beschreibt den Ort und wird weiterhin allein vom Reiseleiter gesetzt, die
-- Stimme beschreibt die Person. Aus den Stimmen folgt nie ein Status -- der
-- Plan aendert sich nicht von selbst (siehe delivery/vision.md).
--
-- Die Mandantentrennung laeuft wie bei `poi` und `activity` ueber die Reise:
-- jede Abfrage verknuepft bis `trip.account_id` (siehe delivery/stack.md).
create table rating_round (
  id uuid primary key,
  trip_id uuid not null references trip (id) on delete cascade,
  status text not null default 'laeuft' check (status in ('laeuft', 'beendet')),
  started_at timestamptz not null,
  ended_at timestamptz
);

create index rating_round_trip_id_idx on rating_round (trip_id);

-- Zu einer Reise laeuft hoechstens eine Runde (req-054, Out of Scope:
-- "Mehrere gleichzeitig laufende Runden zu einer Reise"). Der Index haelt die
-- Regel auch dann, wenn zwei Anfragen gleichzeitig ankommen.
create unique index rating_round_eine_laufende_idx
  on rating_round (trip_id)
  where status = 'laeuft';

-- Ueber welche POIs in dieser Runde abgestimmt wird. Der Reiseleiter waehlt
-- sie beim Starten aus; danach steht die Runde fest.
create table rating_round_poi (
  round_id uuid not null references rating_round (id) on delete cascade,
  poi_id uuid not null references poi (id) on delete cascade,
  primary key (round_id, poi_id)
);

-- Die Stimme einer Person zu einem POI der Runde. Der Primaerschluessel laesst
-- je Runde, POI und Person genau eine zu: eine geaenderte Stimme ersetzt die
-- vorherige, statt eine zweite anzulegen.
--
-- Sie haengt an der Person und an der Runde und damit an der Reise -- dieselbe
-- Person kann bei verschiedenen Reisen verschieden stimmen (req-054,
-- Constraints; vgl. req-021). Mit der Person verschwinden ihre Stimmen
-- (`on delete cascade`), sonst liesse sie sich nicht mehr aus dem Account
-- entfernen (vgl. req-019).
--
-- "ohne_mich" heisst: diese Person ist dort nicht dabei, auch wenn die anderen
-- hingehen. Beendet wird die Runde ueber `rating_round.status`; die Stimmen
-- bleiben erhalten und sichtbar.
create table rating_vote (
  round_id uuid not null references rating_round (id) on delete cascade,
  poi_id uuid not null references poi (id) on delete cascade,
  participant_id uuid not null references participant (id) on delete cascade,
  choice text not null check (
    choice in (
      'unbedingt',
      'waere_schoen',
      'wenn_zeit',
      'lieber_nicht',
      'ohne_mich'
    )
  ),
  voted_at timestamptz not null,
  primary key (round_id, poi_id, participant_id)
);

create index rating_vote_participant_id_idx on rating_vote (participant_id);
