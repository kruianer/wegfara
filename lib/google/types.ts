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
  phone?: string;
  /** Eine Zeile je Wochentag, bereits formuliert. */
  openingHours?: string[];
  /** Die Kennungen der Fotos bei Google, hoechstens die ersten drei. */
  photoNames: string[];
}
