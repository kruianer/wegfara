-- Programmpunkt: ein einzelnes Element des Plans einer Reise (siehe
-- delivery/requirements/done/req-003-...).
create table activity (
  id uuid primary key,
  trip_id uuid not null references trip (id),
  type text not null check (
    type in ('sehenswuerdigkeit', 'restaurant', 'hotel', 'aktivitaet', 'weltkulturerbe')
  ),
  title text not null,
  short_text text not null,
  long_text text not null,
  start_at timestamp not null,
  end_at timestamp not null,
  lat double precision not null,
  lng double precision not null,
  constraint activity_time_range_valid check (end_at > start_at)
);

create index activity_trip_id_idx on activity (trip_id);
