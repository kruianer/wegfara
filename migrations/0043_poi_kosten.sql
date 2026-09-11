-- Kosten am POI (req-061): was der Ort je Person kostet.
--
-- Freiwillig -- null heisst "nicht eingetragen", und das ist etwas anderes
-- als "kostet nichts" (0). Beides entscheidet mit, ob ein Ort in den Plan
-- kommt, und beides will der Reiseleiter unterscheiden koennen.
--
-- Gespeichert wird in Cent, nicht in Euro: Geldbetraege in double precision
-- verlieren beim Rechnen Cents. Die Waehrung steht nicht dabei -- gefuehrt
-- wird ausschliesslich in Euro (req-061, Out of Scope), wie bei den Ausgaben
-- (req-029) auch.
alter table poi add column kosten_cent integer;

-- Die Datenbank haelt nur fest, was ohne Kenntnis der Anwendung gilt: ein
-- Betrag ist nicht negativ. Die Obergrenze und die Lesart der Eingabe
-- ("12,50") pruefen lib/pois/kosten.ts und lib/pois/validate.ts -- dort
-- entsteht auch die Meldung, die der Nutzer liest.
alter table poi add constraint poi_kosten_cent_valid check (
  kosten_cent is null or kosten_cent >= 0
);
