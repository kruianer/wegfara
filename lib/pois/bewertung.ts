import type { Poi } from "./types";

/**
 * Die Bewertung eines POI, wie sie in seiner Zeile steht (req-057):
 * „4,6 aus 1.240“ — die Note und wie viele Leute sie vergeben haben. Ohne
 * die Zahl dahinter bliebe offen, ob hinter der Note zwei Meinungen stehen
 * oder tausend.
 *
 * Liefert null, wenn der Ort keine Bewertung traegt — von Hand angelegte
 * POIs haben keine, und dann steht in der Zeile auch nichts.
 */
export function bewertungText(
  poi: Pick<Poi, "bewertung" | "bewertungAnzahl">,
): string | null {
  if (typeof poi.bewertung !== "number") return null;

  const note = poi.bewertung.toFixed(1).replace(".", ",");
  if (typeof poi.bewertungAnzahl !== "number") return note;
  return `${note} aus ${poi.bewertungAnzahl.toLocaleString("de-DE")}`;
}
