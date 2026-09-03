-- Teilnehmer einladen (req-023): der Zugangslink, mit dem der Reiseleiter
-- eine bereits erfasste Person in die App holt. Er ist an genau diese Person
-- gebunden -- wer ihn einloest, wird zu ihr; es entsteht kein neuer, eigener
-- Zugang. Einen frei einloesbaren Gruppenlink gibt es bewusst nicht (siehe
-- delivery/security.md, Beitritt ausschliesslich per Einladung).
--
-- Sieben Tage gueltig und genau einmal verwendbar. Entwertet wird
-- serverseitig ueber used_at, nicht in der Anzeige -- der Link laeuft ueber
-- unsichere Kanaele (Messenger, SMS, abgescannter QR-Code) und muss nach der
-- Nutzung wertlos sein. Gespeichert wird ausschliesslich die Pruefsumme des
-- Tokens; wer die Datenbank liest, kann sich damit nicht anmelden.
create table access_link (
  id uuid primary key,
  participant_id uuid not null references participant (id) on delete cascade,
  token_hash text not null unique,
  created_at timestamptz not null,
  expires_at timestamptz not null,
  used_at timestamptz
);

create index access_link_participant_id_idx on access_link (participant_id);

-- Zugang ohne hinterlegte E-Mail-Adresse ist ab jetzt zulaessig: eine Person
-- kommt per Einladung herein, nicht per Anmeldelink (req-023). Die Adresse
-- bleibt fuer den Weg "Anmeldelink ans Postfach" noetig -- ist keine
-- hinterlegt, steht dieser Weg schlicht nicht zur Verfuegung. Die Bedingung
-- aus migrations/0018_participant_kontaktdaten.sql wuerde genau das
-- verhindern und faellt deshalb weg.
alter table participant drop constraint participant_login_needs_email;
