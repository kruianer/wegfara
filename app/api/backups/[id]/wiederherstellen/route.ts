import { NextResponse } from "next/server";
import { getPool, withDatabaseClient } from "@/lib/db/pool";
import { currentSession } from "@/lib/auth/current-session";
import { forbidden, unauthorized } from "@/lib/auth/api-guard";
import { connectionIsSecure } from "@/lib/auth/cookies";
import { clearSessionCookie } from "@/lib/auth/cookie-store";
import { imageDir } from "@/lib/images/photo-store";
import {
  backupDir,
  createBackup,
  findBackup,
  restoreBackup,
} from "@/lib/backup/store";
import { currentEnvironment } from "@/lib/backup/environment";
import { beginRestore, endRestore } from "@/lib/backup/maintenance";
import { RESTORE_CONFIRMATION } from "@/lib/backup/paths";

export const dynamic = "force-dynamic";

/**
 * Ein Backup wiederherstellen (req-053). Danach sind Datenbank und
 * Bilddateien vollstaendig auf dem Stand des Backups -- ohne Handarbeit an
 * beidem.
 *
 * Drei Dinge werden hier und nicht nur in der Oberflaeche geprueft:
 * - nur der Gesamt-Admin darf es,
 * - ohne das eingetippte Wort wird nichts wiederhergestellt,
 * - waehrend des Laufs ist die App gesperrt (siehe
 *   lib/backup/maintenance.ts).
 *
 * Das Haekchen "Vorher den jetzigen Stand sichern" ist vorausgewaehlt: fehlt
 * die Angabe, wird gesichert. Wer darauf verzichten will, muss es
 * ausdruecklich abwaehlen.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await currentSession();
  if (!session) return unauthorized();
  if (!session.superAdmin) return forbidden();

  let body: Record<string, unknown> = {};
  try {
    const parsed: unknown = await request.json();
    if (typeof parsed === "object" && parsed !== null) {
      body = parsed as Record<string, unknown>;
    }
  } catch {
    body = {};
  }

  if (body.bestaetigung !== RESTORE_CONFIRMATION) {
    return Response.json({ error: "nicht bestaetigt" }, { status: 400 });
  }

  const { id } = await params;
  const root = backupDir();
  const backup = await findBackup(root, id);
  if (!backup) return Response.json({ error: "unbekannt" }, { status: 404 });

  if (!beginRestore()) {
    return Response.json({ error: "laeuft bereits" }, { status: 409 });
  }

  try {
    if (body.vorherSichern !== false) {
      await createBackup({
        root,
        db: getPool(),
        imageDir: imageDir(),
        source: "von_hand",
        environment: currentEnvironment(),
        now: new Date(),
      });
    }

    const wiederhergestellt = await withDatabaseClient((client) =>
      restoreBackup({ root, id, client, imageDir: imageDir() }),
    );
    if (!wiederhergestellt) {
      return Response.json({ error: "unbekannt" }, { status: 404 });
    }
  } catch {
    return Response.json({ error: "fehlgeschlagen" }, { status: 500 });
  } finally {
    endRestore();
  }

  // Die Sitzungen stammen jetzt aus dem Backup -- die eigene ist damit
  // hinfaellig, und wer angemeldet war, sieht die Anmeldeseite (req-053).
  const response = NextResponse.json({ status: "wiederhergestellt" });
  clearSessionCookie(
    response,
    connectionIsSecure(request.headers.get("x-forwarded-proto"), request.url),
  );
  return response;
}
