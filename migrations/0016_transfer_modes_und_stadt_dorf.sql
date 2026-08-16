-- req-018: An- und Abreise werden als Transfer abgebildet. Dafuer bekommt
-- der Transfer drei weitere Verkehrsmittel (Flug, Bahn, Faehre) und der
-- Programmpunkt den Typ "Stadt & Dorf" fuer den Ausgangspunkt der Anreise
-- (der POI kennt ihn bereits, siehe migrations/0010_poi.sql). Es entsteht
-- weder eine neue Tabelle noch eine zweite Art von Transfer.
--
-- Beide Checks stammen aus einem Inline-Constraint ohne eigenen Namen.
-- PostgreSQL benennt so einen Check automatisch <tabelle>_<spalte>_check,
-- die Test-Datenbank pg-mem (siehe tests/test-db.ts) dagegen
-- <tabelle>_constraint_<n>. Damit in beiden Umgebungen dasselbe Schema
-- entsteht, werden beide Namen mit "if exists" abgeraeumt und der Check
-- danach unter einem festen Namen neu angelegt.
alter table transfer drop constraint if exists transfer_mode_check;
alter table transfer drop constraint if exists transfer_constraint_1;
alter table transfer add constraint transfer_mode_check check (
  mode in ('fuss', 'auto', 'bus', 'boot', 'flug', 'bahn', 'faehre')
);

alter table activity drop constraint if exists activity_type_check;
alter table activity drop constraint if exists activity_constraint_1;
alter table activity add constraint activity_type_check check (
  type in ('sehenswuerdigkeit', 'stadt_dorf', 'restaurant', 'hotel', 'aktivitaet', 'weltkulturerbe')
);
