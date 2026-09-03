import { NextResponse } from "next/server";
import { getPool } from "@/lib/db/pool";
import { currentSession } from "@/lib/auth/current-session";
import { createRecoveryCodeSet } from "@/lib/auth/login";
import { countUnusedRecoveryCodes } from "@/lib/db/recovery-codes";
import { leadsAnyTrip } from "@/lib/db/trip-participants";
import { connectionIsSecure } from "@/lib/auth/cookies";
import {
  clearRecoveryCookie,
  readRecoveryCookie,
} from "@/lib/auth/cookie-store";

export const dynamic = "force-dynamic";

/**
 * Holt die frisch erzeugten Notfallcodes genau einmal ab: beim Abholen
 * werden sie geloescht, ein erneuter Aufruf liefert nichts mehr (req-016).
 */
export async function GET(request: Request) {
  const session = await currentSession();
  if (!session) {
    return NextResponse.json({ error: "nicht angemeldet" }, { status: 401 });
  }

  const codes = await readRecoveryCookie();
  const response = NextResponse.json({ codes });
  clearRecoveryCookie(
    response,
    connectionIsSecure(request.headers.get("x-forwarded-proto"), request.url),
  );
  return response;
}

/**
 * Erzeugt einen neuen Satz Notfallcodes, der den alten ersetzt. Auch
 * dieser Satz wird nur hier ein einziges Mal ausgeliefert (req-016).
 *
 * Nur fuer Reiseleiter: Teilnehmer erhalten keine Notfallcodes (req-023) --
 * die Pruefung steht hier und nicht nur in der Anzeige, sonst kaeme ein
 * Aufruf an der Kontoseite vorbei doch zu einem.
 */
export async function POST() {
  const session = await currentSession();
  if (!session) {
    return NextResponse.json({ error: "nicht angemeldet" }, { status: 401 });
  }

  const db = getPool();
  if (!(await leadsAnyTrip(db, session.participant.id))) {
    return NextResponse.json(
      { error: "keine Notfallcodes für Teilnehmer" },
      { status: 403 },
    );
  }

  const codes = await createRecoveryCodeSet(
    db,
    session.participant.id,
    new Date(),
  );
  const offen = await countUnusedRecoveryCodes(db, session.participant.id);
  return NextResponse.json({ codes, offen });
}
