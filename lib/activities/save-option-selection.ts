/**
 * Speichert die getroffene Wahl innerhalb einer Options-Gruppe serverseitig
 * — sie gilt danach fuer alle Teilnehmer der Reise.
 *
 * Liefert, ob es angekommen ist. Frueher wurde ein Fehlschlag bewusst
 * verschluckt, weil die Oberflaeche die Wahl bereits optimistisch
 * uebernommen hatte -- genau das war bug-060: die Anzeige sah aus wie nach
 * einem erfolgreichen Speichern, obwohl nichts geschrieben wurde (vgl.
 * bug-021). Der Aufrufer nimmt seine Anzeige jetzt zurueck und sagt es.
 */
export async function saveOptionSelection(
  tripId: string,
  startAt: string,
  endAt: string,
  activityId: string,
): Promise<boolean> {
  try {
    const response = await fetch("/api/activity-option-selection", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tripId, startAt, endAt, activityId }),
    });
    return response.ok;
  } catch {
    return false;
  }
}
