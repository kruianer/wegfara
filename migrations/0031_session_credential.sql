-- Anmeldung nach Standard (req-037): mit welchem Passkey eine Sitzung
-- entstanden ist.
--
-- Wer sein verlorenes iPad unter "Meine Geraete" entfernt, erwartet, dass es
-- damit draussen ist. Ohne diese Spalte bliebe nur der Passkey geloescht und
-- der Finder koennte die laufende Sitzung weiterbenutzen -- ausgerechnet in
-- dem Moment, in dem der Nutzer glaubt, gehandelt zu haben. Mit
-- "on delete cascade" endet die Sitzung zusammen mit ihrem Passkey.
--
-- Sitzungen aus Anmeldelink, Notfallcode oder Einladung tragen hier dauerhaft
-- null und bleiben von einer Passkey-Entfernung unberuehrt. Bestehende
-- Sitzungen bekommen ebenfalls null und bleiben gueltig -- niemand muss sich
-- neu einrichten.
alter table session
  add column credential_id text references credential (id) on delete cascade;

create index session_credential_id_idx on session (credential_id);
