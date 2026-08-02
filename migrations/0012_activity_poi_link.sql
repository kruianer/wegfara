-- Verknuepfung Programmpunkt -> POI (req-011): ein POI gilt als verplant,
-- sobald ein Programmpunkt auf ihn verweist. Optional, da die meisten
-- Programmpunkte keinem gesammelten POI entstammen.
alter table activity add column poi_id uuid references poi (id);

-- Bestand fuellen: bestehende Programmpunkte, die denselben Ort wie ein
-- bereits gesammelter POI betreffen, werden verknuepft.
update activity set poi_id = '462f6811-13cc-4247-99aa-8b9693955ab7' -- Ausgrabungsstaette Pompeji
  where id = '58ccb947-6c2e-4b18-a9cc-47461e47140d'; -- Ausgrabungen von Pompeji
update activity set poi_id = 'b6652937-9196-4a63-ab17-5edfdda66642' -- Villa Rufolo
  where id = '8737ced0-85bc-4f4b-a1a6-bcbfd80b631b'; -- Gaerten der Villa Rufolo in Ravello

update activity set poi_id = '25667132-5130-4e9a-b96b-cef44ff8da53' -- Stephansdom
  where id = 'e563305e-2df4-4deb-b87d-33402c5c68f2'; -- Stephansdom
update activity set poi_id = '9faf3dd7-08fa-4c48-8390-944a987a2f9a' -- Schloss Schoenbrunn
  where id = 'd4f966f7-215e-4e2b-96a3-2414071168e2'; -- Schloss Schoenbrunn
update activity set poi_id = '7a44303e-d0e4-4b5b-a9ab-0711686f8168' -- Naschmarkt
  where id = '41d6923d-098a-406a-a1a6-8528dab0f56d'; -- Bummel ueber den Naschmarkt
update activity set poi_id = 'a59a0565-f0be-4403-9f14-3b2e151ca6fe' -- Hotel Am Stephansplatz
  where id = 'c9828394-5f47-4bf6-a715-a83a3e34d25a'; -- Check-in Hotel Am Stephansplatz

update activity set poi_id = '0b872a41-818f-48e4-bcef-6343b9ab216e' -- Langobarden-Tempietto
  where id = 'a4002abe-3dc9-4435-9c13-f5f5a1693258'; -- Langobarden-Tempietto in Cividale del Friuli
