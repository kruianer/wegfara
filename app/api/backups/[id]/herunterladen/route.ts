import path from "node:path";
import { Readable } from "node:stream";
import { currentSession } from "@/lib/auth/current-session";
import { forbidden, unauthorized } from "@/lib/auth/api-guard";
import { backupDir, findBackup } from "@/lib/backup/store";
import { backupArchivName } from "@/lib/backup/format";
import { verzeichnisQuellen, zipStream } from "@/lib/backup/zip";

export const dynamic = "force-dynamic";

/**
 * Ein Backup vom Server holen (req-071). Gegen "ich habe vor dem Deploy
 * etwas kaputt gemacht" hilft die Wiederherstellung (req-053) -- gegen den
 * Verlust des Rechners hilft nur eine Kopie ausserhalb.
 *
 * Geliefert wird genau das, was das Backup schon enthaelt, als ein ZIP:
 * datenbank.json, manifest.json und images/. Am Backup selbst aendert sich
 * dabei nichts; es wird gelesen, nicht umgewandelt.
 *
 * Wer darf: ausschliesslich der Gesamt-Admin -- dieselbe Regel wie fuer die
 * uebrigen Backup-Adressen.
 *
 * Der Inhalt geht als Strom hinaus: ein Backup mit vielen Bildern darf den
 * Arbeitsspeicher der Anwendung nicht belasten.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await currentSession();
  if (!session) return unauthorized();
  if (!session.superAdmin) return forbidden();

  const { id } = await params;
  const root = backupDir();
  // findBackup prueft die Kennung, bevor sie in einen Pfad geraet.
  const backup = await findBackup(root, id);
  if (!backup) return Response.json({ error: "unbekannt" }, { status: 404 });

  const quellen = await verzeichnisQuellen(path.join(root, id));
  const strom = Readable.toWeb(
    zipStream(quellen),
  ) as unknown as ReadableStream<Uint8Array>;

  return new Response(strom, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${backupArchivName(backup)}"`,
      "Cache-Control": "no-store",
    },
  });
}
