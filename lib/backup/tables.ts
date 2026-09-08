/**
 * Die Tabellen, die ein Backup enthaelt -- in der Reihenfolge, in der sie
 * sich einfuegen lassen: was auf eine andere Tabelle zeigt, steht hinter
 * ihr. Gesichert und wiederhergestellt wird in genau dieser Reihenfolge,
 * geleert in der umgekehrten.
 *
 * Die Liste steht von Hand hier und wird nicht aus der Datenbank abgeleitet:
 * die Reihenfolge ergibt sich aus den Fremdschluesseln, und die kennt
 * PostgreSQL zwar, die Datenbank im Arbeitsspeicher der Tests aber nicht.
 * Damit sie nicht veraltet, prueft tables.test.ts sie gegen das Schema der
 * Migrationen -- eine neue Tabelle ohne Eintrag hier macht den Test rot.
 */
export const BACKUP_TABLES: readonly string[] = [
  "account",
  "participant",
  "credential",
  "session",
  "login_link",
  "access_link",
  "recovery_code",
  "account_switch",
  "account_api_key",
  "trip",
  "trip_participant",
  "poi",
  "poi_photo",
  "activity",
  "transfer",
  "activity_option_selection",
  "document",
  "trip_position",
  "position_sharing",
  "rating_round",
  "rating_round_poi",
  "rating_vote",
  "expense",
  "expense_share",
  "search_area",
  "search_area_point",
];

/**
 * Was bewusst nicht ins Backup gehoert: der Stand der angewendeten
 * Migrationen. Er gehoert zum Quelltext der Umgebung und nicht zu ihren
 * Daten -- ein aelteres Backup wuerde ihn zuruecksetzen, und der naechste
 * Start liesse bereits angewendete Migrationen erneut laufen (siehe
 * scripts/migrate.mjs). Das Schema bleibt deshalb auf dem Stand des
 * Quelltextes; wiederhergestellt wird der Inhalt.
 */
export const EXCLUDED_TABLES: readonly string[] = ["schema_migrations"];
