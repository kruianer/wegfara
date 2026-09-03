import { TRIP_ROLES, type TripParticipant, type TripRole } from "./types";

/**
 * Die Regeln der Zuordnung zwischen Person und Reise (req-021). Sie stehen
 * hier ohne UI- und ohne Datenbankbezug, damit die Karte "Wer faehrt mit"
 * und die Schnittstelle dieselbe Regel anwenden -- ein Aufruf an der Karte
 * vorbei kann den letzten Reiseleiter genauso wenig entfernen wie ein Klick.
 */

export const TRIP_PARTICIPANT_ERRORS = {
  /** Eine Reise hat immer mindestens einen Reiseleiter (req-021). */
  lastLeader: "Die Reise braucht mindestens einen Reiseleiter.",
  failed: "Die Zuordnung konnte nicht gespeichert werden.",
} as const;

export function isTripRole(value: unknown): value is TripRole {
  return (
    typeof value === "string" &&
    (TRIP_ROLES as readonly string[]).includes(value)
  );
}

/** Die Zuordnungen einer einzelnen Reise, in unveraenderter Reihenfolge. */
export function tripAssignments(
  assignments: TripParticipant[],
  tripId: string,
): TripParticipant[] {
  return assignments.filter((assignment) => assignment.tripId === tripId);
}

/** Die Rolle einer Person in dieser Reise; null, wenn sie nicht mitfaehrt. */
export function roleInTrip(
  assignments: TripParticipant[],
  tripId: string,
  participantId: string,
): TripRole | null {
  const found = assignments.find(
    (assignment) =>
      assignment.tripId === tripId &&
      assignment.participantId === participantId,
  );
  return found ? found.role : null;
}

/** Ob diese Person der einzige Reiseleiter der Reise ist. */
export function isLastLeader(
  assignments: TripParticipant[],
  tripId: string,
  participantId: string,
): boolean {
  const leaders = tripAssignments(assignments, tripId).filter(
    (assignment) => assignment.role === "reiseleiter",
  );
  return leaders.length === 1 && leaders[0].participantId === participantId;
}

/**
 * Ob sich die Rolle so setzen laesst. Der letzte Reiseleiter laesst sich
 * nicht zum Teilnehmer herabstufen (req-021).
 */
export function canSetRole(
  assignments: TripParticipant[],
  tripId: string,
  participantId: string,
  role: TripRole,
): boolean {
  if (role === "reiseleiter") return true;
  return !isLastLeader(assignments, tripId, participantId);
}

/**
 * Ob sich die Person aus der Reise entfernen laesst. Der letzte Reiseleiter
 * bleibt zugeordnet (req-021).
 */
export function canRemoveFromTrip(
  assignments: TripParticipant[],
  tripId: string,
  participantId: string,
): boolean {
  return !isLastLeader(assignments, tripId, participantId);
}

/**
 * Die Zuordnungen mit dieser Person in dieser Rolle -- sie ersetzt eine
 * bestehende Zuordnung oder kommt hinten dazu. Eine Person kann derselben
 * Reise nur einmal zugeordnet sein (req-021, Constraints).
 */
export function withAssignment(
  assignments: TripParticipant[],
  tripId: string,
  participantId: string,
  role: TripRole,
): TripParticipant[] {
  const exists = assignments.some(
    (assignment) =>
      assignment.tripId === tripId &&
      assignment.participantId === participantId,
  );
  if (!exists) return [...assignments, { tripId, participantId, role }];

  return assignments.map((assignment) =>
    assignment.tripId === tripId && assignment.participantId === participantId
      ? { ...assignment, role }
      : assignment,
  );
}

/** Die Zuordnungen ohne diese Person in dieser Reise. */
export function withoutAssignment(
  assignments: TripParticipant[],
  tripId: string,
  participantId: string,
): TripParticipant[] {
  return assignments.filter(
    (assignment) =>
      assignment.tripId !== tripId ||
      assignment.participantId !== participantId,
  );
}

/** Die Zuordnungen ohne diese Person -- in allen Reisen. */
export function withoutParticipant(
  assignments: TripParticipant[],
  participantId: string,
): TripParticipant[] {
  return assignments.filter(
    (assignment) => assignment.participantId !== participantId,
  );
}

/**
 * Stellt fuer jede Reise sicher, dass sie einen Reiseleiter hat: hat eine
 * ihren letzten verloren -- etwa weil die Person aus dem Account entfernt
 * wurde --, ruecken die dienstaeltesten Verbliebenen nach (req-021). Reisen
 * ohne jede Zuordnung bleiben unberuehrt.
 *
 * Die Reihenfolge der Liste entscheidet, wer nachrueckt; sie folgt der
 * Reihenfolge der Personen im Account (siehe lib/db/trip-participants.ts).
 */
export function promoteLeadersWhereMissing(
  assignments: TripParticipant[],
): TripParticipant[] {
  // Reisen, die bereits einen Reiseleiter haben -- und, waehrend die Liste
  // durchlaufen wird, jene, die soeben einen bekommen haben.
  const led = new Set(
    assignments
      .filter((assignment) => assignment.role === "reiseleiter")
      .map((assignment) => assignment.tripId),
  );

  return assignments.map((assignment) => {
    if (led.has(assignment.tripId)) return assignment;
    led.add(assignment.tripId);
    return { ...assignment, role: "reiseleiter" as TripRole };
  });
}
