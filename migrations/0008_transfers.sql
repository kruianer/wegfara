-- Transfer zwischen zwei Programmpunkten desselben Reisetages (req-006).
-- Ohne hinterlegte Position am Zielpunkt zeigt der Transfer keine
-- "Route"-Schaltflaeche, daher muss die Position eines Programmpunkts
-- optional sein.
alter table activity alter column lat drop not null;
alter table activity alter column lng drop not null;

create table transfer (
  id uuid primary key,
  trip_id uuid not null references trip (id),
  from_activity_id uuid not null references activity (id),
  to_activity_id uuid not null references activity (id),
  mode text not null check (mode in ('fuss', 'auto', 'bus', 'boot')),
  title text not null,
  duration_min integer not null check (duration_min > 0),
  distance_km double precision not null check (distance_km > 0)
);

create index transfer_trip_id_idx on transfer (trip_id);
