-- Praeferenzen der Reise und die Angaben aus Google an einem gefundenen POI
-- (req-057).
--
-- Die vier Praeferenzen wirken ausschliesslich auf die KI-Suche: sie sagen
-- der KI, worauf die Gruppe Wert legt. Sie sind alle freiwillig -- eine
-- Reise ohne Praeferenzen sucht wie bisher.

-- Die angekreuzten Interessen, kommagetrennt (wie schon poi.manual_fields).
-- Leer heisst "keine angekreuzt"; die Liste der moeglichen Werte steht in
-- lib/trips/praeferenzen.ts und nicht im Schema -- sie ist eine
-- Suchvorgabe, keine Stammdatenliste.
alter table trip add column interessen text not null default '';
-- "Worauf legen wir Wert" und "Was wir nicht wollen", je ein Satz in
-- eigenen Worten. Die Hoechstlaenge von 500 Zeichen steht in der Anwendung
-- (lib/trips/validate.ts), wie schon die 80 Zeichen des Titels und die 2000
-- der Beschreibung.
alter table trip add column wert_auf text not null default '';
alter table trip add column nicht_wollen text not null default '';
-- Die Mindestbewertung, 0 bis 5. Vorgabe 0 heisst "keine Einschraenkung";
-- die Halbschritte dazwischen setzt die Anwendung durch
-- (lib/trips/praeferenzen.ts), das Schema haelt nur die Grenzen.
alter table trip add column mindestbewertung double precision not null default 0;

alter table trip add constraint trip_mindestbewertung_valid
  check (mindestbewertung >= 0 and mindestbewertung <= 5);

-- Bestehende Reisen stehen ohne Praeferenzen da -- derselbe Ausgangspunkt
-- wie bei einer neu angelegten. Ausdruecklich gesetzt statt dem Vorgabewert
-- der Spalte ueberlassen.
update trip set interessen = '', wert_auf = '', nicht_wollen = '',
                mindestbewertung = 0;

-- Die Bewertung eines POI bei Google und der Satz, warum die KI ihn
-- vorschlaegt (req-057). Alle drei sind freiwillig: von Hand angelegte POIs
-- tragen sie nicht, und vor req-057 gefundene ebenso wenig.
alter table poi add column bewertung double precision;
alter table poi add column bewertung_anzahl integer;
alter table poi add column ki_begruendung text;

alter table poi add constraint poi_bewertung_valid
  check (bewertung is null or (bewertung >= 0 and bewertung <= 5));
