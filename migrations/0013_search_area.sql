-- Suchgebiet: eine vom Reiseleiter gezeichnete Flaeche, die den Bereich der
-- Reise umreisst (siehe req-012). Je Reise hoechstens ein Suchgebiet.
-- Die Eckpunkte sind eine geordnete Kette eigener Zeilen statt einer festen
-- Anzahl Spalten, da die Anzahl der Eckpunkte nicht begrenzt ist.
create table search_area (
  id uuid primary key,
  trip_id uuid not null unique references trip (id)
);

create table search_area_point (
  id uuid primary key,
  search_area_id uuid not null references search_area (id) on delete cascade,
  position int not null,
  lat double precision not null,
  lng double precision not null,
  unique (search_area_id, position)
);

create index search_area_point_search_area_id_idx on search_area_point (search_area_id);
