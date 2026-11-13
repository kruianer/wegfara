import { getPool } from "@/lib/db/pool";
import { setActivityOptionSelection } from "@/lib/db/activity-option-selections";
import { currentSession } from "@/lib/auth/current-session";
import { unauthorized } from "@/lib/auth/api-guard";

export async function POST(request: Request) {
  // Schreibzugriff nur fuer eine angemeldete Person (req-016); der Mandant
  // ergibt sich aus ihrem Konto, nie aus der Anfrage (req-024).
  const session = await currentSession();
  if (!session) return unauthorized();

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

  const gespeichert = await setActivityOptionSelection(
    getPool(),
    session.accountId,
    tripId,
    startAt,
    endAt,
    activityId,
  );
  // Eine Reise eines anderen Accounts existiert fuer diese Sitzung nicht.
  if (!gespeichert) {
    return Response.json({ error: "unknown trip" }, { status: 404 });
  }

  // Wann die Wahl gespeichert war, nach der Uhr dieses Servers (bug-073):
  // Damit erkennt eine gerade neu geladene Seite, ob der Server sie vor oder
  // nach dieser Wahl gelesen hat (siehe app/go/go-view.tsx).
  return Response.json({ status: "ok", gespeichertUm: Date.now() });
}
