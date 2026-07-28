-- Zeitgleiche Programmpunkte als Optionen (req-004): die getroffene Wahl
-- innerhalb einer Options-Gruppe, gueltig fuer alle Teilnehmer der Reise.
-- Eine Gruppe ist keine eigene Entitaet -- sie ergibt sich rein daraus,
-- dass mehrere Programmpunkte derselben Reise in Beginn und Ende exakt
-- uebereinstimmen (siehe Constraints in req-004) -- daher referenziert der
-- Schluessel trip_id/start_at/end_at statt einer Gruppen-ID.
create table activity_option_selection (
  trip_id uuid not null references trip (id),
  start_at timestamp not null,
  end_at timestamp not null,
  selected_activity_id uuid not null references activity (id),
  primary key (trip_id, start_at, end_at)
);
