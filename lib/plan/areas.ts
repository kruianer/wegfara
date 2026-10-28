import { PLANER_PATH } from "../einstieg/ziel";

export type PlanAreaId =
  | "pois"
  | "planung"
  | "bewertungen"
  | "kosten"
  | "dokumente"
  | "reisedetails"
  | "chat"
  | "drucken";

export interface PlanArea {
  id: PlanAreaId;
  /** Der Name des Bereichs -- der Begriff der App, auch in der Ueberschrift. */
  label: string;
  /**
   * Der Name in der Seitenleiste (req-094). Er steht dort klein unter dem
   * Symbol, und die Leiste ist nur so breit wie der laengste davon -- die
   * vollen Namen passten nicht hinein. Nur die Leiste traegt ihn; ueberall
   * sonst heisst der Bereich, wie `label` sagt.
   */
  kurz: string;
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
 * Smartphone dabei hat. In der Navigation des Planers steht sie deshalb -- wie
 * die "Verwaltung" des Gesamt-Admins (req-025) -- als Verweis neben den
 * Bereichen, nicht als einer von ihnen; seit req-077 am Fuss der
 * Seitenleiste, unter den "Einstellungen".
 *
 * Der Bereich "Einstellungen" heisst seit req-033 "Reisedetails": er zeigt
 * alles zur geoeffneten Reise an einer Stelle -- Eckdaten, Zustand und wer
 * mitfaehrt.
 */
export const PLAN_AREAS: PlanArea[] = [
  { id: "pois", label: "POIs", kurz: "Orte" },
  { id: "planung", label: "Planung", kurz: "Plan" },
  { id: "bewertungen", label: "Bewertungen", kurz: "Stimmen" },
  { id: "kosten", label: "Kosten", kurz: "Kosten" },
  { id: "dokumente", label: "Dokumente", kurz: "Papiere" },
  { id: "reisedetails", label: "Reisedetails", kurz: "Reise" },
  // Der Ort, an dem man mit der App redet (req-081). Er kommt hinten dazu und
  // laesst die gewohnte Reihenfolge der uebrigen unberuehrt.
  { id: "chat", label: "Chat", kurz: "Chat" },
  // Der gedruckte Reiseplan (req-103). Bis dahin ging er in einem eigenen
  // Browser-Reiter auf (req-080); seitdem ist er ein Bereich wie die Kosten
  // oder die Dokumente -- er gehoert zur Reise. Seine eigene Adresse bleibt.
  { id: "drucken", label: "Drucken", kurz: "Drucken" },
];

/** Bereich, der beim Oeffnen des Planers vorausgewaehlt ist. */
export const ACTIVE_PLAN_AREA: PlanAreaId = "pois";

/**
 * Nur diese Bereiche sind bedienbar; die uebrigen sind sichtbar, aber
 * inaktiv (siehe req-011, req-019, req-033, req-034, req-062). Mit req-063
 * ist "bewertungen" dazugekommen, mit req-081 "chat", mit req-103 "drucken"
 * -- damit sind es derzeit alle acht. Die Unterscheidung bleibt: der naechste neue Bereich steht
 * wieder in der Leiste, bevor es ihn gibt, und soll dort abgeschaltet sein
 * statt wie eine Sackgasse zu wirken (bug-033).
 */
export const SWITCHABLE_PLAN_AREAS: PlanAreaId[] = [
  "pois",
  "planung",
  "bewertungen",
  "kosten",
  "dokumente",
  "reisedetails",
  "chat",
  "drucken",
];

/** Ob dieser Bereich schon gebaut ist -- die uebrigen sind abgeschaltet. */
export function isSwitchablePlanArea(area: PlanAreaId): boolean {
  return SWITCHABLE_PLAN_AREAS.includes(area);
}

/**
 * Die Bereichsleiste steht seit bug-033 auf den Seiten ausserhalb des Planers
 * ("Mein Bereich", "Verwaltung"). Von dort fuehrt sie nicht in einen Zustand,
 * sondern an eine Adresse -- der Planer liest den Bereich beim Oeffnen aus
 * ihr, damit ein Verweis nicht nur "irgendwo im Planer" landet.
 */
export const PLAN_AREA_PARAM = "bereich";

/** Die Adresse des Planers, die diesen Bereich gleich vorwaehlt (bug-033). */
export function planAreaPath(area: PlanAreaId): string {
  return `${PLANER_PATH}?${PLAN_AREA_PARAM}=${area}`;
}

/**
 * Der Bereich aus der Adresse -- null, wenn nichts oder etwas Unbekanntes
 * darin steht. Ein nicht bedienbarer Bereich zaehlt nicht: er waere sonst
 * ueber die Adresszeile zu oeffnen, obwohl es ihn noch nicht gibt.
 */
export function planAreaFromParam(
  value: string | string[] | undefined,
): PlanAreaId | null {
  const wert = Array.isArray(value) ? value[0] : value;
  return SWITCHABLE_PLAN_AREAS.find((area) => area === wert) ?? null;
}
