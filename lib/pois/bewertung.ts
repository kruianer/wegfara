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

/**
 * Die Bewertung in der knappen Form, die unter dem Bild der POI-Liste steht
 * (req-097): die Note und die Anzahl, gross gerundet -- "4,7" und "61k". Dort
 * ist neben der Buchung kein Platz fuer "aus 61.204". Die volle Angabe
 * (bewertungText) bleibt fuer den Tooltip.
 *
 * Liefert null, wenn der Ort keine Bewertung traegt.
 */
export function bewertungKurz(
  poi: Pick<Poi, "bewertung" | "bewertungAnzahl">,
): { note: string; anzahl: string | null } | null {
  if (typeof poi.bewertung !== "number") return null;

  const note = poi.bewertung.toFixed(1).replace(".", ",");
  if (typeof poi.bewertungAnzahl !== "number") return { note, anzahl: null };
  return { note, anzahl: anzahlKurz(poi.bewertungAnzahl) };
}

/** 240 bleibt 240, 8.312 wird "8,3k", 61.204 wird "61k". */
function anzahlKurz(anzahl: number): string {
  if (anzahl < 1000) return String(anzahl);
  const tausend = anzahl / 1000;
  if (tausend < 10) {
    return `${(Math.floor(tausend * 10) / 10).toLocaleString("de-DE")}k`;
  }
  return `${Math.floor(tausend).toLocaleString("de-DE")}k`;
}
