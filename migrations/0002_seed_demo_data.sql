-- Vorerst genau ein Account (Uwe Kremmel) und drei Reisen zur Erprobung
-- von req-001 (siehe delivery/requirements/done/req-001-...).
insert into account (id, name, email) values
  ('eb873b95-257b-49c6-b08f-1709d6ad3b94', 'Uwe Kremmel', 'uwe@kremmel.org')
on conflict (id) do nothing;

insert into trip (id, account_id, title, start_date, end_date, main_place_name, main_place_lat, main_place_lng) values
  ('d5fda5ea-65e7-4b47-8096-62618599a288', 'eb873b95-257b-49c6-b08f-1709d6ad3b94', 'Süditalien Rundreise', '2026-07-18', '2026-07-23', 'Amalfi', 40.6340, 14.6027),
  ('4b5f95d6-5ad3-4049-b71c-0b90fef8e950', 'eb873b95-257b-49c6-b08f-1709d6ad3b94', 'Wien Städtereise', '2026-10-09', '2026-10-11', 'Wien', 48.2082, 16.3738),
  ('72d68515-6bb1-4723-95d9-2a04fb65e5ca', 'eb873b95-257b-49c6-b08f-1709d6ad3b94', 'Alpen-Adria-Radtour', '2026-05-25', '2026-05-31', 'Villach', 46.6103, 13.8558)
on conflict (id) do nothing;
