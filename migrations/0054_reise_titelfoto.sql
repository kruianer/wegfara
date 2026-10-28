-- Das Titelfoto des gedruckten Reiseplans (req-103).
--
-- Es ist eine Angabe ueber die Reise und steht deshalb an ihr, nicht am POI.
-- Je Reise gibt es hoechstens eines; fehlt die Zeile, nimmt der Plan wie
-- bisher das erste Foto der ersten Station (req-080) -- gewaehlt werden muss
-- nichts.
--
-- Zwei Arten, genau eine je Zeile:
-- - ein Foto eines POI der Reise (`poi_photo_id`). Wird es oder sein POI
--   entfernt, verschwindet die Zeile mit, und der Plan faellt auf die Vorgabe
--   zurueck -- ein Titelfoto, das ins Leere zeigt, gibt es nicht.
-- - ein eigenes Bild (`file_name`), hochgeladen oder von der KI erzeugt. Die
--   Datei liegt in der Bildablage wie die der POI-Fotos (IMAGE_DIR), hier nur
--   ihr Datensatz (stack.md: kein Bild ohne Datensatz).
create table trip_titelfoto (
  trip_id uuid primary key references trip (id) on delete cascade,
  poi_photo_id uuid references poi_photo (id) on delete cascade,
  file_name text,
  -- 'poi' fuer ein gewaehltes Foto der Reise, sonst die Herkunft des eigenen
  -- Bildes: 'manuell' hochgeladen, 'ki' erzeugt (req-072). An ihr haengt das
  -- Zeichen des KI-Bildes, geraten wird es nie aus dem Dateinamen.
  source text not null,
  created_at timestamptz not null,
  constraint trip_titelfoto_source_valid check (
    source in ('poi', 'manuell', 'ki')
  ),
  constraint trip_titelfoto_genau_eines check (
    (source = 'poi' and poi_photo_id is not null and file_name is null)
    or (source <> 'poi' and poi_photo_id is null and file_name is not null)
  )
);
