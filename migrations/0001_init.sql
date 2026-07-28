-- Account ist die oberste Ebene des Datenmodells (Mandant); jede
-- weitere Tabelle mit Nutzerdaten haengt daran (siehe delivery/stack.md).
create table account (
  id uuid primary key,
  name text not null,
  email text not null unique
);

create table trip (
  id uuid primary key,
  account_id uuid not null references account (id),
  title text not null,
  start_date date not null,
  end_date date not null,
  main_place_name text not null,
  main_place_lat double precision not null,
  main_place_lng double precision not null,
  constraint trip_date_range_valid check (end_date >= start_date)
);

create index trip_account_id_idx on trip (account_id);
