import { currentSession } from "@/lib/auth/current-session";
import { forbidden, unauthorized } from "@/lib/auth/api-guard";
import { imageDir } from "@/lib/images/photo-store";
import {
  holeMiniaturenNach,
  miniaturenStand,
} from "@/lib/miniaturen/nachholen";

/**
 * Der nachtraegliche Lauf fuer die Miniaturen (req-105) -- ausgeloest in der
 * "Verwaltung" und damit ausschliesslich vom Gesamt-Admin, wie die Backups
 * daneben.
 *
 * GET nennt den Stand, POST tut einen Schritt. Den Lauf fuehrt die
 * Oberflaeche Schritt fuer Schritt und reicht dabei weiter, wo er steht
 * (`nach`); der Server haelt keinen Lauf fest. `nach` ist nur ein
 * Vergleichswert fuer die Reihenfolge der Namen -- in einen Pfad geraet er
 * nie.
 */
async function berechtigt(): Promise<Response | null> {
  const session = await currentSession();
  if (!session) return unauthorized();
  if (!session.superAdmin) return forbidden();
  return null;
}

function ohneAblage(): Response {
  return Response.json(
    { error: "Das Bildverzeichnis ist nicht eingerichtet." },
    { status: 503 },
  );
}

export async function GET() {
  const abgewiesen = await berechtigt();
  if (abgewiesen) return abgewiesen;

  let dir: string;
  try {
    dir = imageDir();
  } catch {
    return ohneAblage();
  }
  return Response.json(await miniaturenStand(dir));
}

export async function POST(request: Request) {
  const abgewiesen = await berechtigt();
  if (abgewiesen) return abgewiesen;

  let nach: string | null = null;
  try {
    const body = (await request.json()) as { nach?: unknown };
    if (typeof body?.nach === "string") nach = body.nach;
  } catch {
    // Ohne Angabe beginnt der Lauf von vorn.
  }

  let dir: string;
  try {
    dir = imageDir();
  } catch {
    return ohneAblage();
  }
  return Response.json(await holeMiniaturenNach(dir, nach));
}
