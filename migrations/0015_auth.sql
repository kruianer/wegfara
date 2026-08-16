-- Anmeldung (req-016): Konten, Passkeys, Anmeldelinks, Notfallcodes und
-- Sitzungen. Ohne angemeldete Person ist ausserhalb der Startseite kein
-- Zugriff moeglich (siehe delivery/security.md).

-- Teilnehmer: eine Person innerhalb eines Accounts (siehe Glossar in
-- delivery/stack.md). Der Account bleibt der Mandant; das Konto, mit dem
-- sich jemand anmeldet, ist der Teilnehmer.
-- Die E-Mail-Adresse ist installationsweit eindeutig, weil die Anmeldung
-- eine Adresse aufloesen muss, bevor der Mandant bekannt ist. Jede Abfrage
-- auf Reisedaten filtert danach weiterhin nach account_id.
create table participant (
  id uuid primary key,
  account_id uuid not null references account (id),
  name text not null,
  email text not null unique,
  created_at timestamptz not null
);

create index participant_account_id_idx on participant (account_id);

-- Passkey (WebAuthn). Ein Konto kann mehrere haben, fuer mehrere Geraete.
-- Gespeichert wird ausschliesslich der oeffentliche Schluessel.
create table credential (
  id text primary key,
  participant_id uuid not null references participant (id) on delete cascade,
  public_key text not null,
  counter bigint not null,
  transports text not null,
  label text not null,
  created_at timestamptz not null,
  last_used_at timestamptz
);

create index credential_participant_id_idx on credential (participant_id);

-- Anmeldelink (Magic Link): 15 Minuten gueltig, genau einmal verwendbar.
-- Entwertet wird serverseitig ueber used_at, nicht in der Anzeige.
-- Gespeichert wird nur die Pruefsumme des Tokens.
create table login_link (
  id uuid primary key,
  participant_id uuid not null references participant (id) on delete cascade,
  token_hash text not null unique,
  created_at timestamptz not null,
  expires_at timestamptz not null,
  used_at timestamptz
);

create index login_link_participant_id_idx on login_link (participant_id);

-- Notfallcode: ersetzt einmal die Anmeldung und ist danach verbraucht.
-- Ausschliesslich als Pruefsumme gespeichert -- wer die Datenbank liest,
-- kann sich damit nicht anmelden.
create table recovery_code (
  id uuid primary key,
  participant_id uuid not null references participant (id) on delete cascade,
  code_hash text not null unique,
  created_at timestamptz not null,
  used_at timestamptz
);

create index recovery_code_participant_id_idx on recovery_code (participant_id);

-- Sitzung: liegt in einem persistenten Cookie und uebersteht damit das
-- Schliessen der App und einen Neustart des Geraets. Gespeichert wird nur
-- die Pruefsumme des Sitzungs-Tokens.
create table session (
  id uuid primary key,
  participant_id uuid not null references participant (id) on delete cascade,
  token_hash text not null unique,
  created_at timestamptz not null,
  expires_at timestamptz not null
);

create index session_participant_id_idx on session (participant_id);

-- Die bestehenden Reisen gehoeren dem vorhandenen Konto (siehe req-016).
insert into participant (id, account_id, name, email, created_at)
values (
  '5e0cd230-3765-425b-be49-6a95028ba0b8',
  'eb873b95-257b-49c6-b08f-1709d6ad3b94',
  'Uwe Kremmel',
  'uwe@kremmel.org',
  timestamptz '2026-08-16 00:00:00+00'
);
