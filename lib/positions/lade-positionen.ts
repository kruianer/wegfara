import type { GeteiltePosition } from "./types";

/** Eine geteilte Position mit dem Anzeigenamen ihres Teilnehmers. */
export interface BenanntePosition extends GeteiltePosition {
  name: string;
}

/**
 * Holt die geteilten Positionen einer Reise vom Server (req-050). Ein
 * Fehler oder eine leere Antwort ergibt eine leere Liste -- die Karte zeigt
 * dann einfach keine Punkte, statt einen Fehlerzustand.
 */
export async function ladePositionen(
  tripId: string,
  signal?: AbortSignal,
): Promise<BenanntePosition[]> {
  let antwort: Response;
  try {
    antwort = await fetch(
      `/api/positionen?reise=${encodeURIComponent(tripId)}`,
      { signal },
    );
  } catch {
    return [];
  }

  if (!antwort.ok) return [];

  try {
    const body = (await antwort.json()) as { positionen?: unknown };
    return Array.isArray(body.positionen)
      ? (body.positionen as BenanntePosition[])
      : [];
  } catch {
    return [];
  }
}
