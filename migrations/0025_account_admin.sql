-- Account-Admin (req-027): wer im Account Personen anlegen, aendern und
-- entfernen darf.
--
-- Die Kennzeichnung gilt fuer einen Account und ist etwas anderes als die
-- Rolle Reiseleiter (trip_participant.role, req-021), die je Reise gilt,
-- und als der Gesamt-Admin (participant.is_super_admin, req-025), der
-- accountuebergreifend arbeitet.

alter table participant
  add column is_account_admin boolean not null default false;

-- Ein Account hat immer mindestens einen Account-Admin (req-027). Fuer die
-- bestehenden Accounts erhaelt ihn die erste Person -- dieselbe, die auch
-- die Account-Verwaltung als erste fuehrt (siehe lib/db/accounts.ts). Alle
-- uebrigen bleiben ohne Kennzeichnung und behalten damit Lesezugang zur
-- Personenliste.
update participant
set is_account_admin = true
where id in (
  select distinct on (account_id) id
  from participant
  order by account_id, created_at asc, name asc
);
