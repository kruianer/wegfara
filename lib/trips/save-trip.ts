import type { Trip } from "./types";
import type { TripInput } from "./validate";
import type { TripParticipant } from "../trip-participants/types";

const TRIPS_API = "/api/trips";

/**
 * Die gespeicherte Reise und, beim Anlegen, die Zuordnung des Anlegenden
 * als Reiseleiter (req-021). Beim Aendern bleibt sie null -- die Zuordnungen
 * einer bestehenden Reise ruehrt das Formular nicht an.
 */
export interface SavedTrip {
  trip: Trip;
  tripParticipant: TripParticipant | null;
}

async function sendTrip(
  method: "POST" | "PUT",
  body: unknown,
): Promise<SavedTrip | null> {
  let response: Response;
  try {
    response = await fetch(TRIPS_API, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    return null;
  }

  if (!response.ok) return null;

  try {
    const payload = (await response.json()) as {
      trip: Trip;
      tripParticipant?: TripParticipant | null;
    };
    if (!payload.trip) return null;
    return {
      trip: payload.trip,
      tripParticipant: payload.tripParticipant ?? null,
    };
  } catch {
    return null;
  }
}

/**
 * Legt eine neue Reise an (siehe req-017). Liefert null, wenn das Anlegen
 * fehlschlaegt -- der Aufrufer laesst das Formular dann offen stehen und
 * weist darauf hin, statt einen Verlust der Eingaben zu riskieren.
 */
export function saveNewTrip(input: TripInput): Promise<SavedTrip | null> {
  return sendTrip("POST", input);
}

/** Korrigiert Titel, Zeitraum und Hauptort einer Reise (siehe req-017). */
export function saveTripChanges(
  tripId: string,
  input: TripInput,
): Promise<SavedTrip | null> {
  return sendTrip("PUT", { id: tripId, ...input });
}

/**
 * Loescht eine Reise samt aller daran haengenden Daten (siehe req-017).
 * Liefert false, wenn das Loeschen fehlschlaegt.
 */
export async function removeTrip(tripId: string): Promise<boolean> {
  try {
    const response = await fetch(TRIPS_API, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: tripId }),
    });
    return response.ok;
  } catch {
    return false;
  }
}
