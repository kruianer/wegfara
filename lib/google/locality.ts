/**
 * Die Ortschaft aus den Adressbestandteilen, die Google zu einem Ort
 * liefert — von der Stadt hinunter zum Ortsteil.
 *
 * Sie dient allein der KI-Suche (req-057): dort ist Google die Quelle, und
 * ein Ort je Vorschlag ueber die Ortssuche von OpenStreetMap
 * nachzuschlagen hiesse, bei einem Lauf mit zwanzig Vorschlaegen zwanzigmal
 * dort anzufragen. Fuer alle uebrigen POIs bleibt es bei req-041:
 * `lib/pois/derive-ort.ts` fragt OpenStreetMap.
 *
 * Wie dort traegt der Ort nur die Ortschaft — Region, Bundesland und Land
 * stehen bewusst nicht in der Kette.
 */
export interface GoogleAddressComponent {
  longText?: string;
  shortText?: string;
  types?: string[];
}

const ORTS_TYPEN = [
  "locality",
  "postal_town",
  "administrative_area_level_3",
  "sublocality",
];

/** Leer, wenn Google zu diesem Ort keine Ortschaft nennt. */
export function googleLocalityOf(
  components: GoogleAddressComponent[] | undefined,
): string {
  for (const typ of ORTS_TYPEN) {
    const treffer = (components ?? []).find((component) =>
      (component.types ?? []).includes(typ),
    );
    const name = treffer?.longText?.trim();
    if (name && name.length > 0) return name;
  }
  return "";
}
