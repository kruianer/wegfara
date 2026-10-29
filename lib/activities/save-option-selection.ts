/**
 * Speichert die getroffene Wahl innerhalb einer Options-Gruppe serverseitig
 * — sie gilt danach fuer alle Teilnehmer der Reise.
 *
 * Liefert, ob es angekommen ist -- und wann (bug-073): die Uhrzeit des
 * Servers, zu der die Wahl gespeichert war, oder `null`, wenn er keine
 * nennt. Bei einem Fehlschlag `null` statt eines Ergebnisses. Frueher wurde ein Fehlschlag bewusst
 * verschluckt, weil die Oberflaeche die Wahl bereits optimistisch
 * uebernommen hatte -- genau das war bug-060: die Anzeige sah aus wie nach
 * einem erfolgreichen Speichern, obwohl nichts geschrieben wurde (vgl.
 * bug-021). Der Aufrufer nimmt seine Anzeige jetzt zurueck und sagt es.
 *
 * `keepalive` (bug-072): ein Neuladen bricht den Schreibvorgang sonst ab,
 * und er kommt nie an. So darf er das Verlassen der Seite ueberdauern.
 * Verlassen kann man sich darauf nicht -- bricht der Browser ihn trotzdem
 * ab, haelt das Echo die Wahl fest (siehe app/go/go-view.tsx).
 */
export interface GespeicherteWahl {
  /** Server-Uhrzeit (ms seit 1970) nach dem Speichern, sofern genannt. */
  gespeichertUm: number | null;
}

export async function saveOptionSelection(
  tripId: string,
  startAt: string,
  endAt: string,
  activityId: string,
): Promise<GespeicherteWahl | null> {
  try {
    const response = await fetch("/api/activity-option-selection", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tripId, startAt, endAt, activityId }),
      keepalive: true,
    });
    if (!response.ok) return null;
    return { gespeichertUm: await gespeichertUm(response) };
  } catch {
    return null;
  }
}

async function gespeichertUm(response: Response): Promise<number | null> {
  try {
    const daten = (await response.json()) as { gespeichertUm?: unknown };
    return typeof daten.gespeichertUm === "number" ? daten.gespeichertUm : null;
  } catch {
    return null;
  }
}
