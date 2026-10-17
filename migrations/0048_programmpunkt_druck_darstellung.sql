-- Wie ein Programmpunkt im gedruckten Reiseplan erscheint (req-080).
--
-- Das Kennzeichen gehoert zum Programmpunkt, nicht zum POI: derselbe Ort kann
-- an einem Tag die Hauptstation sein und an einem anderen die Pause auf dem
-- Weg. Es wirkt ausschliesslich auf den gedruckten Plan -- in Planer und
-- Begleiter bleibt jeder Programmpunkt sichtbar, gleich was hier steht.
--
-- Drei Werte, und der haeufigste ist die Vorgabe: ein neu verplanter Ort
-- bekommt im Heft Fotos und Langtext ("vollstaendig"). "nebenstation" ist der
-- Kaffee auf dem Weg, "nicht_anzeigen" laesst die Station im Heft weg.
--
-- Die drei Werte stehen fest und werden nicht als Stammdaten gefuehrt -- ein
-- frei angelegter vierter waere in der Anwendung wirkungslos (wie schon bei
-- poi.buchung, migrations/0044_poi_buchung.sql).
alter table activity
  add column druck_darstellung text not null default 'vollstaendig';

alter table activity add constraint activity_druck_darstellung_valid
  check (druck_darstellung in ('vollstaendig', 'nebenstation', 'nicht_anzeigen'));

-- Bestehende Programmpunkte stehen auf "vollstaendig" -- derselbe
-- Ausgangspunkt wie bei einem neu verplanten. Ausdruecklich gesetzt statt dem
-- Vorgabewert der Spalte ueberlassen.
update activity set druck_darstellung = 'vollstaendig';
