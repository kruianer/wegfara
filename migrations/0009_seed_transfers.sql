-- Zur Erprobung von req-006: Transfers aller vier Verkehrsmittel an der
-- Suditalien-Rundreise. Der Zielpunkt eines der Transfers (Abendlicher
-- Stadtbummel in Positano) bekommt bewusst keine Position, damit sich
-- auch der Fall "keine Route-Schaltflaeche" pruefen laesst.
insert into transfer (id, trip_id, from_activity_id, to_activity_id, mode, title, duration_min, distance_km) values
  ('794bb711-2d4e-4be9-8777-61d4477bcd1c', 'd5fda5ea-65e7-4b47-8096-62618599a288', '6460c010-7440-4c0a-a598-197b306cacf1', '384d0b94-df7f-44b3-8bcf-013b41a6d265', 'fuss', 'Spaziergang zum Hafen', 8, 0.4),
  ('4879b2a4-d673-4d70-97c2-f5d0cb505f04', 'd5fda5ea-65e7-4b47-8096-62618599a288', '384d0b94-df7f-44b3-8bcf-013b41a6d265', 'deaacefe-9cc1-4835-9be5-5b23a231720c', 'auto', 'Fahrt zum Aussichtspunkt', 12, 4.2),
  ('0d1ff257-e95a-4622-8643-72524c0c6cb0', 'd5fda5ea-65e7-4b47-8096-62618599a288', 'deaacefe-9cc1-4835-9be5-5b23a231720c', '6d0ed984-d2dc-48a5-b298-780ceabd9f6f', 'bus', 'Bus zum Hotel', 10, 1.1),
  ('f7c977e1-ad68-4ed0-8a1b-83f421bd3c8b', 'd5fda5ea-65e7-4b47-8096-62618599a288', 'c754341c-0bb1-45dc-84f4-ea26fbe88eaf', '9a372af3-1719-49e1-8a00-cda91d8e1bbd', 'boot', 'Bootsfahrt zurück nach Positano', 60, 18.5)
on conflict (id) do nothing;

update activity set lat = null, lng = null
  where id = '9a372af3-1719-49e1-8a00-cda91d8e1bbd'; -- Abendlicher Stadtbummel in Positano
