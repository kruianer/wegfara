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
 * Der Zeitpuffer eines Transfers (req-073): was von der Luecke uebrig
 * bleibt, wenn die Fahrzeit abgezogen ist. Er steht immer am Transfer-Block
 * -- auch dann, wenn die Zeit reicht.
 */
export interface Zeitpuffer {
  /** Luecke minus Fahrzeit, in Minuten. */
  minuten: number;
  /** Die Zahl mit Vorzeichen: `+25 Min`, `−15 Min`, `±0 Min`. */
  text: string;
  /** Ob die Zeit reicht -- genaues Aufgehen gilt weiterhin als passend. */
  passt: boolean;
}

/**
 * Der Zeitpuffer als Zahl mit Vorzeichen. Das Vorzeichen traegt dieselbe
 * Aussage wie die Farbe, mit der die Anzeige steht -- ohne Farbunterschied
 * bleibt sie damit eindeutig (req-073).
 */
export function zeitpuffer(luecke: number, durationMin: number): Zeitpuffer {
  const minuten = luecke - durationMin;
  return {
    minuten,
    text:
      minuten === 0
        ? "±0 Min"
        : minuten > 0
          ? `+${minuten} Min`
          : `−${-minuten} Min`,
    passt: passtInLuecke(luecke, durationMin),
  };
}

/**
 * Die Zeitangaben sind Ortszeit am Reiseziel und werden nicht umgerechnet
 * (siehe bug-004) -- fuer die Differenz zweier Angaben desselben Tages
 * genuegt deshalb die schlichte Auslegung als lokale Zeit.
 */
function alsZeit(value: string): number {
  return new Date(value).getTime();
}
