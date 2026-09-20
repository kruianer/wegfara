/**
 * Kontrast zweier Farben nach WCAG 2.1 (Abschnitt 1.4.3). Reine Rechnung
 * ohne UI-Bezug: Tests und Werkzeuge pruefen damit die Farbwelt, ohne ein
 * laufendes Next.js oder einen Browser zu brauchen.
 *
 * Die Grenze fuer Fliesstext steht in delivery/stack.md (Conventions,
 * "Kontrast") -- sie ist der Massstab, gegen den bug-051 geprueft wurde.
 */

/** Ab diesem Verhaeltnis gilt Text als lesbar (WCAG AA, normale Groesse). */
export const MINDESTKONTRAST_FLIESSTEXT = 4.5;

/** Ab diesem Verhaeltnis gilt grosse Schrift (ab 18.66px fett / 24px) als lesbar. */
export const MINDESTKONTRAST_GROSSE_SCHRIFT = 3;

/**
 * Wandelt `#rgb` oder `#rrggbb` in die drei Kanaele 0..255.
 * Andere Schreibweisen (rgba(), Farbnamen) sind bewusst nicht erlaubt --
 * die Farbwelt "Indigo-Nacht" fuehrt ihre Textstufen als Hex-Werte.
 */
function kanaele(hex: string): [number, number, number] {
  const wert = hex.trim().replace(/^#/, "");
  const voll =
    wert.length === 3
      ? wert
          .split("")
          .map((z) => z + z)
          .join("")
      : wert;
  if (!/^[0-9a-fA-F]{6}$/.test(voll)) {
    throw new Error(`Keine Hex-Farbe: ${hex}`);
  }
  const zahl = parseInt(voll, 16);
  return [(zahl >> 16) & 255, (zahl >> 8) & 255, zahl & 255];
}

/** Relative Leuchtdichte einer Farbe (0 = Schwarz, 1 = Weiss). */
export function leuchtdichte(hex: string): number {
  const [r, g, b] = kanaele(hex).map((kanal) => {
    const anteil = kanal / 255;
    return anteil <= 0.03928
      ? anteil / 12.92
      : Math.pow((anteil + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Kontrastverhaeltnis zweier Farben -- zwischen 1 (gleich) und 21
 * (Schwarz auf Weiss). Die Reihenfolge der Farben spielt keine Rolle.
 */
export function kontrastVerhaeltnis(
  eineFarbe: string,
  andereFarbe: string,
): number {
  const a = leuchtdichte(eineFarbe);
  const b = leuchtdichte(andereFarbe);
  const hell = Math.max(a, b);
  const dunkel = Math.min(a, b);
  return (hell + 0.05) / (dunkel + 0.05);
}
