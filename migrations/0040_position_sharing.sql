-- Ob ein Teilnehmer seine Position bei einer Reise teilt (req-050). Der
-- Schalter "Meine Position teilen" gilt bis zum Widerruf -- unabhaengig
-- davon, ob gerade tatsaechlich etwas gesendet wird. Das Vorhandensein
-- einer Zeile ist die Freigabe, wie schon bei trip_position
-- (migrations/0035_teilnehmer_position.sql): wer nicht mehr teilt, hat
-- keine.
--
-- Das ist bewusst getrennt von trip_position: die dortige Zeile haelt die
-- zuletzt gemessene Position und verschwindet auch dann nicht von selbst,
-- wenn sie fuer die Anzeige zu alt geworden ist (siehe lib/positions). Die
-- Freigabe hier bleibt davon unberuehrt, solange der Nutzer sie nicht
-- selbst widerruft -- etwa waehrend die Reise noch in Planung ist und noch
-- gar nichts geteilt werden darf.
create table position_sharing (
  trip_id uuid not null references trip (id) on delete cascade,
  participant_id uuid not null references participant (id) on delete cascade,
  account_id uuid not null references account (id) on delete cascade,
  enabled_at timestamptz not null,
  primary key (trip_id, participant_id)
);

create index position_sharing_account_id_idx on position_sharing (account_id);
