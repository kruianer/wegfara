-- req-059: Das Fahrrad kommt als achtes Verkehrsmittel hinzu. OSRM rechnet
-- dafuer ein eigenes Profil, damit die vorgeschlagene Fahrzeit zum
-- Verkehrsmittel passt. Am Datenmodell aendert sich sonst nichts.
--
-- Zum Umgang mit den beiden moeglichen Check-Namen siehe
-- migrations/0016_transfer_modes_und_stadt_dorf.sql.
alter table transfer drop constraint if exists transfer_mode_check;
alter table transfer drop constraint if exists transfer_constraint_1;
alter table transfer add constraint transfer_mode_check check (
  mode in ('fuss', 'rad', 'auto', 'bus', 'boot', 'flug', 'bahn', 'faehre')
);
