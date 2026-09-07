-- Die geteilte Position eines Teilnehmers waehrend einer Reise. Sie ist die
-- Grundlage des Live-Status mit Verzug (req-051): ohne sie laesst sich nicht
-- ausrechnen, wie weit die Gruppe vom geplanten Programmpunkt entfernt ist.
--
-- Je Teilnehmer und Reise gibt es hoechstens eine Zeile -- der zusammen-
-- gesetzte Primaerschluessel erzwingt es. Jede neue Messung ueberschreibt die
-- vorherige: es entsteht keine Historie und kein Bewegungsprofil (siehe
-- delivery/vision.md, Leitprinzipien). Wer nicht mehr teilt, hat keine Zeile;
-- das Vorhandensein der Zeile ist die Freigabe.
--
-- Wie jede Tabelle mit Nutzerdaten traegt sie eine Account-Zuordnung und wird
-- immer danach gefiltert (siehe delivery/stack.md, Mandantenfaehigkeit). Sie
-- liegt hier redundant neben der Reise, damit jede Abfrage ohne Umweg ueber
-- trip nach dem Mandanten filtern kann.
create table trip_position (
  trip_id uuid not null references trip (id) on delete cascade,
  participant_id uuid not null references participant (id) on delete cascade,
  account_id uuid not null references account (id) on delete cascade,
  lat double precision not null,
  lng double precision not null,
  ort text,
  recorded_at timestamptz not null,
  primary key (trip_id, participant_id)
);

create index trip_position_account_id_idx on trip_position (account_id);

-- `ort` ist die Ortschaft zur Position (z.B. "Praiano"), nachgeschlagen bei
-- Nominatim. Sie darf fehlen: ist die Ortssuche gerade nicht erreichbar, wird
-- die Position trotzdem gespeichert und der Ort beim Lesen nachgeholt.
