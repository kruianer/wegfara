/**
 * Feste Farbpalette fuer die Punkte der Teilnehmer auf der Karte (req-050) --
 * genug Abstand zueinander, um nebeneinander unterscheidbar zu bleiben.
 */
const PALETTE = [
  "#e4572e",
  "#2e86ab",
  "#f4a300",
  "#4c956c",
  "#8338ec",
  "#d7263d",
  "#1b998b",
  "#ee6c4d",
];

/**
 * Eine stabile Farbe je Teilnehmer -- dieselbe Person hat immer denselben
 * Punkt, auch nach einem Neuladen der Seite.
 */
export function positionColor(participantId: string): string {
  let hash = 0;
  for (let i = 0; i < participantId.length; i++) {
    hash = (hash * 31 + participantId.charCodeAt(i)) >>> 0;
  }
  return PALETTE[hash % PALETTE.length];
}
