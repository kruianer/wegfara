export type PlanAreaId =
  | "pois"
  | "planung"
  | "bewertungen"
  | "kosten"
  | "dokumente"
  | "reisedetails";

export interface PlanArea {
  id: PlanAreaId;
  label: string;
}

/**
 * Die Bereiche des Planers (siehe req-009). Sie alle betreffen die
 * geoeffnete Reise.
 *
 * Was zur angemeldeten Person und ihrem Account gehoert, steht seit
 * req-043 nicht mehr hier: "Konto", "Account" und "Nutzer" sind zu
 * "Mein Bereich" zusammengelegt, einer eigenen Seite mit eigener Adresse
 * (siehe app/mein-bereich). Sie ist aus dem Planer wie aus dem Begleiter
 * erreichbar -- ein Bereich allein im Planer wuerde aussperren, wer nur das
 * Smartphone dabei hat. Im Kopfbereich des Planers steht sie deshalb -- wie
 * die "Verwaltung" des Gesamt-Admins (req-025) -- als Verweis neben den
 * Bereichen, nicht als einer von ihnen.
 *
 * Der Bereich "Einstellungen" heisst seit req-033 "Reisedetails": er zeigt
 * alles zur geoeffneten Reise an einer Stelle -- Eckdaten, Zustand und wer
 * mitfaehrt.
 */
export const PLAN_AREAS: PlanArea[] = [
  { id: "pois", label: "POIs" },
  { id: "planung", label: "Planung" },
  { id: "bewertungen", label: "Bewertungen" },
  { id: "kosten", label: "Kosten" },
  { id: "dokumente", label: "Dokumente" },
  { id: "reisedetails", label: "Reisedetails" },
];

/** Bereich, der beim Oeffnen des Planers vorausgewaehlt ist. */
export const ACTIVE_PLAN_AREA: PlanAreaId = "pois";

/** Nur diese Bereiche sind derzeit bedienbar; die uebrigen sind sichtbar, aber inaktiv (siehe req-011, req-019, req-033, req-034). */
export const SWITCHABLE_PLAN_AREAS: PlanAreaId[] = [
  "pois",
  "planung",
  "dokumente",
  "reisedetails",
];
