-- Gastzugang entfernen (req-042): der zweite, schwaechere Zugangsweg fuer
-- Zuschauer ohne Konto faellt ersatzlos weg. Wer an einer Reise teilnimmt,
-- bekommt eine Einladung (req-023) und ein eigenes Konto -- das bleibt der
-- einzige Weg in die App.
--
-- Entfernt wird ausschliesslich, was zum Gastzugang gehoert: Personen,
-- Einladungen, Reisen und die Sitzungen angemeldeter Personen (`session`)
-- bleiben unberuehrt.
--
-- Ein zum Zeitpunkt der Umstellung laufender Gastzugang endet damit sofort:
-- mit `guest_session` verschwindet die Ablage, aus der eine Gast-Sitzung
-- ueberhaupt erkannt wurde. Der naechste Aufruf trifft auf eine Sitzung, die
-- keine ist, und fuehrt zur Anmeldeseite.
--
-- `guest_session` zuerst: sie haengt mit einem Fremdschluessel an
-- `guest_access`.
drop table if exists guest_session;
drop table if exists guest_access;
