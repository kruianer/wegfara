import type { BoundingBox } from "@/lib/pois/search-area";
import type { PoiPosition, PoiType } from "@/lib/pois/types";
import { mapOsmTagsToType, POI_TYPE_OSM_TAGS } from "./type-mapping";

const BASE_URL = "https://overpass-api.de/api/interpreter";

export interface OsmPlace {
  name: string;
  ort: string;
  position: PoiPosition;
  type: PoiType | null;
  web?: string;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildQuery(
  name: string,
  bbox: BoundingBox,
  allowedTypes: PoiType[] | null,
): string {
  const bboxStr = `${bbox.minLat},${bbox.minLng},${bbox.maxLat},${bbox.maxLng}`;
  const nameFilter = `["name"~"^${escapeRegex(name)}$",i]`;

  const clauses =
    allowedTypes === null
      ? [`nwr${nameFilter}(${bboxStr});`]
      : allowedTypes
          .flatMap((type) => POI_TYPE_OSM_TAGS[type])
          .map(
            ([key, value]) =>
              `nwr${nameFilter}["${key}"="${value}"](${bboxStr});`,
          );

  return `[out:json][timeout:25];(${clauses.join("")});out center 1;`;
}

interface OverpassElement {
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

function toPlace(element: OverpassElement): OsmPlace | null {
  const tags = element.tags ?? {};
  const name = tags.name;
  const lat = element.lat ?? element.center?.lat;
  const lng = element.lon ?? element.center?.lon;
  if (!name || typeof lat !== "number" || typeof lng !== "number") {
    return null;
  }

  const ort =
    tags["addr:city"] ??
    tags["addr:town"] ??
    tags["addr:village"] ??
    tags["addr:hamlet"] ??
    "";

  return {
    name,
    ort,
    position: { lat, lng },
    type: mapOsmTagsToType(tags),
    web: tags.website ?? tags["contact:website"],
  };
}

/**
 * Schlaegt einen vorgeschlagenen Ort in den Kartendaten nach (siehe req-014,
 * Schritt 3): gesucht wird per Name innerhalb der Bounding-Box des
 * Suchgebiets, bei gesetztem Typfilter zusaetzlich auf dessen OSM-Tags
 * eingeschraenkt. Liefert null, wenn der Ort dort nicht gefunden wird oder
 * der Dienst nicht erreichbar ist.
 */
export async function findPlace(
  name: string,
  bbox: BoundingBox,
  allowedTypes: PoiType[] | null,
): Promise<OsmPlace | null> {
  const query = buildQuery(name, bbox, allowedTypes);

  let response: Response;
  try {
    response = await fetch(BASE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `data=${encodeURIComponent(query)}`,
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

  const elements = (body as Record<string, unknown> | null)?.elements;
  if (!Array.isArray(elements)) return null;

  for (const element of elements as OverpassElement[]) {
    const place = toPlace(element);
    if (place) return place;
  }
  return null;
}
