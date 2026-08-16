import { getPool } from "@/lib/db/pool";
import { setActivityOptionSelection } from "@/lib/db/activity-option-selections";
import { currentSession } from "@/lib/auth/current-session";
import { unauthorized } from "@/lib/auth/api-guard";

export async function POST(request: Request) {
  // Schreibzugriff nur fuer eine angemeldete Person (req-016).
  if (!(await currentSession())) return unauthorized();

  const body = (await request.json()) as {
    tripId?: string;
    startAt?: string;
    endAt?: string;
    activityId?: string;
  };
  const { tripId, startAt, endAt, activityId } = body;

  if (!tripId || !startAt || !endAt || !activityId) {
    return Response.json({ error: "invalid body" }, { status: 400 });
  }

  await setActivityOptionSelection(
    getPool(),
    tripId,
    startAt,
    endAt,
    activityId,
  );
  return Response.json({ status: "ok" });
}
