-- Zugangsschluessel je Account (req-028): die KI-Suche (req-014) und der
-- Import aus einem Google-Maps-Link (req-026) kosten Geld. Jeder Account
-- hinterlegt seinen eigenen Schluessel und traegt damit seine eigenen
-- Kosten; ohne hinterlegten Schluessel ist die zugehoerige Funktion
-- gesperrt. Auf den Schluessel eines anderen Accounts wird nie
-- zurueckgegriffen.
--
-- Der Schluessel steht hier NICHT im Klartext: gespeichert wird sein mit
-- AES-256-GCM verschluesselter Wert (siehe lib/secrets/encryption.ts). Der
-- zum Entschluesseln noetige Wert stammt aus den Umgebungsvariablen der
-- Umgebung und nicht aus der Datenbank -- ein Backup allein laesst sich
-- damit nicht auswerten (req-028, Constraints).
--
-- Anders als bei den Geheimnissen der Anmeldung (session, login_link,
-- access_link, recovery_code) reicht eine Pruefsumme hier nicht: der
-- Schluessel wird zum Anfragen bei OpenAI und Google im Klartext gebraucht.
-- Deshalb verschluesselt statt gehasht.
--
-- last_four ist die einzige Angabe, die je wieder ausgegeben wird: die
-- letzten vier Zeichen zur Unterscheidung zweier Schluessel. Sie stehen
-- bewusst unverschluesselt daneben, damit die Karte "Zugangsschluessel" den
-- Zustand zeigen kann, ohne den Schluessel selbst anzufassen.
create table account_api_key (
  account_id uuid not null references account (id) on delete cascade,
  kind text not null,
  ciphertext text not null,
  last_four text not null,
  updated_at timestamptz not null,
  primary key (account_id, kind)
);

-- Genau zwei Arten, mehr sind nicht Teil von req-028: 'ki_suche' fuer die
-- POI-Suche per KI, 'google' fuer den Import aus einem Google-Maps-Link.
alter table account_api_key add constraint account_api_key_kind_valid
  check (kind in ('ki_suche', 'google'));
