import type { PoiType } from "@/lib/pois/types";

/**
 * Arten von Orten bei Google, die einen PoiType kennzeichnen (siehe
 * req-026: "Die Art des Ortes wird auf einen der sieben POI-Typen
 * abgebildet"). Nicht erschoepfend, sondern eine Auswahl der gaengigsten
 * Arten je Typ.
 *
 * Die Reihenfolge der Typen entscheidet bei Mehrdeutigkeit: Google gibt zu
 * einem Ort mehrere Arten an ("restaurant", "food", "point_of_interest"),
 * und der erste hier gefundene Treffer gewinnt. Die enger gefassten Typen
 * stehen deshalb vor den weiteren.
 */
export const POI_TYPE_GOOGLE_TYPES: Array<[PoiType, string[]]> = [
  [
    "hotel",
    [
      "hotel",
      "lodging",
      "guest_house",
      "hostel",
      "motel",
      "resort_hotel",
      "bed_and_breakfast",
    ],
  ],
  [
    "restaurant",
    [
      "restaurant",
      "cafe",
      "bar",
      "bakery",
      "coffee_shop",
      "meal_takeaway",
      "fast_food_restaurant",
    ],
  ],
  ["strand", ["beach"]],
  [
    "stadt_dorf",
    ["locality", "sublocality", "administrative_area_level_3", "political"],
  ],
  [
    "aktivitaet",
    [
      "amusement_park",
      "water_park",
      "zoo",
      "aquarium",
      "park",
      "national_park",
      "hiking_area",
      "ski_resort",
      "sports_complex",
      "swimming_pool",
      "wildlife_park",
    ],
  ],
  [
    "sehenswuerdigkeit",
    [
      "tourist_attraction",
      "museum",
      "art_gallery",
      "church",
      "place_of_worship",
      "historical_landmark",
      "historical_place",
      "monument",
      "cultural_landmark",
      "observation_deck",
      "point_of_interest",
    ],
  ],
];

/**
 * Bildet die Arten eines Google-Ortes auf einen POI-Typ ab. Laesst sich
 * nichts zuordnen, gilt "Sehenswuerdigkeit" (siehe req-026).
 *
 * Weltkulturerbe kennt Google nicht als Art eines Ortes; ein solcher POI
 * entsteht deshalb nie aus einem Link, sondern nur ueber die Suche in den
 * Kartendaten (req-014).
 */
export function mapGoogleTypesToPoiType(types: string[]): PoiType {
  const vorhanden = new Set(types.map((t) => t.toLowerCase()));
  for (const [poiType, googleTypes] of POI_TYPE_GOOGLE_TYPES) {
    if (googleTypes.some((t) => vorhanden.has(t))) return poiType;
  }
  return "sehenswuerdigkeit";
}
