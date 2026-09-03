-- Nickname je Person (req-020): wie der Reiseleiter die Person anspricht.
-- Freiwillig und hoechstens 20 Zeichen lang (in der Anwendung geprueft, wie
-- die Laenge des Namens). Der Name bleibt erforderlich -- der Nickname
-- ersetzt ihn nur in der Anzeige, gespeichert bleiben beide.
alter table participant add column nickname text;
