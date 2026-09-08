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
    ["tourism", "museum"],
    ["tourism", "gallery"],
    ["amenity", "place_of_worship"],
    ["historic", "monument"],
    ["historic", "memorial"],
    ["historic", "castle"],
    ["historic", "ruins"],
    ["historic", "archaeological_site"],
  ],
  stadt_dorf: [
    ["place", "city"],
    ["place", "town"],
    ["place", "village"],
    ["place", "hamlet"],
    ["place", "suburb"],
  ],
  restaurant: [
    ["amenity", "restaurant"],
    ["amenity", "cafe"],
    ["amenity", "fast_food"],
    ["amenity", "bar"],
    ["amenity", "pub"],
    ["amenity", "ice_cream"],
  ],
  strand: [
    ["natural", "beach"],
    ["leisure", "beach_resort"],
  ],
  aktivitaet: [
    ["leisure", "park"],
    ["leisure", "sports_centre"],
    ["leisure", "water_park"],
    ["leisure", "nature_reserve"],
    ["leisure", "marina"],
    ["tourism", "theme_park"],
    ["tourism", "zoo"],
    ["tourism", "aquarium"],
  ],
  hotel: [
    ["tourism", "hotel"],
    ["tourism", "guest_house"],
    ["tourism", "hostel"],
    ["tourism", "motel"],
    ["tourism", "apartment"],
    ["tourism", "chalet"],
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

/**
 * Dasselbe fuer die Einordnung, die die Ortssuche liefert (req-048): sie
 * nennt einen einzelnen Tag als "Kategorie/Art" — "tourism/attraction" ist
 * derselbe Tag wie `{ tourism: "attraction" }`.
 *
 * Liefert null, wenn sich nichts zuordnen laesst. Anders als bei Google
 * (siehe lib/google/type-mapping.ts) wird dann kein Typ geraten: das
 * Suchfeld laesst den eingestellten Typ stehen, denn was eine Quelle nicht
 * kennt, kann sie nicht fuellen.
 */
export function mapOsmArtToPoiType(art: string): PoiType | null {
  const [kategorie, ...rest] = art.trim().toLowerCase().split("/");
  const wert = rest.join("/");
  if (!kategorie || !wert) return null;
  return mapOsmTagsToType({ [kategorie]: wert });
}
