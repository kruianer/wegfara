/**
 * Unter welchen Adressen das Icon liegt und in welchen Kantenlaengen es
 * ausgeliefert wird (req-065).
 *
 * Die Bilder entstehen erst bei der Anfrage und nicht beim Bauen -- nur so
 * kann die Umgebung ueber ihre Farbe entscheiden, obwohl dev und prod aus
 * demselben Stand bauen. Deshalb sind es Adressen der Anwendung und keine
 * Dateien unter public/.
 */

/** Der gemeinsame Anfang aller Icon-Adressen; die middleware laesst ihn offen. */
export const ICON_BASIS_PFAD = "/icon";

/** Fuer den Browser-Tab und die Lesezeichen. */
export const ICON_TAB_GROESSE = 32;

/**
 * Fuer den Homescreen von iPad und iPhone. 180 ist die Kantenlaenge, die
 * Apple fuer das Homescreen-Icon erwartet; kleinere Geraete rechnen selbst
 * herunter.
 */
export const ICON_APPLE_GROESSE = 180;

/** Alle Kantenlaengen, die ausgeliefert werden. Was nicht hier steht, gibt es nicht. */
export const ICON_GROESSEN: readonly number[] = [
  ICON_TAB_GROESSE,
  ICON_APPLE_GROESSE,
];

export function iconPfad(groesse: number): string {
  return `${ICON_BASIS_PFAD}/${groesse}`;
}

/**
 * Die Kantenlaenge aus der Adresse -- oder null, wenn sie nicht ausgeliefert
 * wird. Bewusst eine feste Liste: eine frei waehlbare Groesse liesse jeden
 * Aufrufer beliebig grosse Bilder rechnen lassen.
 */
export function iconGroesseAus(wert: string): number | null {
  const groesse = Number(wert);
  return ICON_GROESSEN.includes(groesse) ? groesse : null;
}
