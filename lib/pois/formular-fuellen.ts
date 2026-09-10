import type { PlaceSuggestion } from "@/lib/osm/place-search";
import { mapOsmArtToPoiType } from "@/lib/osm/type-mapping";
import type { GoogleOrt, PoiGoogleQuelle } from "./google-ort";
import { MANUAL_POI_FIELDS, type ManualPoiField } from "./manual-fields";
import type { PoiInput } from "./validate";

/**
 * Was das eine Suchfeld am Anfang des POI-Formulars in die uebrigen Felder
 * schreibt (req-048) — aus einem Ortsvorschlag von OpenStreetMap oder aus
 * einem bei Google nachgeschlagenen Ort.
 *
 * Eine Fuellung nennt nur, was die Quelle wirklich kennt: was sie nicht
 * fuehrt, steht nicht darin und laesst das Feld deshalb unveraendert. Alles
 * Uebrige wird ueberschrieben — auch schon Ausgefuelltes; wer selbst
 * weitertippt, aendert es danach von Hand.
 *
 * Der Status bleibt immer aussen vor: er beschreibt, wie die Gruppe zu dem
 * Ort steht, und ist keine Angabe der Quelle. Der Ort ebenso — er wird beim
 * Speichern abgeleitet (req-041).
 */
export type Fuellung = Partial<PoiInput>;

/**
 * Was die Anlegezeile (req-060) dem Formular mitgibt, das sie oeffnet: die
 * gefuellten Felder und, wenn der Ort von Google kam, seine Herkunft dort.
 * Ohne Google-Ort steht dort null — ein Ortsvorschlag von OpenStreetMap
 * traegt keine Kennung bei Google.
 */
export interface Vorbelegung {
  fuellung: Fuellung;
  google: PoiGoogleQuelle | null;
}

/** Was ein Ortsvorschlag von OpenStreetMap ueber die Felder weiss. */
export function ortsvorschlagFuellung(place: PlaceSuggestion): Fuellung {
  const fuellung: Fuellung = {
    name: place.name,
    position: { lat: place.lat, lng: place.lng },
  };
  if (place.address.length > 0) fuellung.address = place.address;
  // Ohne zuordenbare Einordnung bleibt der eingestellte Typ stehen.
  const type = mapOsmArtToPoiType(place.art);
  if (type) fuellung.type = type;
  return fuellung;
}

/** Was ein bei Google nachgeschlagener Ort ueber die Felder weiss. */
export function googleOrtFuellung(ort: GoogleOrt): Fuellung {
  const fuellung: Fuellung = {
    name: ort.name,
    // Die Art des Ortes bildet Google immer auf einen Typ ab (req-026).
    type: ort.type,
    position: ort.position,
  };
  if (ort.address.length > 0) fuellung.address = ort.address;
  if (ort.web.length > 0) fuellung.web = ort.web;
  if (ort.phone.length > 0) fuellung.phone = ort.phone;
  if (ort.openingHours.length > 0) fuellung.openingHours = ort.openingHours;
  if (ort.shortText.length > 0) fuellung.shortText = ort.shortText;
  if (ort.longText.length > 0) fuellung.longText = ort.longText;
  return fuellung;
}

/**
 * Welche Angaben eine Fuellung gesetzt hat. Sie gelten nicht als von Hand
 * geaendert (req-048): ein spaeteres Auffrischen aus Google darf sie
 * ersetzen — nur selbst Getipptes bleibt dabei stehen.
 */
export function gefuellteFelder(fuellung: Fuellung): ManualPoiField[] {
  // In der Reihenfolge der Liste selbst -- dieselbe, in der sie in der
  // Spalte `manual_fields` stehen.
  return MANUAL_POI_FIELDS.filter((feld) => feld in fuellung);
}
