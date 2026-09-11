-- Kostenplanung einer Reise (req-062): was die Reise kosten wird, insgesamt
-- und je Person. Sie ist die Kalkulation **vorher** -- was unterwegs
-- tatsaechlich gezahlt wurde, sind die Ausgaben (expense, req-029) und bleibt
-- davon getrennt.
--
-- Die Tabelle haelt bewusst nur das, was sich nicht aus Plan und POI ergibt.
-- Die Zeilen der Tabelle entstehen bei jeder Anzeige neu (siehe
-- lib/kosten/zeilen.ts): je Programmpunkt eine, dazu die manuell erfassten.
-- Preis je Person und Buchungsstatus stehen am POI (poi.kosten_cent,
-- poi.buchung, req-061) -- hier steht keine zweite Kopie davon, sonst gaebe
-- es zwei Wahrheiten und die Frage, welche gilt.
--
-- Die Mandantentrennung laeuft ueber die Reise, wie bei poi, activity,
-- document und expense: eine Zeile haengt an einer Reise, die Reise am
-- Account.
create table kostenzeile (
  id uuid primary key,
  trip_id uuid not null references trip (id),
  -- Der Programmpunkt, aus dem die Zeile stammt. Mit ihm verschwindet sie:
  -- sie kommt aus dem Plan, und was nicht mehr im Plan steht, kostet auch
  -- nichts mehr (req-062). Der Preis bleibt dabei am POI gespeichert --
  -- wird der Programmpunkt erneut verplant, steht er wieder da.
  --
  -- Null heisst: eine manuelle Zeile fuer alles ohne Programmpunkt -- Maut,
  -- Parkgebuehren, Sprit.
  activity_id uuid references activity (id) on delete cascade,
  -- Bezeichnung, Preis und Buchungsstatus einer Zeile ohne POI. Bei einer
  -- Zeile mit POI bleiben sie leer: dort ist der POI die Wahrheit. Ein
  -- Programmpunkt ohne POI (etwa der Ausgangspunkt der Anreise, req-018)
  -- hat keinen, an dem etwas stehen koennte -- fuer ihn gilt, was hier
  -- steht.
  bezeichnung text,
  preis_cent integer,
  buchung text,
  -- Wie oft die Zeile zaehlt. Null heisst: sie zieht mit der Teilnehmerzahl
  -- der Reise nach. Eine eingetragene Zahl bleibt stehen, auch wenn jemand
  -- zur Reise dazukommt -- wer beim Mietauto 1 eingetragen hat, behaelt 1
  -- (req-062).
  anzahl integer,
  -- Das verknuepfte Dokument (req-034) -- Buchungsbestaetigung, Ticket. Es
  -- gehoert der Reise und bleibt, wenn die Zeile verschwindet; umgekehrt
  -- verliert die Zeile nur die Verknuepfung, wenn das Dokument entfernt
  -- wird.
  dokument_id uuid references document (id) on delete set null,
  -- Eine Zeile ist entweder die eines Programmpunkts oder eine manuelle mit
  -- Bezeichnung. Ohne beides waere sie eine Zeile ohne Gegenstand.
  constraint kostenzeile_herkunft check (
    activity_id is not null or bezeichnung is not null
  ),
  -- Wie am POI (migrations/0043_poi_kosten.sql): in Cent, nie negativ. Die
  -- Obergrenze und die Lesart der Eingabe ("12,50") pruefen lib/pois/kosten.ts
  -- und lib/kosten/validate.ts.
  constraint kostenzeile_preis_valid check (
    preis_cent is null or preis_cent >= 0
  ),
  constraint kostenzeile_anzahl_valid check (anzahl is null or anzahl >= 0),
  -- Dieselben drei Zustaende wie am POI (migrations/0044_poi_buchung.sql).
  constraint kostenzeile_buchung_valid check (
    buchung is null or buchung in ('nicht_noetig', 'offen', 'gebucht')
  )
);

-- Je Programmpunkt hoechstens eine Zeile -- zwei waeren zwei Wahrheiten zu
-- derselben Sache. Manuelle Zeilen tragen hier null und sind davon nicht
-- betroffen.
create unique index kostenzeile_activity_id_key on kostenzeile (activity_id);

create index kostenzeile_trip_id_idx on kostenzeile (trip_id);
