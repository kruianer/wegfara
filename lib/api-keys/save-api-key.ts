import type { ApiKeyKind, ApiKeyState } from "./types";

const API_KEY_API = "/api/zugangsschluessel";

/** Was die Karte meldet, wenn das Hinterlegen nicht geklappt hat (req-028). */
export const API_KEY_ERRORS = {
  failed: "Der Zugangsschlüssel konnte nicht gespeichert werden.",
  removeFailed: "Der Zugangsschlüssel konnte nicht entfernt werden.",
} as const;

export type ApiKeySaveResult =
  | { ok: true; keys: ApiKeyState[] }
  | { ok: false };

async function anfrage(
  method: "PUT" | "DELETE",
  body: unknown,
): Promise<ApiKeySaveResult> {
  let response: Response;
  try {
    response = await fetch(API_KEY_API, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    return { ok: false };
  }

  if (!response.ok) return { ok: false };

  try {
    const payload = (await response.json()) as { keys?: ApiKeyState[] };
    if (payload.keys) return { ok: true, keys: payload.keys };
  } catch {
    return { ok: false };
  }
  return { ok: false };
}

/**
 * Hinterlegt einen Zugangsschluessel oder ersetzt den vorhandenen (req-028).
 * Zurueck kommt nur der Zustand -- der Schluessel selbst nie wieder.
 *
 * Ein Vorgang, bei dem der Nutzer eine Bestaetigung erwartet: er wird sofort
 * geschrieben, nicht verzoegert (siehe delivery/stack.md, Conventions).
 */
export function saveApiKey(
  kind: ApiKeyKind,
  apiKey: string,
): Promise<ApiKeySaveResult> {
  return anfrage("PUT", { kind, key: apiKey });
}

/** Entfernt einen Zugangsschluessel; danach ist seine Funktion gesperrt. */
export function removeApiKey(kind: ApiKeyKind): Promise<ApiKeySaveResult> {
  return anfrage("DELETE", { kind });
}
