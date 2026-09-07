-- Reisetempo einer Reise (req-056): wie voll ein Tag geplant wird und wie
-- viel Gleichartiges an einem Tag erlaubt ist.
--
-- Es wirkt ausschliesslich auf die KI-Planung (req-056, Out of Scope: "Das
-- Reisetempo beim Verplanen von Hand durchsetzen") -- von Hand plant der
-- Reiseleiter weiterhin, wie er will.
--
-- Die Zahlen dahinter (Tageslaenge in Stunden, hoechstens gleiche POI-Typen
-- je Tag) stehen in der Anwendung (lib/trips/tempo.ts) und nicht im Schema:
-- sie sind Planungsregeln, keine Stammdaten -- wie schon die Hoechstlaengen
-- von Titel und Beschreibung (req-017, req-033).
alter table trip add column tempo text not null default 'ausgewogen';

alter table trip add constraint trip_tempo_valid
  check (tempo in ('entspannt', 'ausgewogen', 'dicht'));

-- Bestehende Reisen stehen auf "Ausgewogen" -- derselbe Ausgangspunkt wie
-- bei einer neu angelegten (req-056, Akzeptanzkriterien). Ausdruecklich
-- gesetzt statt dem Vorgabewert der Spalte ueberlassen.
update trip set tempo = 'ausgewogen';
