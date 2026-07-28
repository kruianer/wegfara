-- Buchungsstatus am Programmpunkt (req-005): der Buchungszustand wird
-- nicht automatisch ermittelt, sondern ist am Programmpunkt hinterlegt.
alter table activity add column booked boolean not null default false;
alter table activity add column booking_url text;
alter table activity add column booking_email text;
alter table activity add column booking_phone text;
-- Bestehende Zeilen explizit auf den Default setzen (nicht nur ueber
-- "default false" der Spalte), da einige Testumgebungen den Spalten-Default
-- fuer bereits vorhandene Zeilen sonst nicht zuverlaessig auswerten.
update activity set booked = false;

-- Zur Erprobung: die vier Faelle aus req-005 an vier bestehenden
-- Programmpunkten der Suditalien-Rundreise (18.07., derselbe Tag).
update activity set booked = true
  where id = '6460c010-7440-4c0a-a598-197b306cacf1'; -- Dom von Amalfi
update activity set booking_url = 'https://www.ristorantelamarinella.it'
  where id = '384d0b94-df7f-44b3-8bcf-013b41a6d265'; -- Mittagessen bei La Marinella
update activity set booking_email = 'info@lunaconvento.it'
  where id = '6d0ed984-d2dc-48a5-b298-780ceabd9f6f'; -- Check-in Hotel Luna Convento
update activity set booking_phone = '+39 089 871483'
  where id = 'deaacefe-9cc1-4835-9be5-5b23a231720c'; -- Aussichtspunkt Amalfikueste
