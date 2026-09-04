import type { PoiPosition } from "./types";

/**
 * Woher der Ort eines POI stammt (req-041). Beide Wege fuehren zu
 * OpenStreetMap; beide liefern null, wenn die Ortssuche nicht erreichbar ist
 * oder nichts kennt — ein Ausfall darf das Speichern nie verhindern.
 */
export interface OrtLookup {
  /** Die Ortschaft zu einer Anschrift. */
  fromAddress: (address: string) => Promise<string | null>;
  /** Die Ortschaft, in der eine Position liegt. */
  fromPosition: (position: PoiPosition) => Promise<string | null>;
}

/** Die Angaben eines POI, aus denen sein Ort abgeleitet wird. */
export interface OrtHerkunft {
  address: string | null;
  position: PoiPosition;
}

/**
 * Leitet den Ort eines POI ab (req-041): hat er eine Adresse, kommt der Ort
 * aus ihr, sonst aus seiner Position. Widersprechen sich beide, gewinnt die
 * Adresse — deshalb wird die Position erst gefragt, wenn die Adresse nichts
 * hergibt.
 *
 * Liefert null, wenn sich kein Ort ermitteln laesst. Der Aufrufer laesst dann
 * den gespeicherten Ort stehen und speichert trotzdem (siehe Constraints):
 * ein Ausfall der Ortssuche darf das Speichern eines POI nie verhindern.
 */
export async function deriveOrt(
  herkunft: OrtHerkunft,
  lookup: OrtLookup,
): Promise<string | null> {
  const address = herkunft.address?.trim() ?? "";

  try {
    if (address.length > 0) {
      const ausAdresse = await lookup.fromAddress(address);
      if (ausAdresse && ausAdresse.trim().length > 0) return ausAdresse.trim();
    }

    const ausPosition = await lookup.fromPosition(herkunft.position);
    return ausPosition && ausPosition.trim().length > 0
      ? ausPosition.trim()
      : null;
  } catch {
    // Auch ein unerwarteter Fehler der Ortssuche bleibt folgenlos fuers
    // Speichern -- der bisherige Ort bleibt dann stehen.
    return null;
  }
}
