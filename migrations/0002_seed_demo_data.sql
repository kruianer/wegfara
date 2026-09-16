-- Vorerst genau ein Account (Uwe Kremmel). Er ist kein Demo-Datum, sondern
-- der Zugang zur App: an ihm haengt der Betreiber aus
-- migrations/0015_auth.sql, und ohne ihn ist eine frische Umgebung nicht
-- benutzbar. Er bleibt deshalb auch nach req-064 hier stehen.
insert into account (id, name, email) values
  ('eb873b95-257b-49c6-b08f-1709d6ad3b94', 'Uwe Kremmel', 'uwe@kremmel.org')
on conflict (id) do nothing;

-- Die drei Reisen zur Erprobung von req-001 sind mit req-064 gestrichen:
-- Migrationen legen keine Reisedaten mehr an, damit eine frische Umgebung
-- leer ist. Verloren sind die Daten nicht -- sie stehen in
-- seed/demo-daten.sql und werden nur noch ausdruecklich eingespielt
-- (`npm run seed:demo` fuer eine frische dev-Umgebung, tests/test-db.ts
-- fuer die Testsuite).
--
-- Die Datei bleibt mit ihrer Nummer stehen: bereits eingespielte Umgebungen
-- fuehren sie deshalb nicht erneut aus, und ihre Reisen bleiben unberuehrt
-- (siehe delivery/devops.md).
