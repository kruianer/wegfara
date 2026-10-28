-- Die Ueberschriften der Reisetage auf Seite 2 des gedruckten Plans (req-103):
-- "Guggenheim und Altstadt" statt der Aufzaehlung der Orte.
--
-- Die KI schlaegt sie auf Knopfdruck vor, gespeichert wird das Ergebnis --
-- nicht bei jedem Druck neu erzeugt, sonst kostete jeder Ausdruck Geld und
-- das Heft laese sich jedes Mal anders. Wer eine Ueberschrift von Hand
-- aendert, behaelt sie: `von_hand` haelt das fest, und ein erneutes Erzeugen
-- ruehrt sie nicht mehr an.
--
-- Ein Reisetag ist sein Datum. Verschiebt sich der Zeitraum der Reise, bleiben
-- Zeilen fuer Tage ausserhalb liegen und werden nicht mehr gezeigt; fehlt eine
-- Zeile, stehen die Orte des Tages da (req-103: der Plan ist nie kaputt).
create table tages_ueberschrift (
  trip_id uuid not null references trip (id) on delete cascade,
  datum date not null,
  text text not null,
  von_hand boolean not null,
  updated_at timestamptz not null,
  primary key (trip_id, datum),
  constraint tages_ueberschrift_nicht_leer check (text <> '')
);
