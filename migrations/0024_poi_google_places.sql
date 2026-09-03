-- POI aus einem Google-Maps-Link (req-026): die zusaetzlichen Angaben am
-- POI und die Ablage seiner Fotos.
--
-- Alle neuen Spalten sind freiwillig -- von Hand oder per KI-Suche
-- angelegte POIs tragen sie nicht (req-026, "Neue Angaben am POI").

alter table poi add column address text;
alter table poi add column phone text;
-- Die Oeffnungszeiten als Text, eine Zeile je Wochentag. Google liefert
-- sie fertig formuliert; wegfara zeigt sie nur an und rechnet nicht damit
-- (ein Hinweis auf Programmpunkte ausserhalb der Oeffnungszeiten ist
-- ausdruecklich nicht Teil von req-026).
alter table poi add column opening_hours text;
-- Die Kennung des Ortes bei Google. Sie entscheidet, ob derselbe Ort schon
-- als POI der Reise vorhanden ist -- dann wird aufgefrischt statt ein
-- zweiter angelegt.
alter table poi add column google_place_id text;

-- Derselbe Ort hoechstens einmal je Reise. Von Hand angelegte POIs haben
-- keine Kennung und sind von der Bedingung nicht betroffen.
create unique index poi_trip_google_place_id_key
  on poi (trip_id, google_place_id)
  where google_place_id is not null;

-- Fotos eines POI. Nach der Regel aus delivery/stack.md liegt die Datei im
-- Bildverzeichnis (IMAGE_DIR) und zu jeder Datei existiert genau dieser
-- Datensatz -- die Datenbank ist die Wahrheitsquelle, das Dateisystem nur
-- der Ablageort. `position` haelt die Reihenfolge; das Foto an Position 1
-- ist das, welches in der POI-Zeile die farbige Flaeche ersetzt.
create table poi_photo (
  id uuid primary key,
  poi_id uuid not null references poi (id) on delete cascade,
  position integer not null,
  file_name text not null,
  created_at timestamptz not null
);

create index poi_photo_poi_id_idx on poi_photo (poi_id);
create unique index poi_photo_poi_id_position_key on poi_photo (poi_id, position);
