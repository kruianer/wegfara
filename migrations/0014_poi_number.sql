-- Nummer je POI (siehe req-013): fortlaufend innerhalb der Reise, beginnend
-- bei 1, dauerhaft vergeben und nach Entfernen eines POI nicht neu
-- ausgegeben (dadurch entsteht eine Luecke statt einer Verschiebung).
-- Bestehende Demo-POIs werden in der Anlage-Reihenfolge aus
-- migrations/0011_seed_pois.sql nummeriert.
alter table poi add column number integer;

-- Suditalien Rundreise
update poi set number = 1 where id = '8239130e-73ab-4d3f-a52a-0829a65ef7e3';
update poi set number = 2 where id = '462f6811-13cc-4247-99aa-8b9693955ab7';
update poi set number = 3 where id = 'f5901c9b-e7a3-4c19-b636-3a86e16c3d91';
update poi set number = 4 where id = 'ddf861cc-d73a-40f3-8fc6-1996b2aa8e62';
update poi set number = 5 where id = 'b6652937-9196-4a63-ab17-5edfdda66642';
update poi set number = 6 where id = 'bef01b0c-5c57-47a8-9e61-7dcedf5adf1d';
update poi set number = 7 where id = '4137c2d0-0bc9-41bb-998a-2cf9eaac4edf';
update poi set number = 8 where id = '264b8e02-6db1-40b5-9d33-c162d995becb';
update poi set number = 9 where id = 'a8fdda3c-af88-48f8-a41a-041d0f7775c5';
update poi set number = 10 where id = 'faa7f937-7f96-4162-ba25-64875d0bde27';
update poi set number = 11 where id = '574fdc61-18fd-40b4-8ebc-68b99acef511';
update poi set number = 12 where id = '097a64c2-0a50-4401-a976-a42d94d88815';

-- Wien Staedtereise
update poi set number = 1 where id = '25667132-5130-4e9a-b96b-cef44ff8da53';
update poi set number = 2 where id = '9faf3dd7-08fa-4c48-8390-944a987a2f9a';
update poi set number = 3 where id = '7a44303e-d0e4-4b5b-a9ab-0711686f8168';
update poi set number = 4 where id = 'a59a0565-f0be-4403-9f14-3b2e151ca6fe';

-- Alpen-Adria-Radtour
update poi set number = 1 where id = '71df42c9-aefe-4749-8bff-804e054e2666';
update poi set number = 2 where id = '99849e53-22cd-4d6c-85b5-e1ed737583d9';
update poi set number = 3 where id = '0b872a41-818f-48e4-bcef-6343b9ab216e';
update poi set number = 4 where id = '147b0c81-9e5e-403d-9103-d28548d4efb4';

alter table poi alter column number set not null;
alter table poi add constraint poi_trip_id_number_key unique (trip_id, number);
