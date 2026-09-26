/**
 * Die Farbe der Wege eines Reisetages auf der Karte: die Verbindungslinien
 * (req-059) und die Richtungspfeile darauf (req-075).
 *
 * Sie steht hier und nicht in der Oberflaeche -- dieselbe Ueberlegung wie beim
 * Suchgebiet (bug-030, lib/pois/search-area.ts), nur in die andere Richtung:
 * Linie und Pfeil trugen den Akzent des Planers (`--acc`, ein helles Sandgelb
 * fuer den dunklen Grund der App) und erreichten auf dem hellen Kartengrund
 * nur 1,49:1 -- man musste sie suchen (bug-059). Ein dunkles Indigo der
 * Farbwelt "Indigo-Nacht" (req-015) hebt sich davon ab und bleibt auch auf
 * Wasser, Wald und Bebauung der OpenStreetMap-Kacheln deutlich.
 */
export const ROUTEN_FARBE = "#1f2547";

/**
 * Der helle Kartengrund, gegen den Linie und Pfeil gemessen werden -- der
 * Grundton der OpenStreetMap-Kacheln, kein Wert der Oberflaeche. Die
 * Kartenflaechen darauf (Wasser, Wald, Bebauung) sind dunkler als er; wer
 * gegen ihn besteht, besteht auch gegen sie.
 */
export const KARTENGRUND_HELL = "#f2efe9";

/**
 * Was Linie und Pfeil auf dem Kartengrund mindestens erreichen muessen
 * (bug-059) -- die Lesbarkeitsgrenze aus delivery/stack.md. Angestrebt ist
 * deutlich mehr, denn unter den Pfeilen liegen Beschriftungen und Wege der
 * Karte.
 */
export const MINDESTKONTRAST_ROUTE = 4.5;
