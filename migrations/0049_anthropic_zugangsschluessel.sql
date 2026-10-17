-- Ein eigener Zugangsschluessel fuer Anthropic (req-081). Das Chatfenster im
-- Planer redet mit Modellen von Anthropic und rechnet darueber ab; der
-- vorhandene Schluessel 'ki_suche' ist ein OpenAI-Schluessel und taugt dafuer
-- nicht.
--
-- Die Pruefregel von account_api_key.kind (migrations/0026) erlaubte bis hier
-- nur 'ki_suche' und 'google'. Sie wird erweitert, nicht ersetzt: beide
-- bleiben gueltig, 'anthropic' kommt dazu.
alter table account_api_key drop constraint account_api_key_kind_valid;

alter table account_api_key add constraint account_api_key_kind_valid
  check (kind in ('ki_suche', 'google', 'anthropic'));
