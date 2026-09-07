import type { PoiPosition } from "@/lib/pois/types";

/**
 * Ein bei Google nachgeschlagener Ort (siehe req-026), reduziert auf die
 * Angaben, die wegfara uebernimmt. Alles ausser Kennung, Name und Position
 * ist freiwillig — nicht jeder Ort fuehrt Telefonnummer oder
 * Oeffnungszeiten.
 */
export interface GooglePlace {
  /** Die Kennung des Ortes bei Google — sie erkennt denselben Ort wieder. */
  placeId: string;
  name: string;
  address?: string;
  position: PoiPosition;
  /** Die Arten des Ortes bei Google, in ihrer Reihenfolge. */
  types: string[];
  web?: string;
  /** Der beschreibende Text zum Ort — daraus entstehen Kurz- und Langtext (req-044). */
  description?: string;
  phone?: string;
  /** Eine Zeile je Wochentag, bereits formuliert. */
  openingHours?: string[];
  /**
   * Die Bewertung bei Google, 0 bis 5 (req-057). Fehlt, wenn der Ort noch
   * nicht bewertet wurde -- "keine Bewertung" ist nicht dasselbe wie 0.
   */
  rating?: number;
  /** Wie viele Bewertungen dahinter stehen (req-057). */
  ratingCount?: number;
  /**
   * Die Ortschaft aus den Adressbestandteilen (req-041, req-057). Leer,
   * wenn Google keine kennt.
   */
  ort?: string;
  /** Die Kennungen der Fotos bei Google, hoechstens die ersten drei. */
  photoNames: string[];
}
