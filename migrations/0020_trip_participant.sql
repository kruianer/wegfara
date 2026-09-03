-- Teilnehmer einer Reise (req-021): welche Person bei welcher Reise
-- mitfaehrt und in welcher Rolle. Die Rolle gehoert zur Zuordnung, nicht zur
-- Person -- dieselbe Person kann bei einer Reise Reiseleiter und bei einer
-- anderen Teilnehmer sein.
--
-- Die beiden Rollen stehen fest und werden nicht als Stammdaten gefuehrt: an
-- einer Rolle haengen spaeter Rechtepruefungen, die ohnehin im Code stehen --
-- eine frei angelegte dritte Rolle waere wirkungslos (siehe req-021,
-- Constraints).
create table trip_participant (
  trip_id uuid not null references trip (id),
  participant_id uuid not null references participant (id) on delete cascade,
  role text not null,
  primary key (trip_id, participant_id),
  constraint trip_participant_role_valid
    check (role in ('reiseleiter', 'teilnehmer'))
);

create index trip_participant_participant_id_idx
  on trip_participant (participant_id);

-- Die bestehenden Reisen bekommen den Betreiber als Reiseleiter: eine Reise
-- hat immer mindestens einen (req-021). Zugang hat bisher allein er (siehe
-- migrations/0018_participant_kontaktdaten.sql) -- erfasste Personen ohne
-- Zugang faehrt niemand ungefragt mit.
-- Die Aliase halten die beiden id-Spalten auseinander; ohne sie greift die
-- Fremdschluesselpruefung des Test-Doubles (pg-mem) auf die falsche zu.
insert into trip_participant (trip_id, participant_id, role)
select t.id as trip_id, p.id as participant_id, 'reiseleiter' as role
from trip t
join participant p on p.account_id = t.account_id
where p.login_enabled;
