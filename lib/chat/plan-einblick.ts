import type { PlanWerkzeug } from "../ai/chat-client";

/**
 * Wie der Verlauf sagt, dass der Chat in den Plan gesehen hat (req-093) --
 * damit eine Antwort nachvollziehbar bleibt und sich von einer geratenen
 * unterscheidet. Ein Blick in den eigenen Plan ist keine Quelle im Netz und
 * steht deshalb nicht zwischen den Adressen der Web-Suche, sondern als leiser
 * Hinweis am Eintrag, in der Art von "sucht im Web …" (req-092).
 */

/** Wohin der Chat sieht, in der Form, die nach "in" passt. */
export const PLAN_EINBLICK_ZIEL: Record<PlanWerkzeug, string> = {
  reise_lesen: "die Reisedaten",
  pois_lesen: "die POI-Sammlung",
  tagesplan_lesen: "den Tagesplan",
  kosten_lesen: "die Kosten",
};

/** Waehrend der Chat gerade nachsieht. */
export function siehtInText(werkzeug: PlanWerkzeug): string {
  return `sieht in ${PLAN_EINBLICK_ZIEL[werkzeug]} …`;
}

/**
 * An der fertigen Antwort: worin sie nachgesehen hat, je Teil einmal, in der
 * Reihenfolge des ersten Blicks. Ohne Blick steht nichts da.
 */
export function gesehenText(werkzeuge: readonly PlanWerkzeug[]): string | null {
  const ziele = [...new Set(werkzeuge)].map(
    (werkzeug) => PLAN_EINBLICK_ZIEL[werkzeug],
  );
  if (ziele.length === 0) return null;
  const aufgezaehlt =
    ziele.length === 1
      ? ziele[0]
      : `${ziele.slice(0, -1).join(", ")} und ${ziele.at(-1)}`;
  return `hat in ${aufgezaehlt} gesehen`;
}
