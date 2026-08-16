import type { ActivityType } from "./types";

export const ACTIVITY_TYPE_LABEL: Record<ActivityType, string> = {
  sehenswuerdigkeit: "Sehenswürdigkeit",
  stadt_dorf: "Stadt & Dorf",
  restaurant: "Restaurant",
  hotel: "Hotel",
  aktivitaet: "Aktivität",
  weltkulturerbe: "Weltkulturerbe",
};

/**
 * Feste Typfarben nach Design Tokens, unabhaengig vom Theme. "Stadt & Dorf"
 * kennt die Vorlage nicht (siehe req-018) -- die Farbe ist im selben Stil
 * ergaenzt und unterscheidbar von den fuenf vorhandenen.
 */
export const ACTIVITY_TYPE_COLOR: Record<ActivityType, string> = {
  sehenswuerdigkeit: "#8a63d2",
  stadt_dorf: "#a1547f",
  restaurant: "#e0603e",
  hotel: "#2b7cc7",
  aktivitaet: "#1f9d63",
  weltkulturerbe: "#c9a227",
};
