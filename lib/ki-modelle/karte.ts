import type { KiModellFeld, KiZweck } from "./zwecke";

/**
 * Der Browser-Anschluss der Karte "KI-Modelle" (req-108). Die Kataloge holt
 * der Server -- von hier geht keine Anfrage an einen KI-Dienst.
 */

const KI_MODELLE_API = "/api/ki-modelle";

/** Was die Karte meldet, wenn etwas nicht geklappt hat (bug-021). */
export const KI_MODELLE_FEHLER = {
  laden: "Die KI-Modelle ließen sich nicht laden.",
  speichern:
    "Die Wahl ließ sich nicht speichern. Sie steht noch da — versuche es erneut.",
} as const;

export type KiModelleErgebnis =
  | { ok: true; felder: KiModellFeld[] }
  | { ok: false; fehler: string };

async function anfrage(
  init: RequestInit | undefined,
  fehlerText: string,
): Promise<KiModelleErgebnis> {
  try {
    const response = await fetch(KI_MODELLE_API, init);
    const payload = (await response.json().catch(() => null)) as {
      felder?: KiModellFeld[];
      error?: string;
    } | null;
    if (response.ok && Array.isArray(payload?.felder)) {
      return { ok: true, felder: payload.felder };
    }
    return {
      ok: false,
      fehler:
        response.status === 409 && payload?.error ? payload.error : fehlerText,
    };
  } catch {
    return { ok: false, fehler: fehlerText };
  }
}

export function holeKiModelle(): Promise<KiModelleErgebnis> {
  return anfrage(undefined, KI_MODELLE_FEHLER.laden);
}

/** Setzt die Wahl eines Zwecks; null hebt sie auf. Sofort geschrieben. */
export function speichereKiModell(
  zweck: KiZweck,
  modell: string | null,
): Promise<KiModelleErgebnis> {
  return anfrage(
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ zweck, modell }),
    },
    KI_MODELLE_FEHLER.speichern,
  );
}
