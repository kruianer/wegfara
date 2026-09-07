import type { Fahrstrecke, RoutingClient, Wegpunkt } from "./client";

/**
 * OSRM auf OpenStreetMap-Daten -- Open Source, ohne Zugangsschluessel
 * (req-051, Constraints). An Google gehen dabei keine Positionen.
 *
 * Die Adresse steht an genau dieser Stelle und ist ueber OSRM_BASE_URL
 * uebersteuerbar: laeuft OSRM spaeter selbst auf dem Beelink, genuegt die
 * Umgebungsvariable, ohne dass sich am Quelltext etwas aendert.
 */
const DEFAULT_BASE_URL = "https://router.project-osrm.org";

export interface OsrmOptions {
  /** Die Adresse des Dienstes; ohne Angabe die aus der Umgebung. */
  baseUrl?: string;
  /**
   * Wird ausschliesslich von Tests gesetzt, um ohne echten Netzwerkzugriff
   * zu laufen (siehe stack.md: externe Dienste werden gemockt).
   */
  fetch?: typeof fetch;
}

export function createOsrmClient({
  baseUrl,
  fetch: fetchImpl,
}: OsrmOptions = {}): RoutingClient {
  const base = (baseUrl ?? environmentOsrmBaseUrl()).replace(/\/+$/, "");
  const holen = fetchImpl ?? fetch;

  /** Die Antwort des Dienstes zur Route; null, wenn keine zu haben ist. */
  async function routenAntwort(
    von: Wegpunkt,
    nach: Wegpunkt,
  ): Promise<unknown | null> {
    // OSRM erwartet die Koordinaten als "Laenge,Breite" -- umgekehrt zur
    // Schreibweise, die sonst im Projekt gilt.
    const url =
      `${base}/route/v1/driving/` +
      `${von.lng},${von.lat};${nach.lng},${nach.lat}` +
      `?overview=false&alternatives=false`;

    let response: Response;
    try {
      response = await holen(url);
    } catch {
      return null;
    }

    if (!response.ok) return null;

    try {
      return await response.json();
    } catch {
      return null;
    }
  }

  return {
    async fahrzeitMinuten(
      von: Wegpunkt,
      nach: Wegpunkt,
    ): Promise<number | null> {
      return fahrzeitAus(await routenAntwort(von, nach));
    },

    async strecke(von: Wegpunkt, nach: Wegpunkt): Promise<Fahrstrecke | null> {
      const body = await routenAntwort(von, nach);
      const dauerMinuten = fahrzeitAus(body);
      const distanzKm = laengeAus(body);
      if (dauerMinuten === null || distanzKm === null) return null;

      return { dauerMinuten, distanzKm };
    },
  };
}

/** Die erste Route der Antwort; null, wenn die Antwort keine hergibt. */
function ersteRoute(
  body: unknown,
): { duration?: unknown; distance?: unknown } | null {
  const record = body as { code?: unknown; routes?: unknown } | null;
  if (record?.code !== "Ok" || !Array.isArray(record.routes)) return null;

  return (record.routes[0] as { duration?: unknown } | undefined) ?? null;
}

/** Die Dauer der ersten Route in Minuten; null, wenn die Antwort keine hergibt. */
function fahrzeitAus(body: unknown): number | null {
  const duration = ersteRoute(body)?.duration;
  if (typeof duration !== "number" || !Number.isFinite(duration)) return null;

  return duration / 60;
}

/** Die Laenge der ersten Route in Kilometern (req-052). */
function laengeAus(body: unknown): number | null {
  const distance = ersteRoute(body)?.distance;
  if (typeof distance !== "number" || !Number.isFinite(distance)) return null;

  return distance / 1000;
}

/** Die Adresse des Routing-Dienstes aus der Umgebung, sonst die oeffentliche. */
export function environmentOsrmBaseUrl(): string {
  const url = process.env.OSRM_BASE_URL;
  return url && url.length > 0 ? url : DEFAULT_BASE_URL;
}
