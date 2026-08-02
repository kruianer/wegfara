export type PlanAreaId =
  | "pois"
  | "planung"
  | "bewertungen"
  | "kosten"
  | "dokumente"
  | "einstellungen";

export interface PlanArea {
  id: PlanAreaId;
  label: string;
}

/** Die sechs Bereiche des Planers (siehe req-009). */
export const PLAN_AREAS: PlanArea[] = [
  { id: "pois", label: "POIs" },
  { id: "planung", label: "Planung" },
  { id: "bewertungen", label: "Bewertungen" },
  { id: "kosten", label: "Kosten" },
  { id: "dokumente", label: "Dokumente" },
  { id: "einstellungen", label: "Einstellungen" },
];

/** Nur dieser Bereich ist derzeit bedienbar; die uebrigen sind sichtbar, aber inaktiv. */
export const ACTIVE_PLAN_AREA: PlanAreaId = "pois";
