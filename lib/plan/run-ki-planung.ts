import type { Activity } from "@/lib/activities/types";
import type { Transfer } from "@/lib/transfers/types";
import type { Planvorschlag, VorschlagPunkt } from "./ki-planung";

/**
 * Der Weg der Oberflaeche zur Planung (req-056). Sie laeuft ueber den
 * Server: dort liegen der Zugangsschluessel des Accounts (req-028) und der
 * Routing-Dienst, den ein Browser spaeter nicht mehr erreicht (req-051).
 */

const KI_PLANUNG_API = "/api/ki-planung";

export type PlanungsErgebnis =
  | { kind: "vorschlag"; vorschlag: Planvorschlag }
  /** Es gibt keine POIs mit Status "Gesetzt" oder "Wahrscheinlich" (req-056). */
  | { kind: "nichts_zu_verplanen" }
  /** Der Lauf ist fehlgeschlagen -- der Plan bleibt unveraendert. */
  | { kind: "fehler" };

/**
 * Loest einen Planungslauf aus. `signal` bricht ihn ab: der Vorgang endet
 * dann ohne Ergebnis, und weil nichts gespeichert wurde, bleibt der Plan
 * unveraendert (req-056).
 */
export async function planeMitKi(
  tripId: string,
  neuOrdnen: boolean,
  signal?: AbortSignal,
): Promise<PlanungsErgebnis> {
  let response: Response;
  try {
    response = await fetch(KI_PLANUNG_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tripId, neuOrdnen }),
      signal,
    });
  } catch {
    return { kind: "fehler" };
  }

  if (!response.ok) return { kind: "fehler" };

  try {
    const payload = (await response.json()) as {
      vorschlag?: Planvorschlag | null;
      grund?: string;
    };
    if (!payload.vorschlag) {
      return payload.grund === "nichts_zu_verplanen"
        ? { kind: "nichts_zu_verplanen" }
        : { kind: "fehler" };
    }
    return { kind: "vorschlag", vorschlag: payload.vorschlag };
  } catch {
    return { kind: "fehler" };
  }
}

/** Was das Uebernehmen angelegt und verschoben hat (req-056). */
export interface UebernahmeErgebnis {
  activities: Activity[];
  transfers: Transfer[];
}

/**
 * Uebernimmt den Vorschlag: erst hier wird gespeichert, und dabei entstehen
 * auch die Transfers (req-052). Liefert null, wenn das fehlschlaegt -- der
 * Vorschlag bleibt dann stehen.
 */
export async function uebernimmVorschlag(
  tripId: string,
  punkte: VorschlagPunkt[],
): Promise<UebernahmeErgebnis | null> {
  let response: Response;
  try {
    response = await fetch(KI_PLANUNG_API, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tripId,
        // Nur, was der Server ohnehin prueft: welcher POI oder welcher
        // Programmpunkt wann beginnt (req-024).
        punkte: punkte.map((punkt) => ({
          activityId: punkt.activityId,
          poiId: punkt.poiId,
          startAt: punkt.startAt,
          unveraendert: punkt.unveraendert,
        })),
      }),
    });
  } catch {
    return null;
  }

  if (!response.ok) return null;

  try {
    const payload = (await response.json()) as Partial<UebernahmeErgebnis>;
    return {
      activities: payload.activities ?? [],
      transfers: payload.transfers ?? [],
    };
  } catch {
    return null;
  }
}
