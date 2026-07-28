/**
 * Speichert die getroffene Wahl innerhalb einer Options-Gruppe serverseitig
 * — sie gilt danach fuer alle Teilnehmer der Reise. Schlaegt der Aufruf
 * fehl, bleibt die Wahl lokal bestehen; ein Fehler wird bewusst nicht nach
 * aussen gereicht, da die UI die Wahl bereits optimistisch uebernommen hat.
 */
export async function saveOptionSelection(
  tripId: string,
  startAt: string,
  endAt: string,
  activityId: string,
): Promise<void> {
  try {
    await fetch("/api/activity-option-selection", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tripId, startAt, endAt, activityId }),
    });
  } catch {
    // Netzwerkfehler bewusst verschluckt, siehe Kommentar oben.
  }
}
