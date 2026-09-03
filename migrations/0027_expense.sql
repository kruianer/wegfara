-- Ausgaben einer Reise und ihre Aufteilung (req-029): unterwegs zahlt mal
-- der eine das Abendessen, mal der andere den Sprit. Wer wem was schuldet,
-- laesst sich am Ende der Reise nur beantworten, wenn im Moment des
-- Bezahlens festgehalten wird, wer gezahlt hat und fuer wen.
--
-- Die Mandantentrennung laeuft ueber die Reise, wie bei poi und activity:
-- eine Ausgabe haengt an einer Reise, die Reise am Account.
--
-- Betraege liegen als ganze Cent (integer), nicht als Gleitkommazahl: bei
-- Geld muss die Summe der Anteile den Gesamtbetrag exakt treffen, und das
-- haelt keine Gleitkommazahl durch.
--
-- Alle Betraege werden in Euro gefuehrt -- Euro ist die Waehrung der
-- Abrechnung (req-029, Constraints). Der urspruenglich erfasste Betrag samt
-- Waehrung bleibt daneben stehen, damit er sichtbar bleibt.
create table expense (
  id uuid primary key,
  trip_id uuid not null references trip (id),
  title text not null,
  -- Der Betrag in Euro-Cent, umgerechnet mit exchange_rate.
  amount_cents integer not null,
  -- Der erfasste Betrag in der kleinsten Einheit seiner Waehrung.
  original_amount_cents integer not null,
  currency text not null,
  -- Euro je eine Einheit der erfassten Waehrung, beim Erfassen ermittelt
  -- und danach nie wieder geaendert: sonst verschoeben sich bereits
  -- abgerechnete Betraege nachtraeglich (req-029, Constraints). Bei Euro
  -- ist er 1.
  exchange_rate double precision not null,
  -- Wer ausgelegt hat. Ohne on delete cascade liesse sich eine Person, die
  -- einmal gezahlt hat, nicht mehr aus dem Account entfernen (req-019) --
  -- mit ihr verschwinden deshalb ihre Ausgaben.
  payer_id uuid not null references participant (id) on delete cascade,
  split_mode text not null,
  created_at timestamptz not null,
  constraint expense_amount_positive check (amount_cents > 0),
  constraint expense_original_amount_positive check (original_amount_cents > 0),
  constraint expense_exchange_rate_positive check (exchange_rate > 0),
  -- Vier Waehrungen, mehr sind nicht Teil von req-029.
  constraint expense_currency_valid
    check (currency in ('EUR', 'CHF', 'USD', 'GBP')),
  -- Wie aufgeteilt wurde, bleibt erhalten: sonst laesst sich eine
  -- individuell aufgeteilte Ausgabe nicht mehr so oeffnen, wie sie erfasst
  -- wurde.
  constraint expense_split_mode_valid
    check (split_mode in ('gleichmaessig', 'individuell'))
);

create index expense_trip_id_idx on expense (trip_id);

-- Der Anteil je beteiligter Person, ebenfalls in Euro-Cent. Die Summe der
-- Anteile einer Ausgabe ergibt ihren Gesamtbetrag -- auch bei einer
-- Teilung, die nicht aufgeht: den Rest von wenigen Cent traegt der Zahler
-- (siehe lib/expenses/split.ts).
--
-- Der Primaerschluessel laesst je Ausgabe und Person genau einen Anteil zu.
create table expense_share (
  expense_id uuid not null references expense (id) on delete cascade,
  participant_id uuid not null references participant (id) on delete cascade,
  amount_cents integer not null,
  primary key (expense_id, participant_id)
);

create index expense_share_participant_id_idx
  on expense_share (participant_id);
