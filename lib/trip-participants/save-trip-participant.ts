import type { TripParticipant, TripRole } from "./types";

const TRIP_PARTICIPANTS_API = "/api/trip-participants";

/**
 * Das Ergebnis eines Versuchs, eine Zuordnung zu aendern (req-021).
 * `lastLeader` heisst: es waere der letzte Reiseleiter der Reise gewesen --
 * die Karte nennt dann den Grund, statt kommentarlos nichts zu tun.
 */
export type TripParticipantFailureReason = "lastLeader" | "failed";

export type TripParticipantSaveResult =
  | { ok: true; tripParticipant: TripParticipant }
  | { ok: false; reason: TripParticipantFailureReason };

/**
 * Ordnet eine Person der Reise zu oder aendert ihre Rolle (siehe req-021).
 * Zuordnen und Entfernen sind Vorgaenge, bei denen der Nutzer eine
 * Bestaetigung erwartet -- sie werden sofort geschrieben, nicht verzoegert
 * (siehe delivery/stack.md, Conventions).
 */
export async function saveTripRole(
  tripId: string,
  participantId: string,
  role: TripRole,
): Promise<TripParticipantSaveResult> {
  let response: Response;
  try {
    response = await fetch(TRIP_PARTICIPANTS_API, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tripId, participantId, role }),
    });
  } catch {
    return { ok: false, reason: "failed" };
  }

  if (response.status === 409) return { ok: false, reason: "lastLeader" };

  try {
    const payload = (await response.json()) as {
      tripParticipant?: TripParticipant;
    };
    if (response.ok && payload.tripParticipant) {
      return { ok: true, tripParticipant: payload.tripParticipant };
    }
  } catch {
    return { ok: false, reason: "failed" };
  }
  return { ok: false, reason: "failed" };
}

/** Nimmt eine Person aus der Reise (siehe req-021). */
export async function removeFromTrip(
  tripId: string,
  participantId: string,
): Promise<{ ok: true } | { ok: false; reason: TripParticipantFailureReason }> {
  let response: Response;
  try {
    response = await fetch(TRIP_PARTICIPANTS_API, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tripId, participantId }),
    });
  } catch {
    return { ok: false, reason: "failed" };
  }

  if (response.ok) return { ok: true };
  return {
    ok: false,
    reason: response.status === 409 ? "lastLeader" : "failed",
  };
}
