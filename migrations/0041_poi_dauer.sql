-- Dauer am POI (req-058): wie lange man an diesem Ort bleiben will.
--
-- Freiwillig -- null heisst "nicht eingetragen", dann gilt weiterhin die
-- geschaetzte Dauer des POI-Typs (req-011, siehe
-- lib/pois/estimated-duration.ts). Ein eingetragener Wert bestimmt beim
-- Verplanen (req-039) die Laenge des Programmpunkts und geht auch in die
-- KI-Planung (req-056) ein.
--
-- Gespeichert wird in Minuten, nicht in Stunden: der Zeitstrahl rastet auf
-- 15 Minuten (req-039), und ganze Minuten ersparen das Rechnen mit
-- Bruchteilen. Der Check haelt das Raster fest -- 90 ist erlaubt, 67 nicht.
alter table poi add column duration_min integer;

-- Die Datenbank haelt nur fest, was ohne Kenntnis der Anwendung gilt: eine
-- Dauer ist positiv. Dass sie auf dem 15-Minuten-Raster liegt, prueft
-- lib/pois/validate.ts -- dort entsteht auch die Meldung, die der Nutzer
-- liest. Ein Raster-Check im Schema braeuchte den Operator % bzw. mod(), die
-- die Test-Datenbank (pg-mem, siehe tests/test-db.ts) beide nicht kennt --
-- das Schema waere in Test und Betrieb verschieden.
alter table poi add constraint poi_duration_min_valid check (
  duration_min is null or duration_min > 0
);
