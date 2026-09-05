/**
 * Der Lebenszyklus einer Karte, ohne dass er die Seite mitreisst.
 *
 * Die Kartenbibliothek braucht WebGL2. Fehlt es -- weil der Browser es nicht
 * kann oder die Hardwarebeschleunigung abgeschaltet ist --, entsteht zwar
 * eine Karte, aber ohne Zeichenwerk: `resize()` und `remove()` laufen dann
 * ins Leere und werfen. `remove()` steht im Aufraeumen eines Effekts, und
 * ein Fehler von dort nimmt die ganze Ansicht mit -- statt der Reisedetails
 * oder der Planung stand nur noch "Diese Seite konnte nicht geladen werden".
 *
 * Eine Karte, die sich nicht aufbauen liess, bleibt leer -- der Rest der
 * Seite muss bedienbar bleiben (siehe delivery/vision.md: eine Funktion, die
 * auf einem Geraet gar nicht erreichbar ist, verletzt die Vision).
 */

function ohneAbsturz(was: string, aktion: () => void): void {
  try {
    aktion();
  } catch (fehler) {
    console.warn(`Karte: ${was} fehlgeschlagen`, fehler);
  }
}

/** Gleicht die Kartenflaeche an ihren Container an (siehe bug-003, bug-011). */
export function resizeMap(map: { resize: () => void }): void {
  ohneAbsturz("Groessenabgleich", () => map.resize());
}

/** Baut die Karte ab -- gehoert ins Aufraeumen des Effekts, der sie anlegt. */
export function removeMap(map: { remove: () => void }): void {
  ohneAbsturz("Abbau", () => map.remove());
}
