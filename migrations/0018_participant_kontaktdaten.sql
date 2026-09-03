-- Teilnehmer verwalten (req-019): Personen des Accounts bekommen eine
-- Telefonnummer fuer unterwegs und eine Bankverbindung fuer die spaetere
-- Abrechnung. Beides ist freiwillig.
alter table participant add column phone text;
alter table participant add column iban text;

-- Erfasste Personen erhalten keinen Zugang zur Anwendung (req-019). Zugang
-- hat nur, wer ihn ausdruecklich traegt -- bisher allein der Betreiber,
-- dessen Konto mit migrations/0015_auth.sql entstanden ist.
alter table participant add column login_enabled boolean not null default false;
update participant set login_enabled = true;

-- Die E-Mail-Adresse ist ab jetzt freiwillig. Ihre Eindeutigkeit bleibt,
-- gilt aber nur fuer hinterlegte Adressen: mehrere Personen ohne Adresse
-- sind zulaessig, dieselbe Adresse zweimal nicht.
alter table participant alter column email drop not null;
alter table participant drop constraint participant_email_key;
create unique index participant_email_key
  on participant (email)
  where email is not null;

-- Wer sich anmelden darf, braucht eine Adresse -- der Anmeldelink geht an
-- sie (siehe delivery/security.md).
alter table participant add constraint participant_login_needs_email
  check (login_enabled = false or email is not null);
