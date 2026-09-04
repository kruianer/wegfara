export type PlanAreaId =
  | "pois"
  | "planung"
  | "bewertungen"
  | "kosten"
  | "dokumente"
  | "einstellungen"
  | "account";

export interface PlanArea {
  id: PlanAreaId;
  label: string;
}

/**
 * Die Bereiche des Planers (siehe req-009). "Account" ist seit req-032
 * dabei: er traegt, was fuer den ganzen Account gilt, und steht deshalb am
 * Ende -- vor der Account-Verwaltung des Gesamt-Admins, die kein Bereich
 * des Planers ist, sondern eine eigene Seite (req-025).
 */
export const PLAN_AREAS: PlanArea[] = [
  { id: "pois", label: "POIs" },
  { id: "planung", label: "Planung" },
  { id: "bewertungen", label: "Bewertungen" },
  { id: "kosten", label: "Kosten" },
  { id: "dokumente", label: "Dokumente" },
  { id: "einstellungen", label: "Einstellungen" },
  { id: "account", label: "Account" },
];

/** Bereich, der beim Oeffnen des Planers vorausgewaehlt ist. */
export const ACTIVE_PLAN_AREA: PlanAreaId = "pois";

/** Nur diese Bereiche sind derzeit bedienbar; die uebrigen sind sichtbar, aber inaktiv (siehe req-011, req-019, req-032). */
export const SWITCHABLE_PLAN_AREAS: PlanAreaId[] = [
  "pois",
  "planung",
  "einstellungen",
  "account",
];
