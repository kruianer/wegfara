import type { Trip } from "./types";

/**
 * Das Titelfoto einer Reise (req-103) -- das Bild auf dem Deckblatt des
 * gedruckten Reiseplans.
 *
 * Es ist eine Angabe ueber die Reise wie Titel und Zeitraum und wird in den
 * Reisedetails gewaehlt, nicht im Druck. Ohne Wahl gibt es keines; dann nimmt
 * der Plan wie bisher das erste Foto der ersten Station (req-080) -- die Wahl
 * ist eine Verbesserung, keine Pflicht.
 */
export type TripTitelfoto =
  /** Ein Foto eines POI dieser Reise. */
  | { tripId: string; art: "poi"; photoId: string }
  /**
   * Ein eigenes Bild, das zu keinem POI gehoert -- hochgeladen oder von der
   * KI erzeugt (req-072). `stand` ist der Zeitpunkt, zu dem es abgelegt
   * wurde: er steht in der Adresse, damit ein ersetztes Bild nicht aus dem
   * Zwischenspeicher des Browsers zurueckkommt.
   */
  | { tripId: string; art: "eigen"; istKiBild: boolean; stand: string };

/** Woher ein eigenes Titelfoto stammt (`trip_titelfoto.source`). */
export type TitelfotoQuelle = "manuell" | "ki";

const TITELFOTO_API = "/api/reise-titelfoto";

/** Die Adresse, unter der ein eigenes Titelfoto herauskommt. */
export function eigenesTitelfotoUrl(tripId: string, stand: string): string {
  return `${TITELFOTO_API}/${tripId}?stand=${encodeURIComponent(stand)}`;
}

/** Der Hinweis unter dem Feld -- was gilt, solange nichts gewaehlt ist. */
export const TITELFOTO_VORGABE_HINWEIS =
  "Ohne Wahl nimmt der Plan das erste Foto der ersten Station — wie bisher.";

/** Was die Oberflaeche sagt, wenn das Speichern ohne Grund scheiterte. */
export const TITELFOTO_FEHLGESCHLAGEN =
  "Das Titelfoto konnte nicht gespeichert werden.";

/**
 * Was der KI aufgetragen wird, wenn sie ein Titelbild erzeugen soll (req-103,
 * req-072): die Reise, um die es geht -- Titel, Hauptort und, wenn es eine
 * gibt, ihre Beschreibung. Wie beim Bild eines POI soll es wie eine
 * Fotografie wirken, nicht wie eine Zeichnung, und keine Schrift tragen: der
 * Titel steht ohnehin darauf.
 */
export function titelbildAufforderung(trip: Trip): string {
  const beschreibung = trip.description.trim();
  return [
    `Fotorealistische Aufnahme für das Titelblatt eines Reiseplans: „${trip.title.trim()}“ in ${trip.mainPlace.name}.`,
    beschreibung.length > 0 ? `Dazu ist bekannt: ${beschreibung}` : null,
    "Ein stimmungsvolles, weites Motiv des Ortes, das Lust auf die Reise macht — natürliches Licht, echte Materialien, glaubwürdige Perspektive einer Kamera, Querformat.",
    "Keine Zeichnung, kein Gemälde, keine Illustration, keine Collage, keine stilisierte Darstellung. Keine Schrift, keine Beschriftung, kein Wasserzeichen und kein Rahmen im Bild.",
  ]
    .filter((teil) => teil !== null)
    .join("\n");
}
