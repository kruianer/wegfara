import { environmentLabel } from "@/lib/auth/environment";
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
export const ICON_FARBEN_PROD: IconFarben = {
  grund: "#131730",
  zeichen: "#e9ebf7",
};

/**
 * Derselbe Grund, aber warm statt kalt -- fuer dev und jede andere Umgebung,
 * die nicht prod ist. Liegen beide Icons auf demselben Homescreen, sind sie
 * so auf einen Blick auseinander zu halten, ohne den Namen darunter zu
 * lesen.
 *
 * Das Zeichen selbst bleibt gleich: es ist dieselbe App, nicht eine andere.
 */
export const ICON_FARBEN_ANDERE_UMGEBUNG: IconFarben = {
  grund: "#8a4a12",
  zeichen: ICON_FARBEN_PROD.zeichen,
};

/**
 * Welche Farben eine Umgebung traegt. Was keine Kennzeichnung hat, ist prod
 * (siehe lib/auth/environment.ts).
 */
export function iconFarbenFuer(umgebung: string | null): IconFarben {
  return umgebung === null ? ICON_FARBEN_PROD : ICON_FARBEN_ANDERE_UMGEBUNG;
}

/**
 * Die Farben dieser Umgebung. Sie stammen aus APP_URL und damit aus der
 * Umgebung -- dev und prod bauen aus demselben Stand, und im Quelltext steht
 * nirgends, welcher davon der gekennzeichnete ist.
 */
export function iconFarben(): IconFarben {
  return iconFarbenFuer(environmentLabel());
}
