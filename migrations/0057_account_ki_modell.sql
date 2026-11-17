-- Die KI-Modelle, die ein Account gewaehlt hat (req-108): je Zweck eines --
-- 'fragen' (POI-Suche, Beschreibung, Planen), 'bilder' (POI-Bild,
-- Reisetitelfoto) und 'chat' (womit eine Unterhaltung im Planer beginnt).
--
-- Je Account wie die Zugangsschluessel (account_api_key, req-028): bezahlt
-- wird je Account. Der Modellname steht im Klartext -- er ist kein Geheimnis,
-- er wird gezeigt. Fehlt eine Zeile, ist nichts gewaehlt: dann gilt die
-- Umgebung (OPENAI_MODEL, OPENAI_IMAGE_MODEL), sonst der Standard im
-- Quelltext.
create table account_ki_modell (
  account_id uuid not null references account (id) on delete cascade,
  zweck text not null,
  modell text not null,
  updated_at timestamptz not null,
  primary key (account_id, zweck),
  constraint account_ki_modell_zweck_gueltig
    check (zweck in ('fragen', 'bilder', 'chat')),
  constraint account_ki_modell_modell_gefuellt check (modell <> '')
);
