import type { PoiType } from "@/lib/pois/types";

/**
 * OSM-Tags (Schluessel/Wert), die einen PoiType kennzeichnen (siehe req-014,
 * Constraints: die Angaben eines POI, damit auch sein Typ, stammen aus den
 * Kartendaten). Nicht erschoepfend, sondern eine pragmatische Auswahl der
 * gaengigsten Tags je Typ.
 */
export const POI_TYPE_OSM_TAGS: Record<PoiType, Array<[string, string]>> = {
  sehenswuerdigkeit: [
    ["tourism", "attraction"],
    ["tourism", "viewpoint"],
    ["tourism", "artwork"],
    ["historic", "monument"],
    ["historic", "castle"],
    ["historic", "ruins"],
  ],
  stadt_dorf: [
    ["place", "city"],
    ["place", "town"],
    ["place", "village"],
    ["place", "hamlet"],
  ],
  restaurant: [
    ["amenity", "restaurant"],
    ["amenity", "cafe"],
    ["amenity", "fast_food"],
    ["amenity", "bar"],
  ],
  strand: [["natural", "beach"]],
  aktivitaet: [
    ["leisure", "park"],
    ["leisure", "sports_centre"],
    ["tourism", "theme_park"],
    ["tourism", "zoo"],
  ],
  hotel: [
    ["tourism", "hotel"],
    ["tourism", "guest_house"],
    ["tourism", "hostel"],
  ],
  weltkulturerbe: [
    ["heritage", "1"],
    ["heritage", "2"],
  ],
};

/** Leitet aus OSM-Tags den passenden PoiType ab, oder null ohne Treffer. */
export function mapOsmTagsToType(tags: Record<string, string>): PoiType | null {
  for (const [type, pairs] of Object.entries(POI_TYPE_OSM_TAGS) as [
    PoiType,
    Array<[string, string]>,
  ][]) {
    if (pairs.some(([key, value]) => tags[key] === value)) return type;
  }
  return null;
}
