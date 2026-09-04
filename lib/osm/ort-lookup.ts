import { OPERATOR_EMAIL } from "@/lib/operator";
import { localityOf } from "./locality";
import type { OrtLookup } from "@/lib/pois/derive-ort";
import type { PoiPosition } from "@/lib/pois/types";

const SEARCH_URL = "https://nominatim.openstreetmap.org/search";
const REVERSE_URL = "https://nominatim.openstreetmap.org/reverse";

/**
 * Die Ortschaft zu einer Stelle wird bei Nominatim nachgeschlagen — ueber die
 * Anschrift oder ueber die Position (req-041). Nominatim verlangt einen
 * identifizierenden User-Agent (siehe Nominatim-Nutzungsbedingungen); seine
 * Abruffrequenz ist begrenzt, deshalb wird nur beim Speichern gefragt, nicht
 * bei jeder Eingabe.
 *
 * Jeder Fehlschlag — nicht erreichbar, unlesbare Antwort, kein Treffer —
 * endet in null: der Aufrufer laesst dann den gespeicherten Ort stehen.
 */
async function nominatim(url: string): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(url, {
      headers: { "User-Agent": `wegfara (${OPERATOR_EMAIL})` },
    });
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

function addressOf(body: unknown): Record<string, unknown> | undefined {
  const record = body as { address?: unknown } | null;
  const address = record?.address;
  return typeof address === "object" && address !== null
    ? (address as Record<string, unknown>)
    : undefined;
}

function ortOrNull(
  address: Record<string, unknown> | undefined,
): string | null {
  const ort = localityOf(address);
  return ort.length > 0 ? ort : null;
}

export const nominatimOrtLookup: OrtLookup = {
  async fromAddress(address: string): Promise<string | null> {
    const query = address.trim();
    if (query.length === 0) return null;

    const body = await nominatim(
      `${SEARCH_URL}?format=jsonv2&addressdetails=1&limit=1` +
        `&q=${encodeURIComponent(query)}`,
    );
    if (!Array.isArray(body) || body.length === 0) return null;
    return ortOrNull(addressOf(body[0]));
  },

  async fromPosition(position: PoiPosition): Promise<string | null> {
    // zoom=14 liegt auf der Ebene der Ortschaft; die Verwaltungsebenen
    // darueber stehen ohnehin in den Adressbestandteilen und werden von
    // localityOf uebergangen.
    const body = await nominatim(
      `${REVERSE_URL}?format=jsonv2&addressdetails=1&zoom=14` +
        `&lat=${position.lat}&lon=${position.lng}`,
    );
    return ortOrNull(addressOf(body));
  },
};
