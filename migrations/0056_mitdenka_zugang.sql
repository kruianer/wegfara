-- Der Zugang fuer mitdenka (req-104): ein Schluessel je Account, mit dem
-- mitdenka die Lese-Schnittstelle /api/werkzeuge abfragt.
--
-- Gespeichert wird nur seine Pruefsumme (lib/auth/tokens.ts) -- wie bei den
-- Einladungen, nicht verschluesselt wie die Zugangsschluessel (req-028): die
-- App muss ihn pruefen, nicht zurueckgeben. Der Klartext steht genau einmal
-- in der Oberflaeche und danach nirgends mehr.
--
-- Hoechstens einer je Account (Primaerschluessel account_id): ein neuer
-- ersetzt die Zeile, der alte ist damit sofort ungueltig. Widerrufen loescht
-- sie. last_used_at steht in der Karte -- eine Benutzung, von der man nichts
-- weiss, ist der einzige Hinweis auf einen Missbrauch.
create table mitdenka_zugang (
  account_id uuid primary key references account (id) on delete cascade,
  token_hash text not null unique,
  created_at timestamptz not null,
  last_used_at timestamptz
);

-- Die Abfragen bei Google, die ueber diese Schnittstelle liefen -- je Account
-- und Tag (req-104). Sie kosten Geld und fallen von aussen nicht auf; ist die
-- Grenze erreicht, geht keine weitere hinaus. Gezaehlt wird nur, was ueber
-- /api/werkzeuge kam, nicht die Suche im Planer. Der Tag ist der Kalendertag
-- in Europe/Berlin.
create table werkzeug_google_abfrage (
  account_id uuid not null references account (id) on delete cascade,
  tag date not null,
  anzahl integer not null,
  primary key (account_id, tag),
  constraint werkzeug_google_abfrage_anzahl_gueltig check (anzahl >= 0)
);
