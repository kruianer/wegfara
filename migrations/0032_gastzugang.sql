-- Weitere Nutzer und Gaeste (req-038): der befristete Gastzugang zu genau
-- einer Reise, nur lesend.
--
-- Er ist bewusst etwas anderes als die Einladung aus req-023 (access_link)
-- und wird nicht mit ihr zusammengelegt: die beiden haben verschiedene
-- Lebensdauern, verschiedene Rechte und verschiedene Widerrufsregeln. Eine
-- Einladung holt eine Person dauerhaft in die App und ist danach verbraucht;
-- ein Gastzugang laesst jemanden bis zu 90 Tage lang zuschauen und ist
-- jederzeit widerrufbar.
--
-- Wie jede Tabelle mit Nutzerdaten traegt sie eine Account-Zuordnung und
-- wird immer danach gefiltert (siehe delivery/stack.md, Mandantenfaehigkeit).
-- Sie liegt hier redundant neben der Reise, damit jede Abfrage ohne Umweg
-- ueber trip nach dem Mandanten filtern kann.
--
-- Gespeichert wird ausschliesslich die Pruefsumme des Tokens -- wer die
-- Datenbank liest, kommt damit nicht herein.
create table guest_access (
  id uuid primary key,
  account_id uuid not null references account (id) on delete cascade,
  trip_id uuid not null references trip (id) on delete cascade,
  created_by uuid references participant (id) on delete set null,
  purpose text not null,
  token_hash text not null unique,
  created_at timestamptz not null,
  expires_at timestamptz not null,
  last_used_at timestamptz,
  revoked_at timestamptz
);

create index guest_access_account_id_idx on guest_access (account_id);
create index guest_access_trip_id_idx on guest_access (trip_id);

-- `created_by` loest sich mit "on delete set null", wenn der Reiseleiter aus
-- dem Account entfernt wird: der Gastzugang gehoert der Reise, nicht ihm --
-- er bleibt bestehen und bleibt widerrufbar (wie document.uploaded_by,
-- req-034).

-- Die Gast-Sitzung liegt in einer eigenen Tabelle und nicht in `session`.
-- Damit kann sie nirgends als Teilnehmer-Sitzung durchgehen (req-038,
-- Constraints): jede vorhandene Abfrage auf `session` fuehrt ueber
-- participant_id zu einer Person -- eine Gast-Sitzung hat keine, und ein
-- Gast bekommt deshalb an jeder bestehenden Schnittstelle eine Abweisung,
-- ohne dass eine einzelne davon daran denken muesste.
--
-- Sie haengt mit "on delete cascade" am Gastzugang und traegt zusaetzlich
-- dessen Ablauf: sie endet nie spaeter als er, und ein Widerruf entwertet
-- sie sofort (siehe lib/db/guest-access.ts).
create table guest_session (
  id uuid primary key,
  guest_access_id uuid not null references guest_access (id) on delete cascade,
  token_hash text not null unique,
  created_at timestamptz not null,
  expires_at timestamptz not null
);

create index guest_session_guest_access_id_idx
  on guest_session (guest_access_id);
