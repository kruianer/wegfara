import type { ActivityType } from "./types";

export const ACTIVITY_TYPE_LABEL: Record<ActivityType, string> = {
  sehenswuerdigkeit: "Sehenswürdigkeit",
  restaurant: "Restaurant",
  hotel: "Hotel",
  aktivitaet: "Aktivität",
  weltkulturerbe: "Weltkulturerbe",
};

/** Feste Typfarben nach Design Tokens, unabhaengig vom Theme. */
export const ACTIVITY_TYPE_COLOR: Record<ActivityType, string> = {
  sehenswuerdigkeit: "#8a63d2",
  restaurant: "#e0603e",
  hotel: "#2b7cc7",
  aktivitaet: "#1f9d63",
  weltkulturerbe: "#c9a227",
};
