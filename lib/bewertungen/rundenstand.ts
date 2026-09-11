import type { Poi, PoiStatus } from "../pois/types";
import {
  standInRunde,
  type BewertendePerson,
  type Bewertungsstand,
} from "./stand";
import type { Bewertungsrunde, Stimme } from "./types";

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

/** Eine Zeile des Bereichs: ein POI der Runde mit seinem Stand. */
export interface RundenZeile {
  poiId: string;
  /** Der Name des POI, wie er in der Zeile steht. */
  name: string;
  /** Sein Status -- er beschreibt den Ort, nicht die Stimmen (req-054). */
  status: PoiStatus;
  /** Verteilung, wer wie gestimmt hat und wer noch fehlt (siehe stand.ts). */
  stand: Bewertungsstand;
}

/**
 * Die Zeilen der Runde -- je POI eine (req-063).
 *
 * Ein POI, den es nicht mehr gibt, bekommt keine Zeile: die Runde haelt nur
 * seine Kennung, und ein geloeschter POI verschwindet damit aus dem Bereich.
 *
 * `personen` sind die Teilnehmer der Reise -- aus ihnen ergibt sich, wer noch
 * nicht gestimmt hat.
 */
export function rundenzeilen(
  runde: Bewertungsrunde,
  pois: Pick<Poi, "id" | "name" | "status">[],
  stimmen: Stimme[] = [],
  personen: BewertendePerson[] = [],
): RundenZeile[] {
  return runde.poiIds.flatMap((poiId) => {
    const poi = pois.find((vorhanden) => vorhanden.id === poiId);
    if (!poi) return [];
    return [
      {
        poiId,
        name: poi.name,
        status: poi.status,
        stand: standInRunde(runde, poiId, stimmen, personen),
      },
    ];
  });
}
