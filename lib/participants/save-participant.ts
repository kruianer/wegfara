import type { Participant } from "./types";
import type { ParticipantDraft, ParticipantFieldErrors } from "./validate";

const PARTICIPANTS_API = "/api/participants";

/**
 * Das Ergebnis eines Speicherversuchs (req-019). Bei `ok: false` benennen
 * die Rueckmeldungen die betroffene Stelle; ein leeres `errors` heisst,
 * dass der Versuch gar nicht bis zur Pruefung kam -- dann bleiben die
 * Eingaben stehen und die Karte weist darauf hin.
 */
export type ParticipantSaveResult =
  | { ok: true; participant: Participant }
  | { ok: false; errors: ParticipantFieldErrors };

async function send(
  method: "POST" | "PUT",
  body: unknown,
): Promise<ParticipantSaveResult> {
  let response: Response;
  try {
    response = await fetch(PARTICIPANTS_API, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    return { ok: false, errors: {} };
  }

  try {
    const payload = (await response.json()) as {
      participant?: Participant;
      errors?: ParticipantFieldErrors;
    };
    if (response.ok && payload.participant) {
      return { ok: true, participant: payload.participant };
    }
    return { ok: false, errors: payload.errors ?? {} };
  } catch {
    return { ok: false, errors: {} };
  }
}

/** Legt eine Person im Account an (siehe req-019). */
export function saveNewParticipant(
  draft: ParticipantDraft,
): Promise<ParticipantSaveResult> {
  return send("POST", draft);
}

/** Aendert Name und Kontaktdaten einer Person (siehe req-019). */
export function saveParticipantChanges(
  id: string,
  draft: ParticipantDraft,
): Promise<ParticipantSaveResult> {
  return send("PUT", { id, ...draft });
}

/** Warum eine Person nicht entfernt werden konnte (req-038). */
export const PARTICIPANT_DELETE_FAILED =
  "Die Person konnte nicht entfernt werden.";

export type ParticipantDeleteResult =
  | { ok: true }
  | { ok: false; message: string };

/**
 * Entfernt eine Person (req-019). Der letzte Bereichs-Admin bleibt
 * (req-038) -- die Abweisung kommt vom Server und wird als Text
 * weitergereicht, damit die Oberflaeche den Grund nennen kann statt bloss
 * "hat nicht geklappt".
 */
export async function deleteParticipantRequest(
  id: string,
): Promise<ParticipantDeleteResult> {
  let response: Response;
  try {
    response = await fetch(PARTICIPANTS_API, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
  } catch {
    return { ok: false, message: PARTICIPANT_DELETE_FAILED };
  }
  if (response.ok) return { ok: true };

  try {
    const payload = (await response.json()) as { message?: string };
    return {
      ok: false,
      message: payload.message ?? PARTICIPANT_DELETE_FAILED,
    };
  } catch {
    return { ok: false, message: PARTICIPANT_DELETE_FAILED };
  }
}
