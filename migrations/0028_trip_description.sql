-- Beschreibung einer Reise (req-033): ein mehrzeiliger, freiwilliger Text
-- fuer die Gruppe -- was geplant ist, was mitzubringen, worauf zu achten.
-- Sie gehoert zu den Eckdaten und steht deshalb an der Reise selbst.
--
-- "not null default ''" statt nullable: leer und "nicht gesetzt" sind hier
-- dasselbe, und die Anwendung muesste sonst ueberall zwischen beidem
-- unterscheiden, ohne dass der Unterschied etwas bedeutet.
--
-- Die Hoechstlaenge von 2000 Zeichen prueft lib/trips/validate.ts -- wie
-- schon beim Titel (80 Zeichen, req-017) steht sie an einer Stelle, die
-- Formular und Schnittstelle gemeinsam nutzen.
alter table trip add column description text not null default '';

-- Bestehende Reisen haben keine Beschreibung -- derselbe Ausgangspunkt wie
-- bei einer neu angelegten (req-033). Ausdruecklich gesetzt statt dem
-- Vorgabewert der Spalte ueberlassen.
update trip set description = '';
