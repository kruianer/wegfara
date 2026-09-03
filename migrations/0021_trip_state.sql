-- Zustand einer Reise (req-022): ob der Reiseleiter noch plant, die Reise
-- fuer die Mitreisenden freigegeben hat oder sie samt Abrechnung erledigt
-- ist. Der Zustand wird gesetzt, nie berechnet -- er darf sich nicht aus dem
-- Zeitraum ableiten, sonst waere "freigegeben vor Reisebeginn" oder "nach
-- der Rueckkehr noch offen" nicht abbildbar (req-022, Constraints). Der aus
-- dem Zeitraum berechnete Zeitstatus (Aktiv, Geplant, Beendet) bleibt davon
-- unberuehrt und steht weiterhin nur im Code (lib/trips/status.ts).
--
-- Die drei Zustaende stehen fest und werden nicht als Stammdaten gefuehrt:
-- an einem Zustand haengen spaeter Zugriffspruefungen, die ohnehin im Code
-- stehen -- ein frei angelegter vierter Zustand waere wirkungslos.
alter table trip add column state text not null default 'in_planung';

alter table trip add constraint trip_state_valid
  check (state in ('in_planung', 'freigegeben', 'abgeschlossen'));

-- Bestehende Reisen stehen auf "In Planung" -- derselbe Ausgangspunkt wie
-- bei einer neu angelegten Reise (req-022). Die Freigabe trifft der
-- Reiseleiter bewusst, sie entsteht nicht nebenbei bei einer Migration.
update trip set state = 'in_planung';
