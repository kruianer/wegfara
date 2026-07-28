import { getPool } from "@/lib/db/pool";
import { setActivityOptionSelection } from "@/lib/db/activity-option-selections";

export async function POST(request: Request) {
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
