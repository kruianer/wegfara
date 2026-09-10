import type { Routenprofil } from "@/lib/routing/client";
import { TRANSFER_MODES, type TransferMode } from "./types";

/**
 * Mit welchem OSRM-Profil ein Verkehrsmittel gerechnet wird (req-059). OSRM
 * kennt genau drei Profile; die Fahrzeit richtet sich damit nach dem
 * gewaehlten Verkehrsmittel statt wie bisher immer nach dem Auto.
 *
 * Boot, Flug, Bahn und Faehre fehlen mit Absicht: sie fahren nicht auf der
 * Strasse. Fuer sie gibt es keinen Vorschlag -- Dauer und Strecke traegt der
 * Reiseleiter selbst ein, statt dass ein erfundener Wert im Formular steht.
 */
const PROFIL_JE_MITTEL: Partial<Record<TransferMode, Routenprofil>> = {
  fuss: "fuss",
  rad: "rad",
  auto: "auto",
  bus: "auto",
};

/** Das Profil eines Verkehrsmittels; null heisst: kein Streckenvorschlag. */
export function routenprofilFuer(mode: TransferMode): Routenprofil | null {
  return PROFIL_JE_MITTEL[mode] ?? null;
}

/** Die Verkehrsmittel mit Streckenvorschlag, in der Reihenfolge der Auswahl. */
export const MITTEL_MIT_VORSCHLAG: TransferMode[] = TRANSFER_MODES.filter(
  (mode) => routenprofilFuer(mode) !== null,
);

/** Der Hinweis fuer ein Verkehrsmittel ohne Streckenvorschlag (req-059). */
export const OHNE_VORSCHLAG_HINWEIS =
  "Für dieses Verkehrsmittel gibt es keinen Streckenvorschlag — " +
  "Dauer und Strecke bitte eintragen.";
