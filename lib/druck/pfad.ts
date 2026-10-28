import { PLANER_PATH } from "../einstieg/ziel";

/**
 * Die Adresse des Reiseplans zum Ausdrucken (req-080). Sie liegt im Planer:
 * das Heft entsteht aus dem fertigen Plan, und wer es oeffnet, ist der
 * Reiseleiter.
 *
 * Sie steht an genau einer Stelle -- der Bereich "Drucken" verweist darauf
 * (req-103), und der Weg dorthin soll sich nicht an zwei Orten aendern
 * muessen. Seit req-103 ist der Bereich der gewoehnliche Weg zum Plan; die
 * eigene Adresse bleibt fuer den, der ihn verschicken oder fuer sich oeffnen
 * will.
 */
export const REISEPLAN_DRUCK_PATH = `${PLANER_PATH}/reiseplan`;

export function reiseplanDruckPath(tripId: string): string {
  return `${REISEPLAN_DRUCK_PATH}/${tripId}`;
}
