export type PlanAreaId =
  | "pois"
  | "planung"
  | "bewertungen"
  | "kosten"
  | "dokumente"
  | "reisedetails"
  | "account"
  | "nutzer"
  | "gastzugaenge";

export interface PlanArea {
  id: PlanAreaId;
  label: string;
}

/**
 * Die Bereiche des Planers (siehe req-009). "Mein Bereich" ist seit req-032
 * dabei: er traegt, was fuer den ganzen Account gilt, und steht deshalb am
 * Ende -- vor der "Verwaltung" des Gesamt-Admins, die kein Bereich des
 * Planers ist, sondern eine eigene Seite (req-025).
 *
 * Beide hiessen bis req-036 "Account" bzw. "Account-Verwaltung" und waren
 * beim Lesen nicht auseinanderzuhalten; die Kennungen tragen weiterhin
 * "account".
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
  { id: "account", label: "Mein Bereich" },
  // Beide sind an eine Kennzeichnung gebunden (req-038) und stehen deshalb
  // nicht bei jedem im Kopfbereich -- siehe planAreasFor.
  { id: "nutzer", label: "Nutzer" },
  { id: "gastzugaenge", label: "Gastzugänge" },
];

/** Bereich, der beim Oeffnen des Planers vorausgewaehlt ist. */
export const ACTIVE_PLAN_AREA: PlanAreaId = "pois";

/** Nur diese Bereiche sind derzeit bedienbar; die uebrigen sind sichtbar, aber inaktiv (siehe req-011, req-019, req-032, req-033, req-034). */
export const SWITCHABLE_PLAN_AREAS: PlanAreaId[] = [
  "pois",
  "planung",
  "dokumente",
  "reisedetails",
  "account",
  "nutzer",
  "gastzugaenge",
];

/**
 * Wer welchen Bereich ueberhaupt zu sehen bekommt (req-038): "Nutzer" nur
 * ein Account-Admin, "Gastzugaenge" zusaetzlich der Reiseleiter einer
 * eigenen Reise. Was nicht erlaubt ist, wird nicht angezeigt.
 *
 * Das ist die Anzeige, nicht der Schutz: dieselbe Pruefung findet noch
 * einmal serverseitig statt und gilt auch beim direkten Aufruf der Adresse
 * oder der API-Route.
 */
export interface PlanAreaVisibility {
  /** Ob die Person die Personen des Accounts verwalten darf (req-027). */
  accountAdmin: boolean;
  /** Ob sie mindestens eine Reise dieses Accounts fuehrt (req-021). */
  tripLeader: boolean;
}

export function mayUsePlanArea(
  area: PlanAreaId,
  { accountAdmin, tripLeader }: PlanAreaVisibility,
): boolean {
  if (area === "nutzer") return accountAdmin;
  if (area === "gastzugaenge") return accountAdmin || tripLeader;
  return true;
}

export function planAreasFor(visibility: PlanAreaVisibility): PlanArea[] {
  return PLAN_AREAS.filter((area) => mayUsePlanArea(area.id, visibility));
}
