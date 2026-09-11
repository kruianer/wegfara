import type { Bewertungsrunde } from "./types";

/**
 * Der Stand einer ganzen Bewertungsrunde, wie ihn der Bereich "Bewertungen"
 * des Planers zeigt (req-063) -- ohne UI-Bezug, damit die Rechnung ohne
 * laufendes Next.js pruefbar bleibt (siehe delivery/stack.md, Conventions).
 *
 * Der Stand eines einzelnen POI steht in stand.ts; hier geht es um die Runde
 * als Ganzes: welche gezeigt wird, und in welcher Reihenfolge ihre POIs
 * stehen.
 */

/**
 * Die Runde, die der Bereich zeigt: die laufende, sonst die zuletzt beendete
 * (req-063). Zu einer Reise laeuft hoechstens eine (req-054); mehrere Runden
 * nebeneinander zeigt der Bereich nie.
 *
 * `runden` sind die Runden genau einer Reise -- gefiltert wird davor.
 */
export function anzuzeigendeRunde(
  runden: Bewertungsrunde[],
): Bewertungsrunde | null {
  return (
    runden.find((runde) => runde.status === "laeuft") ??
    // Beendet heisst: sie hat einen Zeitpunkt des Beendens. Fehlt er wider
    // Erwarten, zaehlt der Start -- sortiert wird nie nach nichts.
    runden
      .slice()
      .sort((a, b) =>
        (b.endedAt ?? b.startedAt).localeCompare(a.endedAt ?? a.startedAt),
      )[0] ??
    null
  );
}
