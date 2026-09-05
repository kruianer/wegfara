-- Kurztext und Langtext am POI (req-044).
--
-- Beide sind freiwillig: was vor req-044 angelegt wurde, traegt sie nicht,
-- und nachtraeglich gefuellt werden sie nicht (req-044, Out of Scope).
--
-- Der Kurztext fasst hoechstens 200 Zeichen -- er erscheint in der POI-Liste,
-- und die Grenze haelt deren Darstellung zusammen (req-044, Constraints).
-- Geprueft wird sie in lib/pois/validate.ts, wie bei den uebrigen Laengen
-- eines POI (Name, Adresse, Webseite).
alter table poi add column short_text text;
-- Der Langtext ist unbegrenzt -- was beim Sammeln notiert wird, soll nicht
-- an einer Grenze abbrechen.
alter table poi add column long_text text;
