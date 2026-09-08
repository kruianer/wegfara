/**
 * Schaltet das Teilen der eigenen Position fuer eine Reise um (req-050).
 * Schlaegt der Aufruf fehl, bleibt der Schalter im gerade gewaehlten
 * lokalen Zustand -- ein erneutes Umschalten versucht es wieder.
 */
export async function setzePositionTeilen(
  tripId: string,
  geteilt: boolean,
): Promise<void> {
  try {
    await fetch("/api/position-teilen", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tripId, geteilt }),
    });
  } catch {
    // Siehe Kommentar oben -- absichtlich kein Fehlerzustand.
  }
}
