-- Der Chat darf in den Plan der geoeffneten Reise sehen (req-093): eine
-- Antwort haelt fest, welche Auskuenfte sie geholt hat, und warum eine
-- ausblieb.
--
-- Die Werkzeugaufrufe und ihre Ergebnisse selbst werden NICHT abgelegt --
-- gespeichert wird, was gefragt und was geantwortet wurde. Was hier steht,
-- ist nur der Vermerk an der Antwort, damit sie nachvollziehbar bleibt und
-- sich von einer geratenen unterscheidet.

-- Welche Auskuenfte die Antwort geholt hat, in der Reihenfolge des ersten
-- Abrufs und je Werkzeug einmal, kommagetrennt (wie poi.manual_fields).
-- Leer heisst: kein Blick in den Plan.
alter table chat_nachricht add column plan_einblicke text not null default '';

-- Warum ein Blick in den Plan ausblieb. Die Antwort bleibt trotzdem stehen;
-- der Grund steht dabei. Leer heisst: keiner ist gescheitert.
alter table chat_nachricht add column plan_fehler text;

alter table chat_nachricht add constraint chat_nachricht_plan_fehler_valid check (
  plan_fehler is null
  or (rolle = 'ki' and plan_fehler in ('grenze', 'lesen'))
);
