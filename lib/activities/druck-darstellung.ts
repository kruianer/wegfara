import type { Activity, DruckDarstellung } from "./types";

/**
 * Wie ein Programmpunkt im gedruckten Reiseplan erscheint (req-080) -- das
 * Kennzeichen, das der Planer an jedem Programmpunkt des fertigen Plans
 * setzt.
 *
 * Es wirkt ausschliesslich auf den gedruckten Plan. In der App -- Planer wie
 * Begleiter -- bleibt jeder Programmpunkt sichtbar, gleich was hier steht: es
 * blendet nichts aus, es gestaltet nur das Heft.
 */

/** Reihenfolge, in der die Werte in der Auswahlliste erscheinen. */
export const DRUCK_DARSTELLUNGEN: DruckDarstellung[] = [
  "vollstaendig",
  "nebenstation",
  "nicht_anzeigen",
];

/**
 * Der Wert, mit dem jeder Programmpunkt beginnt: im Heft bekommt ein
 * verplanter Ort Raum, Fotos und Langtext. Wer ihn kleiner haben will, sagt
 * es ausdruecklich.
 */
export const VORGEGEBENE_DRUCK_DARSTELLUNG: DruckDarstellung = "vollstaendig";

export const DRUCK_DARSTELLUNG_LABEL: Record<DruckDarstellung, string> = {
  vollstaendig: "Vollständig",
  nebenstation: "Als Nebenstation",
  nicht_anzeigen: "Nicht anzeigen",
};

/** Ob ein Wert aus einer Anfrage ein bekanntes Kennzeichen ist. */
export function isDruckDarstellung(value: unknown): value is DruckDarstellung {
  return (
    typeof value === "string" &&
    DRUCK_DARSTELLUNGEN.includes(value as DruckDarstellung)
  );
}

/**
 * Das Kennzeichen eines Programmpunkts. Diese Funktion ist die einzige
 * Stelle, die entscheidet, was ein Programmpunkt ohne eigene Angabe traegt:
 * "Vollständig" -- genau die Vorgabe, die auch in der Datenbank steht.
 */
export function druckDarstellung(
  activity: Pick<Activity, "druckDarstellung">,
): DruckDarstellung {
  return activity.druckDarstellung ?? VORGEGEBENE_DRUCK_DARSTELLUNG;
}
