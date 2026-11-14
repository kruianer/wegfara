import { MINIATUREN_API, type MiniaturenSchritt } from "./types";

/** Was die Oberflaeche sagt, wenn ein Schritt nicht durchging. */
export const MINIATUREN_FEHLER =
  "Der Lauf wurde unterbrochen. Starte ihn erneut — was schon fertig ist, wird übersprungen.";

function istSchritt(value: unknown): value is MiniaturenSchritt {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { bilder?: unknown }).bilder === "number" &&
    typeof (value as { geprueft?: unknown }).geprueft === "number"
  );
}

/** Ein Schritt des nachtraeglichen Laufs (req-105) -- null, wenn er scheitert. */
export async function requestMiniaturenSchritt(
  nach: string | null,
): Promise<MiniaturenSchritt | null> {
  try {
    const response = await fetch(MINIATUREN_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nach }),
    });
    if (!response.ok) return null;
    const payload: unknown = await response.json();
    return istSchritt(payload) ? payload : null;
  } catch {
    return null;
  }
}
