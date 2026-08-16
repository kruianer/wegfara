-- Zur Erprobung von req-018: An- und Abreise als Transfer, an der
-- Süditalien-Rundreise per Flug und an der Wien-Städtereise per Bahn. Der
-- Ausgangspunkt der Anreise und das Rückreiseziel sind gewöhnliche
-- Programmpunkte vom Typ "Stadt & Dorf" am ersten bzw. letzten Reisetag.
-- Dazu kommt eine Fähre als Transfer zwischen zwei Programmpunkten, damit
-- alle drei neuen Verkehrsmittel im Bestand vorkommen.
insert into activity (id, trip_id, type, title, short_text, long_text, start_at, end_at, lat, lng) values
  -- Süditalien Rundreise: Ausgangspunkt der Anreise und Rückreiseziel
  ('ef2aebad-92fd-4990-a08f-a942d211ebf5', 'd5fda5ea-65e7-4b47-8096-62618599a288', 'stadt_dorf', 'Wien', 'Ausgangspunkt der Anreise, Abflug ab Wien-Schwechat.', 'Treffpunkt am Flughafen Wien-Schwechat. Der Weg zum Flughafen ist nicht Teil des Plans; ab hier zählt der Flug nach Neapel als erster Weg des Reisetages.', '2026-07-18 06:00', '2026-07-18 07:00', 48.2082, 16.3738),
  ('30333adc-2838-492b-b1e3-4e44e2a809c0', 'd5fda5ea-65e7-4b47-8096-62618599a288', 'stadt_dorf', 'Wien', 'Rückreiseziel, Ankunft in Wien-Schwechat.', 'Ankunft am Flughafen Wien-Schwechat. Damit endet der gemeinsame Teil der Reise; die Heimwege der Teilnehmer sind nicht Teil des Plans.', '2026-07-23 14:00', '2026-07-23 15:00', 48.2082, 16.3738),

  -- Wien Städtereise: Ausgangspunkt der Anreise und Rückreiseziel
  ('59f7db1c-f1ab-4cbe-847d-1f29125b6282', '4b5f95d6-5ad3-4049-b71c-0b90fef8e950', 'stadt_dorf', 'Salzburg', 'Ausgangspunkt der Anreise, Abfahrt am Hauptbahnhof.', 'Start am Salzburger Hauptbahnhof. Der Railjet nach Wien fährt stündlich; Sitzplatzreservierung ist am Wochenende empfehlenswert.', '2026-10-09 06:30', '2026-10-09 07:00', 47.8095, 13.0550),
  ('c0a0ef04-ad7b-437e-b38b-d3d9d05624ee', '4b5f95d6-5ad3-4049-b71c-0b90fef8e950', 'stadt_dorf', 'Salzburg', 'Rückreiseziel, Ankunft am Hauptbahnhof.', 'Ankunft am Salzburger Hauptbahnhof. Von dort ist die Altstadt in einer Viertelstunde mit dem Obus erreichbar.', '2026-10-11 15:00', '2026-10-11 15:30', 47.8095, 13.0550)
on conflict (id) do nothing;

insert into transfer (id, trip_id, from_activity_id, to_activity_id, mode, title, duration_min, distance_km) values
  -- Anreise und Abreise der Süditalien-Rundreise
  ('27f82c9d-dbb6-40bc-aeb0-33079b8a51fe', 'd5fda5ea-65e7-4b47-8096-62618599a288', 'ef2aebad-92fd-4990-a08f-a942d211ebf5', '6460c010-7440-4c0a-a598-197b306cacf1', 'flug', 'Flug Wien–Neapel', 105, 815.0),
  ('cbfe46be-dd44-4cdd-b3db-6a516d393732', 'd5fda5ea-65e7-4b47-8096-62618599a288', '9ac520c1-6d71-4ee4-a33f-4773a29dabab', '30333adc-2838-492b-b1e3-4e44e2a809c0', 'flug', 'Flug Neapel–Wien', 105, 815.0),
  -- Fähre am zweiten Reisetag, zurück zum Anleger von Capri
  ('e7edab3d-4355-4f2e-a598-720e3d0180cd', 'd5fda5ea-65e7-4b47-8096-62618599a288', '88299abd-b4c7-4459-8a47-cb1b919c41a2', 'c754341c-0bb1-45dc-84f4-ea26fbe88eaf', 'faehre', 'Fähre nach Marina Grande', 15, 1.4),
  -- Anreise und Abreise der Wien-Städtereise
  ('5a7ce065-e7c4-4572-8e2c-777118a27fc3', '4b5f95d6-5ad3-4049-b71c-0b90fef8e950', '59f7db1c-f1ab-4cbe-847d-1f29125b6282', 'e563305e-2df4-4deb-b87d-33402c5c68f2', 'bahn', 'Railjet Salzburg–Wien', 155, 295.0),
  ('bf23a2b2-8bf2-4d2b-ab92-9f2484dc63aa', '4b5f95d6-5ad3-4049-b71c-0b90fef8e950', '321ee773-d0f0-472d-b5ec-0f54d45ba457', 'c0a0ef04-ad7b-437e-b38b-d3d9d05624ee', 'bahn', 'Railjet Wien–Salzburg', 155, 295.0)
on conflict (id) do nothing;
