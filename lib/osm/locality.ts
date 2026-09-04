/**
 * Die Ortschaft aus den Adressbestandteilen, die Nominatim liefert — von der
 * Stadt hinunter zum Weiler.
 *
 * Region (Provinz, Bundesland, Kreis) und Land stehen bewusst nicht in der
 * Kette: der Ort eines POI traegt nur die Ortschaft, aus "Via Richard Wagner
 * 5, 84010 Ravello SA, Italien" wird "Ravello" (req-041).
 *
 * Leer, wenn OpenStreetMap zu dieser Stelle keine Ortschaft kennt.
 */
export function localityOf(
  address: Record<string, unknown> | undefined,
): string {
  const felder = [
    "city",
    "town",
    "village",
    "municipality",
    "hamlet",
    "suburb",
  ];
  for (const feld of felder) {
    const wert = address?.[feld];
    if (typeof wert === "string" && wert.trim().length > 0) return wert.trim();
  }
  return "";
}
