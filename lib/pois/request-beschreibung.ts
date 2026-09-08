import type { Beschreibung, BeschreibungsAnfrage } from "./beschreibung";

/**
 * Holt den Vorschlag fuer Kurz- und Langtext (req-058). Null heisst: es kam
 * keiner -- die Oberflaeche sagt das, statt die Felder leer zu lassen und
 * einen Erfolg vorzutaeuschen (bug-021).
 */
export async function requestBeschreibung(
  anfrage: BeschreibungsAnfrage,
): Promise<Beschreibung | null> {
  try {
    const response = await fetch("/api/poi-beschreibung", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(anfrage),
    });
    if (!response.ok) return null;
    const payload = (await response.json()) as {
      beschreibung?: Beschreibung;
    };
    return payload.beschreibung ?? null;
  } catch {
    return null;
  }
}
