-- Die Gegend eines POI (req-095): ein frei benannter Block innerhalb der
-- Reise, nach dem sich die POI-Liste und die Tagesplanung filtern lassen --
-- "alles rund um Bilbao", "alles rund um San Sebastian".
--
-- Sie steht als Text am POI und nicht in einer eigenen Tabelle. Der Grund:
-- Eine Gegend existiert nur, solange mindestens ein POI sie traegt. Wird sie
-- beim letzten POI entfernt, soll sie verschwinden -- ohne dass irgendwo eine
-- leere Zeile zurueckbleibt, die aufgeraeumt werden muesste. Die Liste der
-- Gegenden einer Reise ist damit immer genau die Menge der tatsaechlich
-- verwendeten Namen (siehe lib/pois/gegenden.ts).
--
-- Die Gegend gilt je Reise: derselbe Name in zwei Reisen sind zwei Gegenden,
-- und beim Filtern wird ohnehin nur innerhalb einer Reise gesucht.
--
-- null heisst "keine Gegend zugeordnet". Der leere Text ist nicht erlaubt --
-- er waere eine zweite Schreibweise fuer dasselbe und wuerde als eigene
-- Gegend in der Liste auftauchen.

alter table poi add column gegend text;

-- Der leere Text ist nicht erlaubt: er waere eine zweite Schreibweise fuer
-- "keine Gegend" und tauchte als eigener Eintrag in der Liste auf. Geprueft
-- wird ohne trim() -- die Testablage (pg-mem) kennt die Funktion nicht, und
-- aufgeraeumt wird ohnehin eine Schicht hoeher (normalisiereGegend in
-- lib/pois/gegenden.ts). Diese Bedingung ist das Netz darunter.
alter table poi add constraint poi_gegend_nicht_leer check (
  gegend is null or gegend <> ''
);

-- Nach der Gegend wird gefiltert, immer innerhalb einer Reise.
create index poi_trip_id_gegend_idx on poi (trip_id, gegend);
