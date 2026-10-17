-- Der Verlauf des Chatfensters im Planer (req-081): eigene Nachrichten und
-- die Antworten der KI, in zeitlicher Folge.
--
-- Er gehoert der Reise und ueberdauert damit das Neuladen der Seite; ein
-- Reisewechsel zeigt die Unterhaltung der dann geoeffneten Reise. Je Reise
-- gibt es genau eine Unterhaltung -- mehrere nebeneinander sind
-- ausdruecklich nicht Teil von req-081.
--
-- Die Mandantentrennung laeuft ueber die Reise, wie bei poi, activity,
-- document und kostenzeile: eine Zeile haengt an einer Reise, die Reise am
-- Account. Wer eine Reise nicht sieht, sieht ihre Unterhaltung nicht
-- (req-023, security.md).
create table chat_nachricht (
  id uuid primary key,
  -- Mit der Reise verschwindet ihre Unterhaltung: sie handelt von ihr und
  -- hat ohne sie keinen Gegenstand.
  trip_id uuid not null references trip (id) on delete cascade,
  -- Von wem die Nachricht kommt: 'ich' ist die geschriebene Frage, 'ki' die
  -- Antwort darauf.
  rolle text not null,
  text text not null,
  -- Welches Modell geantwortet hat (req-081): Welche Antwort von welchem
  -- Modell kam, soll im Verlauf ablesbar sein. Die Kennung steht hier als
  -- Text und nicht als Pruefliste -- Modelle werden abgeloest, und eine
  -- alte Antwort soll ihre Herkunft behalten, auch wenn ihr Modell nicht
  -- mehr angeboten wird.
  modell text,
  -- Die zeitliche Folge des Verlaufs. Bei gleicher Zeit entscheidet die
  -- Kennung, damit die Reihenfolge bei jedem Laden dieselbe ist.
  created_at timestamptz not null,
  constraint chat_nachricht_rolle_valid check (rolle in ('ich', 'ki')),
  -- Eine Antwort traegt immer ihr Modell, eine eigene Nachricht nie: sie
  -- kam von keinem.
  constraint chat_nachricht_modell_valid check (
    (rolle = 'ki' and modell is not null)
    or (rolle = 'ich' and modell is null)
  )
);

create index chat_nachricht_trip_id_idx on chat_nachricht (trip_id, created_at);
