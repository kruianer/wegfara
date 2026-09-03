-- Accounts verwalten (req-025): der Gesamt-Admin, der Wechsel in einen
-- fremden Account und das Protokoll darueber.
--
-- Der accountuebergreifende Zugriff ist eine bewusste Ausnahme von der
-- Mandantentrennung (siehe delivery/security.md). Er wechselt dabei den
-- Kontext -- der Account, in dem gearbeitet wird, steht in der Sitzung, nie
-- in der Anfrage. Mehrere Accounts gleichzeitig sieht er nie.

-- Genau eine Person traegt die Kennzeichnung. Vergeben und entzogen wird
-- sie ausschliesslich hier, direkt in der Datenbank: die Anwendung liest
-- die Spalte, schreibt sie aber an keiner Stelle (req-025, Constraints).
alter table participant
  add column is_super_admin boolean not null default false;

-- "Genau eine Person" ist keine Absichtserklaerung, sondern eine Bedingung
-- des Schemas: ein zweiter Gesamt-Admin laesst sich gar nicht erst
-- eintragen.
create unique index participant_single_super_admin
  on participant (is_super_admin)
  where is_super_admin;

-- Der Betreiber ist der Gesamt-Admin (siehe migrations/0015_auth.sql).
update participant
set is_super_admin = true
where id = '5e0cd230-3765-425b-be49-6a95028ba0b8';

-- In welchem Account gerade gearbeitet wird. Leer heisst: im eigenen. Der
-- Wert haengt an der Sitzung und nicht am Teilnehmer, damit die Rueckkehr
-- in den eigenen Account nichts weiter ist als das Leeren dieser Spalte --
-- und damit ein Abmelden den Wechsel in jedem Fall beendet.
alter table session
  add column acting_account_id uuid references account (id);

-- Nachvollziehbarkeit (req-025): wer, in welchen Account, wann. Das
-- Protokoll wird nur geschrieben, nie in der Oberflaeche gezeigt -- die
-- Ansicht ist ausdruecklich nicht Teil des Requirements.
create table account_switch (
  id uuid primary key,
  participant_id uuid not null references participant (id) on delete cascade,
  account_id uuid not null references account (id),
  switched_at timestamptz not null
);

create index account_switch_participant_id_idx
  on account_switch (participant_id);
