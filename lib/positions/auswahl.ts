import type { TripParticipant } from "@/lib/trip-participants/types";
import type { GeteiltePosition } from "./types";

/**
 * Wie alt eine geteilte Position hoechstens sein darf, um noch zu zaehlen.
 * Eine alte Position ist schlechter als keine -- sie taeuscht einen Verzug
 * vor, den es nicht mehr gibt.
 */
export const POSITION_HOECHSTALTER_MIN = 15;

export interface PositionsWahl {
  tripId: string;
  /** Die angemeldete Person -- ihre eigene Position geht vor. */
  selbstId: string;
  /** Wer bei welcher Reise mitfaehrt und in welcher Rolle (req-021). */
  zuordnungen: TripParticipant[];
  jetzt: Date;
}

/**
 * Welche Position dem Live-Status zugrunde liegt (req-051): meine eigene,
 * sofern ich sie teile; sonst die des Reiseleiters -- die Gruppe reist
 * zusammen. Teilt auch er nicht, gibt es keine, und damit keinen Verzug.
 *
 * Fuehren mehrere Personen die Reise, gilt die juengste ihrer Positionen.
 */
export function positionFuerLiveStatus(
  positionen: GeteiltePosition[],
  { tripId, selbstId, zuordnungen, jetzt }: PositionsWahl,
): GeteiltePosition | null {
  const frisch = positionen.filter(
    (position) => position.tripId === tripId && !istVeraltet(position, jetzt),
  );

  const eigene = frisch.find((position) => position.participantId === selbstId);
  if (eigene) return eigene;

  const leiter = new Set(
    zuordnungen
      .filter(
        (zuordnung) =>
          zuordnung.tripId === tripId && zuordnung.role === "reiseleiter",
      )
      .map((zuordnung) => zuordnung.participantId),
  );

  const vonLeitern = frisch
    .filter((position) => leiter.has(position.participantId))
    .sort((a, b) => b.recordedAt.localeCompare(a.recordedAt));

  return vonLeitern[0] ?? null;
}

function istVeraltet(position: GeteiltePosition, jetzt: Date): boolean {
  const alterMin =
    (jetzt.getTime() - new Date(position.recordedAt).getTime()) / 60_000;
  return !Number.isFinite(alterMin) || alterMin > POSITION_HOECHSTALTER_MIN;
}
