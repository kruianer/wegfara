import type { Poi, PoiStatus } from "../pois/types";
import {
  standInRunde,
  type BewertendePerson,
  type Bewertungsstand,
} from "./stand";
import type { Bewertungsrunde, Stimme, StimmWahl } from "./types";
import type { WahlAnzahl } from "./stand";

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

/**
 * Was eine Stimme zur Zustimmung beitraegt (req-063). Die Summe ueber alle
 * Stimmen eines POI ergibt die Reihenfolge der Zeilen -- sie ist eine
 * Rangfolge, keine Entscheidung: aus den Stimmen folgt nie ein Status
 * (req-054).
 */
export const STIMM_GEWICHT: Record<StimmWahl, number> = {
  unbedingt: 2,
  waere_schoen: 1,
  wenn_zeit: 0,
  lieber_nicht: -1,
  ohne_mich: -2,
};

/** Die Zustimmung zu einem POI: die gewichtete Summe seiner Stimmen. */
export function zustimmung(verteilung: WahlAnzahl[]): number {
  return verteilung.reduce(
    (summe, eintrag) => summe + STIMM_GEWICHT[eintrag.wahl] * eintrag.anzahl,
    0,
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
  /** Die gewichtete Summe seiner Stimmen -- danach ist sortiert. */
  zustimmung: number;
}

/**
 * Die Zeilen der Runde -- je POI eine, die hoechste Zustimmung oben
 * (req-063). Bei gleicher Zustimmung bleibt die Reihenfolge der Runde
 * stehen, in der die POIs ausgewaehlt wurden.
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
  return runde.poiIds
    .flatMap((poiId) => {
      const poi = pois.find((vorhanden) => vorhanden.id === poiId);
      if (!poi) return [];
      const stand = standInRunde(runde, poiId, stimmen, personen);
      return [
        {
          poiId,
          name: poi.name,
          status: poi.status,
          stand,
          zustimmung: zustimmung(stand.verteilung),
        },
      ];
    })
    .sort((a, b) => b.zustimmung - a.zustimmung);
}
