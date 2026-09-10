import type { PoiPosition, PoiType, PoiTypeFilter } from "./types";
import {
  boundingBox,
  isInsideArea,
  searchAreaCenter,
  approximateExtentKm,
  type BoundingBox,
} from "./search-area";
import { POI_TYPE_LABEL } from "./type-meta";
import { mapGoogleTypesToPoiType } from "@/lib/google/type-mapping";
import { poiTextsFromGoogle } from "@/lib/google/description";
import type { GooglePlace } from "@/lib/google/types";
import {
  formatBewertung,
  INTERESSE_LABEL,
  type ReisePraeferenzen,
} from "@/lib/trips/praeferenzen";
import type { AiAntwort } from "@/lib/ai/client";
import type { AiSearchFehler } from "./ai-search-fehler";

/**
 * Wie viele Orte ein Lauf hoechstens vorschlaegt (req-057; bis dahin zehn).
 * Zugleich die harte Obergrenze: ein im Wunsch genannter groesserer Wert
 * hebt sie nicht auf.
 */
export const MAX_SUGGESTIONS = 20;

export interface PoiDraft {
  name: string;
  ort: string;
  type: PoiType;
  position: PoiPosition;
  web?: string;
  /** Die Beschreibung aus den Google-Angaben (req-044, req-057). */
  shortText?: string;
  longText?: string;
  address?: string;
  phone?: string;
  openingHours?: string[];
  /** Die Kennung des Ortes bei Google — sie erkennt denselben Ort wieder. */
  googlePlaceId?: string;
  /** Die Bewertung bei Google und die Zahl dahinter (req-057). */
  bewertung?: number;
  bewertungAnzahl?: number;
  /** Ein Satz, warum die KI diesen Ort vorschlaegt (req-057). */
  kiBegruendung?: string;
}

/** Ein uebernommener Vorschlag samt dem, was der Aufrufer noch holen muss. */
export interface AiSearchTreffer {
  draft: PoiDraft;
  /**
   * Die Kennungen der Fotos bei Google. Sie gehoeren nicht zum POI-Datensatz
   * — der Aufrufer laedt die Bilder herunter und legt sie in der Bildablage
   * ab (siehe app/api/poi-search/route.ts).
   */
  photoNames: string[];
}

/** Die drei austauschbaren Aussenanbindungen der KI-Suche (req-014, req-057). */
export interface AiSearchDeps {
  /** Die Region um die Mitte des Suchgebiets — von OpenStreetMap (req-057). */
  describeRegion: (lat: number, lng: number) => Promise<string | null>;
  /** Das Sprachmodell hinter der Schnittstelle in `lib/ai/` (stack.md). */
  suggestPlaces: (prompt: string) => Promise<AiAntwort>;
  /** Der Ort bei Google Places, eingeschraenkt auf das Suchgebiet (req-057). */
  lookupPlace: (name: string, box: BoundingBox) => Promise<GooglePlace | null>;
}

export interface AiSearchParams {
  searchArea: PoiPosition[];
  typeFilter: PoiTypeFilter;
  wish: string;
  /** Namen der in der Reise bereits vorhandenen POIs (siehe req-014: "andere vorschlagen"). */
  existingNames: string[];
  /** Die Kennungen dieser POIs bei Google — derselbe Ort entsteht nie zweimal. */
  existingPlaceIds?: string[];
  /** Worauf die Gruppe Wert legt (req-057). */
  praeferenzen: ReisePraeferenzen;
}

export interface AiSearchOutcome {
  treffer: AiSearchTreffer[];
  discardedCount: number;
  /**
   * Warum der Lauf nicht zustande kam (bug-032); null heisst, er kam
   * zustande. Steht hier ein Grund, ist die Trefferliste leer -- und der
   * Aufrufer sagt, woran es lag, statt nur "Fehler".
   */
  fehler: AiSearchFehler | null;
}

