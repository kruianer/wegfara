import type { PoiPosition, PoiType, PoiTypeFilter } from "./types";
import {
  boundingBox,
  isInsideArea,
  searchAreaCenter,
  approximateExtentKm,
  type BoundingBox,
} from "./search-area";
import { POI_TYPE_LABEL } from "./type-meta";

const DEFAULT_MAX_SUGGESTIONS = 10;

export interface PoiDraft {
  name: string;
  ort: string;
  type: PoiType;
  position: PoiPosition;
  web?: string;
}

export interface LookedUpPlace {
  name: string;
  ort: string;
  position: PoiPosition;
  type: PoiType | null;
  web?: string;
}

/** Die drei austauschbaren Aussenanbindungen der KI-Suche (siehe req-014). */
export interface AiSearchDeps {
  describeRegion: (lat: number, lng: number) => Promise<string | null>;
  suggestNames: (prompt: string) => Promise<string | null>;
  lookupPlace: (
    name: string,
    bbox: BoundingBox,
    allowedTypes: PoiType[] | null,
  ) => Promise<LookedUpPlace | null>;
}

export interface AiSearchParams {
  searchArea: PoiPosition[];
  typeFilter: PoiTypeFilter;
  wish: string;
  /** Namen der in der Reise bereits vorhandenen POIs (siehe req-014: "andere vorschlagen"). */
  existingNames: string[];
}

export interface AiSearchOutcome {
  drafts: PoiDraft[];
  discardedCount: number;
}

/** Erste im Text genannte Zahl als gewuenschte Trefferzahl (siehe req-014). */
export function extractRequestedCount(wish: string): number | null {
  const match = wish.match(/\d+/);
  if (!match) return null;
  const value = Number.parseInt(match[0], 10);
  return value > 0 ? value : null;
}

function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}

/** Liest die von der KI vorgeschlagenen Namen aus ihrer Textantwort. */
export function parseSuggestedNames(raw: string): string[] {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/, "")
    .trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    return [];
  }

  const names = (parsed as Record<string, unknown> | null)?.names;
  if (!Array.isArray(names)) return [];
  return names
    .filter((n): n is string => typeof n === "string" && n.trim().length > 0)
    .map((n) => n.trim());
}

function buildPrompt(params: {
  regionDescription: string;
  widthKm: number;
  heightKm: number;
  allowedTypes: PoiType[] | null;
  wish: string;
  maxCount: number;
  existingNames: string[];
}): string {
  const lines = [
    `Du hilfst bei der Reiseplanung. Schlage bis zu ${params.maxCount} sehenswerte Orte in folgendem Gebiet vor:`,
    `Region: ${params.regionDescription}`,
    `Ausdehnung: ca. ${Math.round(params.widthKm)} x ${Math.round(params.heightKm)} km`,
  ];
  if (params.allowedTypes) {
    lines.push(
      `Beschraenke dich auf diese Art von Orten: ${params.allowedTypes.map((t) => POI_TYPE_LABEL[t]).join(", ")}.`,
    );
  }
  if (params.wish.trim()) {
    lines.push(`Beruecksichtige diesen Wunsch: "${params.wish.trim()}"`);
  }
  if (params.existingNames.length > 0) {
    lines.push(
      `Diese Orte sind bereits bekannt, schlage andere vor: ${params.existingNames.join(", ")}.`,
    );
  }
  lines.push(
    `Antworte ausschliesslich als JSON-Objekt der Form {"names": ["Ortsname 1", "Ortsname 2"]}, ohne weiteren Text.`,
  );
  return lines.join("\n");
}

/**
 * Fuehrt die vierstufige KI-Suche aus (siehe req-014, Funktion). Liefert
 * null, wenn die Region- oder KI-Anfrage fehlschlaegt -- ein einzelner
 * nicht auffindbarer oder ausserhalb liegender Vorschlag entfaellt dagegen
 * nur fuer sich (discardedCount).
 */
export async function searchPoisWithAi(
  params: AiSearchParams,
  deps: AiSearchDeps,
): Promise<AiSearchOutcome | null> {
  const box = boundingBox(params.searchArea);
  const center = searchAreaCenter(params.searchArea);

  const regionDescription = await deps.describeRegion(center.lat, center.lng);
  if (!regionDescription) return null;

  const { widthKm, heightKm } = approximateExtentKm(params.searchArea);
  const allowedTypes: PoiType[] | null =
    params.typeFilter === "alle" ? null : [params.typeFilter];
  const maxCount =
    extractRequestedCount(params.wish) ?? DEFAULT_MAX_SUGGESTIONS;

  const prompt = buildPrompt({
    regionDescription,
    widthKm,
    heightKm,
    allowedTypes,
    wish: params.wish,
    maxCount,
    existingNames: params.existingNames,
  });

  const raw = await deps.suggestNames(prompt);
  if (raw === null) return null;

  const suggestedNames = parseSuggestedNames(raw).slice(0, maxCount);

  const seen = new Set(params.existingNames.map(normalizeName));
  const drafts: PoiDraft[] = [];
  let discardedCount = 0;

  for (const suggestedName of suggestedNames) {
    if (seen.has(normalizeName(suggestedName))) {
      discardedCount++;
      continue;
    }

    const place = await deps.lookupPlace(suggestedName, box, allowedTypes);
    if (!place || !isInsideArea(place.position, params.searchArea)) {
      discardedCount++;
      continue;
    }

    drafts.push({
      name: place.name,
      ort: place.ort,
      type: allowedTypes
        ? allowedTypes[0]
        : (place.type ?? "sehenswuerdigkeit"),
      position: place.position,
      web: place.web,
    });
    seen.add(normalizeName(place.name));
  }

  return { drafts, discardedCount };
}
