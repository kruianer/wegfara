import type { IconFarben } from "./kompassrose";

/**
 * Die Farben des Icons (req-065). Sie kommen aus der Farbwelt
 * "Indigo-Nacht" der Anmeldeseite (req-015): `--card` als Grund, `--text`
 * als Zeichen.
 *
 * Der Grund ist bewusst ein Indigo und kein Schwarz -- so ist zu erkennen,
 * dass die Flaeche zum Zeichen gehoert und nicht Apples Ersatz fuer einen
 * durchsichtigen Hintergrund ist.
 */
export const ICON_FARBEN: IconFarben = {
  grund: "#131730",
  zeichen: "#e9ebf7",
};
