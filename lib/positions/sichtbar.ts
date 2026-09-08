import type { GeteiltePosition } from "./types";
import { istVeraltet } from "./auswahl";

/**
 * Alle Positionen einer Reise, die auf der Karte noch erscheinen (req-050).
 * Dieselbe Altersgrenze wie beim Live-Status (siehe auswahl.ts): eine alte
 * Position ist beim Suchen schlechter als keine.
 */
export function sichtbarePositionen<T extends GeteiltePosition>(
  positionen: T[],
  jetzt: Date,
): T[] {
  return positionen.filter((position) => !istVeraltet(position, jetzt));
}
