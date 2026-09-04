-- POIs von Hand anlegen, aendern und loeschen (req-035).
--
-- Angelegt und geaendert wird ueber die Anwendung; das Schema braucht dafuer
-- nur zwei Ergaenzungen, damit eine Korrektur den naechsten Google-Import
-- ueberlebt (req-035, "Aenderung gegenueber heute").

-- Welche Angaben eines POI von Hand geaendert wurden: kommagetrennte
-- Feldnamen, leer heisst "nichts von Hand geaendert". Der Import aus einem
-- Google-Maps-Link (req-026) frischt nur Felder auf, die hier NICHT stehen --
-- ohne diese Spalte waere jede Korrektur beim naechsten Import wieder weg.
-- Die Liste der moeglichen Namen steht in lib/pois/manual-fields.ts.
alter table poi add column manual_fields text not null default '';

-- Woher ein Foto stammt. Beim Auffrischen aus Google werden die Fotos aus
-- Google ersetzt; von Hand hinzugefuegte bleiben erhalten (req-035).
alter table poi_photo add column source text not null default 'google';
alter table poi_photo add constraint poi_photo_source_valid
  check (source in ('google', 'manuell'));
