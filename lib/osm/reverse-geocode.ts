import { OPERATOR_EMAIL } from "@/lib/operator";

const BASE_URL = "https://nominatim.openstreetmap.org/reverse";

/**
 * Liefert den Namen der Region, in der die Koordinate liegt (siehe req-014,
 * Schritt 1), oder null, wenn Nominatim nicht erreichbar ist oder keine
 * brauchbare Adresse liefert. Nominatim verlangt einen identifizierenden
 * User-Agent (siehe Nominatim-Nutzungsbedingungen).
 */
export async function reverseGeocodeRegion(
  lat: number,
  lng: number,
): Promise<string | null> {
  const url = `${BASE_URL}?format=jsonv2&lat=${lat}&lon=${lng}&zoom=10&addressdetails=1`;

  let response: Response;
  try {
    response = await fetch(url, {
      headers: { "User-Agent": `wegfara (${OPERATOR_EMAIL})` },
    });
  } catch {
    return null;
  }

  if (!response.ok) return null;

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return null;
  }

  return extractRegionName(body);
}

function extractRegionName(body: unknown): string | null {
  const record = body as Record<string, unknown> | null;
  const address = record?.address as Record<string, unknown> | undefined;
  const region =
    (address?.county as string | undefined) ??
    (address?.state_district as string | undefined) ??
    (address?.state as string | undefined) ??
    (typeof record?.display_name === "string"
      ? (record.display_name as string)
      : undefined);
  return region ?? null;
}
