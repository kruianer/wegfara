import { getPool } from "@/lib/db/pool";
import { setActivityDruckDarstellung } from "@/lib/db/activities";
import { isDruckDarstellung } from "@/lib/activities/druck-darstellung";
import { currentSession } from "@/lib/auth/current-session";
import { unauthorized } from "@/lib/auth/api-guard";

/**
 * Das Kennzeichen eines Programmpunkts fuer den gedruckten Reiseplan setzen
 * (req-080) -- "Vollständig", "Als Nebenstation" oder "Nicht anzeigen".
 *
 * Es steht an einer eigenen Adresse und nicht am PATCH von
 * /api/programmpunkte: dort geht es ausschliesslich um Zeiten (req-040), und
 * dabei soll es bleiben.
 *
 * Gesetzt wird sofort, nicht verzoegert: der Nutzer sieht das Heft daneben
 * und erwartet, dass die Wahl ankommt (siehe delivery/stack.md,
 * Conventions). Der Mandant kommt aus der Anmeldung, nie aus der Anfrage
 * (req-024).
 */
export async function POST(request: Request) {
  const session = await currentSession();
  if (!session) return unauthorized();

  let body: { activityId?: unknown; darstellung?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return Response.json({ error: "invalid body" }, { status: 400 });
  }

  const activityId =
    typeof body.activityId === "string" ? body.activityId.trim() : "";
  if (activityId.length === 0 || !isDruckDarstellung(body.darstellung)) {
    return Response.json({ error: "invalid body" }, { status: 400 });
  }

  const activity = await setActivityDruckDarstellung(
    getPool(),
    session.accountId,
    activityId,
    body.darstellung,
  );
  // Programmpunkte anderer Accounts existieren fuer diese Sitzung nicht.
  if (!activity) {
    return Response.json({ error: "unknown activity" }, { status: 404 });
  }

  return Response.json({ activity });
}
