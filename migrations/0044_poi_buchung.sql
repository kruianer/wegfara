-- Buchungsstatus am POI (req-061): ob der Ort noch gebucht werden muss.
--
-- Drei Zustaende, und der haeufigste ist die Vorgabe: die meisten POIs sind
-- Straende und Aussichtspunkte, die niemand bucht. "Offen" heisst, dass es
-- noch zu tun ist, "Gebucht", dass es erledigt ist -- beides entscheidet
-- mit, ob der Ort in den Plan kommt.
--
-- Nicht zu verwechseln mit dem Buchungsstatus des Programmpunkts (req-005):
-- der beschreibt den Termin, dieser den Ort.
--
-- Die drei Werte stehen fest und werden nicht als Stammdaten gefuehrt -- ein
-- frei angelegter vierter waere in der Anwendung wirkungslos (wie schon bei
-- trip.state, migrations/0021_trip_state.sql).
alter table poi add column buchung text not null default 'nicht_noetig';

alter table poi add constraint poi_buchung_valid
  check (buchung in ('nicht_noetig', 'offen', 'gebucht'));

-- Bestehende POIs stehen auf "Nicht noetig" -- derselbe Ausgangspunkt wie
-- bei einem neu angelegten. Ausdruecklich gesetzt statt dem Vorgabewert der
-- Spalte ueberlassen.
update poi set buchung = 'nicht_noetig';