/** Was die KI je Ort liefert: seinen Namen und den Grund dafuer (req-057). */
export interface AiVorschlag {
  name: string;
  grund: string;
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

/**
 * Liest die von der KI vorgeschlagenen Orte aus ihrer Textantwort (req-057):
 * je Ort sein Name und ein Satz, warum er vorgeschlagen wird. Ein Eintrag
 * ohne Namen ist keiner; eine fehlende Begruendung ist dagegen kein Grund,
 * den Ort zu verwerfen — dann steht in der Zeile eben keine.
 */
export function parseSuggestedPlaces(raw: string): AiVorschlag[] {
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

  const orte = (parsed as Record<string, unknown> | null)?.orte;
  if (!Array.isArray(orte)) return [];

  const vorschlaege: AiVorschlag[] = [];
  for (const eintrag of orte) {
    const record = eintrag as Record<string, unknown> | null;
    const name = typeof record?.name === "string" ? record.name.trim() : "";
    if (name.length === 0) continue;
    const grund = typeof record?.grund === "string" ? record.grund.trim() : "";
    vorschlaege.push({ name, grund });
  }
  return vorschlaege;
}

/** Die Zeilen, die der KI die Praeferenzen der Reise nennen (req-057). */
function praeferenzZeilen(praeferenzen: ReisePraeferenzen): string[] {
  const zeilen: string[] = [];
  if (praeferenzen.interessen.length > 0) {
    zeilen.push(
      `Darauf legt die Gruppe Wert: ${praeferenzen.interessen
        .map((interesse) => INTERESSE_LABEL[interesse])
        .join(", ")}.`,
    );
  }
  if (praeferenzen.wertAuf.trim()) {
    zeilen.push(
      `Worauf die Gruppe Wert legt, in eigenen Worten: "${praeferenzen.wertAuf.trim()}"`,
    );
  }
  if (praeferenzen.nichtWollen.trim()) {
    zeilen.push(
      `Was die Gruppe nicht will — schlage nichts davon vor: "${praeferenzen.nichtWollen.trim()}"`,
    );
  }
  if (praeferenzen.mindestbewertung > 0) {
    zeilen.push(
      `Schlage nur Orte vor, die bei Google mindestens ${formatBewertung(
        praeferenzen.mindestbewertung,
      )} von 5 Sternen haben.`,
    );
  }
  return zeilen;
}

function buildPrompt(params: {
  regionDescription: string;
  widthKm: number;
  heightKm: number;
  allowedTypes: PoiType[] | null;
  wish: string;
  maxCount: number;
  existingNames: string[];
  praeferenzen: ReisePraeferenzen;
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
  lines.push(...praeferenzZeilen(params.praeferenzen));
  if (params.existingNames.length > 0) {
    lines.push(
      `Diese Orte sind bereits bekannt, schlage andere vor: ${params.existingNames.join(", ")}.`,
    );
  }
  lines.push(
    `Nenne zu jedem Ort in "grund" einen Satz, warum er zu dieser Gruppe passt, mit Bezug auf ihre Vorlieben.`,
    `Antworte ausschliesslich als JSON-Objekt der Form {"orte": [{"name": "Ortsname", "grund": "Warum er passt."}]}, ohne weiteren Text.`,
  );
  return lines.join("\n");
}

/**
 * Ob der Ort die Mindestbewertung der Reise erreicht (req-057). Ohne
 * Mindestbewertung gilt jeder Ort; mit einer zaehlt ein noch nicht
 * bewerteter Ort nicht als gut genug — "keine Bewertung" ist kein Beleg.
 */
function erreichtMindestbewertung(
  place: GooglePlace,
  mindestbewertung: number,
): boolean {
  if (mindestbewertung <= 0) return true;
  return typeof place.rating === "number" && place.rating >= mindestbewertung;
}

/** Ein Lauf, der nicht zustande kam -- mit dem Grund dafuer (bug-032). */
function gescheitert(fehler: AiSearchFehler): AiSearchOutcome {
  return { treffer: [], discardedCount: 0, fehler };
}

/**
 * Fuehrt die vierstufige KI-Suche aus (req-014, seit req-057 gegen Google
 * Places statt OpenStreetMap). Schlaegt die Region- oder die KI-Anfrage fehl,
 * traegt das Ergebnis den Grund dafuer (bug-032) -- ein einzelner nicht
 * auffindbarer, ausserhalb liegender oder zu schwach bewerteter Vorschlag
 * entfaellt dagegen nur fuer sich (discardedCount).
 */
export async function searchPoisWithAi(
  params: AiSearchParams,
  deps: AiSearchDeps,
): Promise<AiSearchOutcome> {
  const box = boundingBox(params.searchArea);
  const center = searchAreaCenter(params.searchArea);

  const regionDescription = await deps.describeRegion(center.lat, center.lng);
  if (!regionDescription) {
    return gescheitert({ art: "region", detail: "" });
  }

  const { widthKm, heightKm } = approximateExtentKm(params.searchArea);
  const allowedTypes: PoiType[] | null =
    params.typeFilter === "alle" ? null : [params.typeFilter];
  // Ein Lauf legt hoechstens zwanzig POIs an (req-057) -- auch wenn im
  // Wunsch eine groessere Zahl steht.
  const maxCount = Math.min(
    extractRequestedCount(params.wish) ?? MAX_SUGGESTIONS,
    MAX_SUGGESTIONS,
  );

  const prompt = buildPrompt({
    regionDescription,
    widthKm,
    heightKm,
    allowedTypes,
    wish: params.wish,
    maxCount,
    existingNames: params.existingNames,
    praeferenzen: params.praeferenzen,
  });

  const antwort = await deps.suggestPlaces(prompt);
  if (!antwort.ok) return gescheitert(antwort.fehler);

  const vorschlaege = parseSuggestedPlaces(antwort.text).slice(0, maxCount);

  const seen = new Set(params.existingNames.map(normalizeName));
  const bekanntePlaceIds = new Set(params.existingPlaceIds ?? []);
  const treffer: AiSearchTreffer[] = [];
  let discardedCount = 0;

  for (const vorschlag of vorschlaege) {
    if (seen.has(normalizeName(vorschlag.name))) {
      discardedCount++;
      continue;
    }

    const place = await deps.lookupPlace(vorschlag.name, box);
    // Gesucht wird nur innerhalb des gezeichneten Gebiets (req-014): das
    // Rechteck schraenkt Google ein, die Flaeche darin entscheidet hier.
    if (!place || !isInsideArea(place.position, params.searchArea)) {
      discardedCount++;
      continue;
    }
    // Derselbe Ort entsteht nie zweimal -- auch dann nicht, wenn die KI ihn
    // anders benennt als der vorhandene POI heisst (req-014, req-026).
    if (
      seen.has(normalizeName(place.name)) ||
      bekanntePlaceIds.has(place.placeId)
    ) {
      discardedCount++;
      continue;
    }
    if (
      !erreichtMindestbewertung(place, params.praeferenzen.mindestbewertung)
    ) {
      discardedCount++;
      continue;
    }

    const type = allowedTypes
      ? allowedTypes[0]
      : mapGoogleTypesToPoiType(place.types);
    const texte = poiTextsFromGoogle(place.description);

    treffer.push({
      draft: {
        name: place.name,
        ort: place.ort ?? "",
        type,
        position: place.position,
        web: place.web,
        shortText: texte.shortText,
        longText: texte.longText,
        address: place.address,
        phone: place.phone,
        openingHours: place.openingHours,
        googlePlaceId: place.placeId,
        bewertung: place.rating,
        bewertungAnzahl: place.ratingCount,
        kiBegruendung: vorschlag.grund.length > 0 ? vorschlag.grund : undefined,
      },
      photoNames: place.photoNames,
    });
    seen.add(normalizeName(place.name));
    bekanntePlaceIds.add(place.placeId);
  }

  return { treffer, discardedCount, fehler: null };
}
