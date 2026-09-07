import type { Activity } from "@/lib/activities/types";

/**
 * Die Luecke zwischen zwei Programmpunkten und die Frage, ob die Fahrzeit
 * hineinpasst (req-052). Passt sie nicht, wird der Transfer trotzdem
 * angelegt -- mit einem sichtbaren Hinweis. Umgeplant wird nichts von
 * selbst (siehe vision.md).
 */

/** Minuten zwischen dem Ende des einen und dem Beginn des naechsten Punktes. */
export function lueckeMinuten(
  from: Pick<Activity, "endAt">,
  to: Pick<Activity, "startAt">,
): number {
  return Math.round((alsZeit(to.startAt) - alsZeit(from.endAt)) / 60000);
}

/** Ob die Fahrzeit in die Luecke passt -- genau aufgehen darf sie. */
export function passtInLuecke(luecke: number, durationMin: number): boolean {
  return durationMin <= luecke;
}

/**
 * Der Hinweis, dass die Zeit nicht reicht; null, wenn sie reicht. Er steht
 * am Transfer-Block wie im Formular -- an beiden Stellen derselbe Satz.
 */
export function zeitreichtNichtHinweis(
  luecke: number,
  durationMin: number,
): string | null {
  if (passtInLuecke(luecke, durationMin)) return null;

  return luecke <= 0
    ? `Die Zeit reicht nicht: zwischen den beiden Programmpunkten liegt keine Lücke, die Fahrzeit beträgt ${durationMin} Min.`
    : `Die Zeit reicht nicht: zwischen den beiden Programmpunkten liegen ${luecke} Min, die Fahrzeit beträgt ${durationMin} Min.`;
}

/**
 * Die Zeitangaben sind Ortszeit am Reiseziel und werden nicht umgerechnet
 * (siehe bug-004) -- fuer die Differenz zweier Angaben desselben Tages
 * genuegt deshalb die schlichte Auslegung als lokale Zeit.
 */
function alsZeit(value: string): number {
  return new Date(value).getTime();
}
