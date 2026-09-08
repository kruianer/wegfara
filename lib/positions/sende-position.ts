/**
 * Schickt die eigene Position an den Server (req-050). Ein einzelner
 * fehlgeschlagener Versuch wird beim naechsten Takt (alle 15 Sekunden)
 * einfach wiederholt -- kein eigener Fehlerzustand fuer einen kurzen
 * Netzausfall.
 */
export async function sendePosition(
  tripId: string,
  lat: number,
  lng: number,
): Promise<void> {
  try {
    await fetch("/api/positionen", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tripId, lat, lng }),
    });
  } catch {
    // Siehe Kommentar oben -- absichtlich kein Fehlerzustand.
  }
}
