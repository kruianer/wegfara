-- POI: ein gesammelter Ort, eine Idee fuer die Reise ohne feste Zeit
-- (siehe delivery/requirements/in-progress/req-010-...). Eigenstaendig
-- gegenueber der activity (Programmpunkt) -- kein Fremdschluessel dorthin.
create table poi (
  id uuid primary key,
  trip_id uuid not null references trip (id),
  name text not null,
  ort text not null,
  type text not null check (
    type in ('sehenswuerdigkeit', 'stadt_dorf', 'restaurant', 'strand', 'aktivitaet', 'hotel', 'weltkulturerbe')
  ),
  lat double precision not null,
  lng double precision not null,
  status text not null default 'weiss_nicht' check (
    status in ('gesetzt', 'wahrscheinlich', 'weiss_nicht', 'wenn_zeit', 'auf_keinen_fall')
  ),
  web text
);

create index poi_trip_id_idx on poi (trip_id);
