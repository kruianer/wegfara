-- POIs zur Erprobung von req-010. Die zwoelf POIs der Suditalien
-- Rundreise entsprechen 1:1 den Demo-Daten aus
-- delivery/design/planer/Reiseplaner v4.dc.html (State.pois). Die
-- anderen beiden Reisen bekommen eine kleinere Auswahl, damit "Zu jeder
-- der drei Reisen liegen POIs im Bestand" (Funktion) erfuellt ist.
insert into poi (id, trip_id, name, ort, type, lat, lng, status, web) values
  -- Suditalien Rundreise
  ('8239130e-73ab-4d3f-a52a-0829a65ef7e3', 'd5fda5ea-65e7-4b47-8096-62618599a288', 'Altstadt & Spaccanapoli', 'Neapel', 'stadt_dorf', 40.8518, 14.2681, 'gesetzt', 'https://www.visitnaples.eu'),
  ('462f6811-13cc-4247-99aa-8b9693955ab7', 'd5fda5ea-65e7-4b47-8096-62618599a288', 'Ausgrabungsstätte Pompeji', 'Pompei', 'sehenswuerdigkeit', 40.7489, 14.4989, 'gesetzt', 'https://pompeiisites.org'),
  ('f5901c9b-e7a3-4c19-b636-3a86e16c3d91', 'd5fda5ea-65e7-4b47-8096-62618599a288', 'Trattoria da Nennella', 'Neapel', 'restaurant', 40.8467, 14.2497, 'wahrscheinlich', null),
  ('ddf861cc-d73a-40f3-8fc6-1996b2aa8e62', 'd5fda5ea-65e7-4b47-8096-62618599a288', 'Positano & Amalfiküste', 'Positano', 'stadt_dorf', 40.6280, 14.4850, 'wahrscheinlich', null),
  ('b6652937-9196-4a63-ab17-5edfdda66642', 'd5fda5ea-65e7-4b47-8096-62618599a288', 'Villa Rufolo', 'Ravello', 'sehenswuerdigkeit', 40.6490, 14.6120, 'weiss_nicht', 'https://www.villarufolo.com'),
  ('bef01b0c-5c57-47a8-9e61-7dcedf5adf1d', 'd5fda5ea-65e7-4b47-8096-62618599a288', 'Griechische Tempel', 'Paestum', 'sehenswuerdigkeit', 40.4203, 15.0055, 'wenn_zeit', 'https://museopaestum.cultura.gov.it'),
  ('4137c2d0-0bc9-41bb-998a-2cf9eaac4edf', 'd5fda5ea-65e7-4b47-8096-62618599a288', 'Sassi di Matera', 'Matera', 'sehenswuerdigkeit', 40.6664, 16.6104, 'gesetzt', 'https://www.materaturismo.it'),
  ('264b8e02-6db1-40b5-9d33-c162d995becb', 'd5fda5ea-65e7-4b47-8096-62618599a288', 'Trulli-Viertel Rione Monti', 'Alberobello', 'sehenswuerdigkeit', 40.7847, 17.2376, 'wahrscheinlich', null),
  ('a8fdda3c-af88-48f8-a41a-041d0f7775c5', 'd5fda5ea-65e7-4b47-8096-62618599a288', 'Lama Monachile', 'Polignano a Mare', 'strand', 40.9964, 17.2205, 'wahrscheinlich', null),
  ('faa7f937-7f96-4162-ba25-64875d0bde27', 'd5fda5ea-65e7-4b47-8096-62618599a288', 'Grotte di Castellana', 'Castellana Grotte', 'aktivitaet', 40.8697, 17.1631, 'weiss_nicht', 'https://www.grottedicastellana.it'),
  ('574fdc61-18fd-40b4-8ebc-68b99acef511', 'd5fda5ea-65e7-4b47-8096-62618599a288', 'Weiße Altstadt', 'Ostuni', 'stadt_dorf', 40.7290, 17.5786, 'wenn_zeit', null),
  ('097a64c2-0a50-4401-a976-a42d94d88815', 'd5fda5ea-65e7-4b47-8096-62618599a288', 'Barock-Altstadt', 'Lecce', 'stadt_dorf', 40.3529, 18.1743, 'auf_keinen_fall', null),

  -- Wien Staedtereise
  ('25667132-5130-4e9a-b96b-cef44ff8da53', '4b5f95d6-5ad3-4049-b71c-0b90fef8e950', 'Stephansdom', 'Wien', 'sehenswuerdigkeit', 48.2085, 16.3731, 'gesetzt', null),
  ('9faf3dd7-08fa-4c48-8390-944a987a2f9a', '4b5f95d6-5ad3-4049-b71c-0b90fef8e950', 'Schloss Schönbrunn', 'Wien', 'weltkulturerbe', 48.1858, 16.3122, 'gesetzt', 'https://www.schoenbrunn.at'),
  ('7a44303e-d0e4-4b5b-a9ab-0711686f8168', '4b5f95d6-5ad3-4049-b71c-0b90fef8e950', 'Naschmarkt', 'Wien', 'aktivitaet', 48.1974, 16.3651, 'wahrscheinlich', null),
  ('a59a0565-f0be-4403-9f14-3b2e151ca6fe', '4b5f95d6-5ad3-4049-b71c-0b90fef8e950', 'Hotel Am Stephansplatz', 'Wien', 'hotel', 48.2081, 16.3733, 'gesetzt', null),

  -- Alpen-Adria-Radtour
  ('71df42c9-aefe-4749-8bff-804e054e2666', '72d68515-6bb1-4723-95d9-2a04fb65e5ca', 'Faaker See', 'Faak am See', 'strand', 46.5675, 13.9214, 'wahrscheinlich', null),
  ('99849e53-22cd-4d6c-85b5-e1ed737583d9', '72d68515-6bb1-4723-95d9-2a04fb65e5ca', 'Altstadt Villach', 'Villach', 'stadt_dorf', 46.6103, 13.8558, 'gesetzt', null),
  ('0b872a41-818f-48e4-bcef-6343b9ab216e', '72d68515-6bb1-4723-95d9-2a04fb65e5ca', 'Langobarden-Tempietto', 'Cividale del Friuli', 'weltkulturerbe', 46.0937, 13.4267, 'wenn_zeit', null),
  ('147b0c81-9e5e-403d-9103-d28548d4efb4', '72d68515-6bb1-4723-95d9-2a04fb65e5ca', 'Lagune von Grado', 'Grado', 'strand', 45.6822, 13.3861, 'weiss_nicht', null)
on conflict (id) do nothing;
