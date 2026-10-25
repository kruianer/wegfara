import type { Verzug } from "./types";
import { lokaleZeit, uhrzeit } from "./zeit";

/**
 * Ab dieser Fahrzeit gilt die Gruppe als zu spaet (req-051): wer am Ort ist
 * oder weniger als 5 Minuten entfernt, ist im Zeitplan.
 */
export const IM_ZEITPLAN_UNTER_MIN = 5;

export const IM_ZEITPLAN_TEXT = "Im Zeitplan";

/** Der Hinweis, wenn der Routing-Dienst nicht erreichbar ist (req-051). */
export const VERZUG_UNBEKANNT_TEXT = "Verzug gerade nicht ermittelbar";

/**
 * Der Verzug aus der Fahrzeit von der eigenen Position zum Ort des
 * geplanten Programmpunkts, auf ganze Minuten gerundet. `null` heisst: der
 * Routing-Dienst hat nichts geliefert.
 *
 * Ueber "im Zeitplan" entscheidet die gerundete Minute -- dieselbe Zahl,
 * die in der Pille steht. Andernfalls koennte dort "5 Min zu spaet" neben
 * der Aussage stehen, die Gruppe sei im Zeitplan.
 */
export function verzugAusFahrzeit(
  fahrzeitMinuten: number | null,
  ermitteltAm: number | null = null,
): Verzug {
  if (fahrzeitMinuten === null || !Number.isFinite(fahrzeitMinuten)) {
    return { art: "unbekannt" };
  }

  // Eine Fahrzeit aus einer frueheren Abfrage nennt ihren Stand (bug-067).
  const stand =
    ermitteltAm === null ? {} : { stand: new Date(ermitteltAm).toISOString() };
  const minuten = Math.round(Math.max(fahrzeitMinuten, 0));
  return minuten < IM_ZEITPLAN_UNTER_MIN
    ? { art: "im_zeitplan", ...stand }
    : { art: "verspaetet", minuten, ...stand };
}

/**
 * Was in der Status-Pille steht -- null, wenn es gar keine gibt (kein
 * Standort oder kein laufender Programmpunkt).
 */
export function verzugText(verzug: Verzug): string | null {
  switch (verzug.art) {
    case "im_zeitplan":
      return IM_ZEITPLAN_TEXT + standText(verzug.stand);
    case "verspaetet":
      return `${verzug.minuten} Min zu spät` + standText(verzug.stand);
    case "unbekannt":
      return VERZUG_UNBEKANNT_TEXT;
    case "keiner":
      return null;
  }
}

/**
 * Der Zusatz zu einer Fahrzeit aus einer frueheren Abfrage (bug-067), in der
 * Uhrzeit des Geraets -- dort wird der Text gebaut.
 */
function standText(stand: string | undefined): string {
  if (stand === undefined) return "";
  const zeitpunkt = new Date(stand);
  if (Number.isNaN(zeitpunkt.getTime())) return "";
  return ` · Stand ${uhrzeit(lokaleZeit(zeitpunkt))}`;
}
