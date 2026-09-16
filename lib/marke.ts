/**
 * Wie die Anwendung heisst -- an genau einer Stelle (req-065).
 *
 * Derselbe Name steht unter dem Icon auf dem Homescreen, im Fenster der vom
 * Homescreen gestarteten App und im Browser, wenn ein Passkey eingerichtet
 * wird. Ein zweiter Name darf nicht entstehen.
 */
export const APP_NAME = "Wegfara";

/** Was die Anwendung tut -- fuer den Browser und den Homescreen. */
export const APP_BESCHREIBUNG = "Adaptiver Reiseplaner";

/**
 * Der Grundton der Anwendung -- der Basiswert der Farbwelt "Indigo-Nacht"
 * (req-015). Er faerbt die Leisten um das Fenster, wenn die App vom
 * Homescreen gestartet ist, und die Flaeche, die Android beim Starten zeigt.
 *
 * `app/globals.css` setzt denselben Wert am body (bug-005); dass beide
 * uebereinstimmen, prueft app/layout.test.ts -- sonst blitzte beim Start
 * eine andere Farbe auf als die der Seite.
 */
export const APP_GRUNDTON = "#0c0f1e";
