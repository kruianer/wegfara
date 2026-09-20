-- KI-Bilder zu einem POI (req-072).
--
-- Ein erzeugtes Bild ist ein Foto wie jedes andere: dieselbe Ablage, dieselbe
-- Tabelle, dieselben Regeln (req-026). Der einzige Unterschied ist seine
-- Herkunft -- an ihr und nur an ihr haengt das Symbol, das es als KI-Bild
-- kennzeichnet. Deshalb bekommt `poi_photo.source` einen dritten Wert und
-- nicht der Dateiname eine Kennzeichnung, aus der sich etwas vermuten liesse
-- (req-072, Constraints).
alter table poi_photo drop constraint poi_photo_source_valid;
alter table poi_photo add constraint poi_photo_source_valid
  check (source in ('google', 'manuell', 'ki'));
