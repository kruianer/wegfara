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

/**
 * Entfernt eine Person (siehe req-019). Liefert false, wenn das Entfernen
 * fehlschlaegt.
 */
export async function removeParticipant(id: string): Promise<boolean> {
  try {
    const response = await fetch(PARTICIPANTS_API, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    return response.ok;
  } catch {
    return false;
  }
}
