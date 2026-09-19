import { createWriteStream } from "node:fs";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { currentSession } from "@/lib/auth/current-session";
import { forbidden, unauthorized } from "@/lib/auth/api-guard";
import { backupDir, backupOverview } from "@/lib/backup/store";
import { currentEnvironment } from "@/lib/backup/environment";
import { IMPORT_FEHLER, importiereBackupArchiv } from "@/lib/backup/import";

export const dynamic = "force-dynamic";

/**
 * Eine heruntergeladene ZIP-Datei wieder einspielen (req-071). Danach steht
 * das Backup in der Liste wie jedes andere -- wiederhergestellt wird es
 * dadurch nicht; das bleibt der eigene, bestaetigte Schritt aus req-053.
 *
 * Wer darf: ausschliesslich der Gesamt-Admin.
 *
 * Die hochgeladene Datei wandert als Strom auf die Platte und wird erst von
 * dort gelesen: ein Backup mit vielen Bildern darf den Arbeitsspeicher der
 * Anwendung nicht belasten (req-071, Constraints).
 */
export async function POST(request: Request) {
  const session = await currentSession();
  if (!session) return unauthorized();
  if (!session.superAdmin) return forbidden();

  const root = backupDir();
  await mkdir(root, { recursive: true });
  // Das Nebenverzeichnis passt nicht zum Muster einer Kennung und taucht
  // deshalb nicht in der Liste auf, solange hier gearbeitet wird.
  const ordner = await mkdtemp(path.join(root, ".hochgeladen-"));
  const archiv = path.join(ordner, "archiv.zip");

  try {
    if (!request.body) {
      return Response.json({ error: IMPORT_FEHLER.keinZip }, { status: 400 });
    }
    await pipeline(
      Readable.fromWeb(request.body as Parameters<typeof Readable.fromWeb>[0]),
      createWriteStream(archiv),
    );

    const ergebnis = await importiereBackupArchiv({ root, archiv });
    if (!ergebnis.ok) {
      return Response.json({ error: ergebnis.fehler }, { status: 400 });
    }

    return Response.json(await backupOverview(root, currentEnvironment()));
  } catch (fehler) {
    // Ein Fehler wird benannt und nicht verschluckt (vgl. bug-032).
    console.error("Backup-Upload fehlgeschlagen", fehler);
    return Response.json(
      { error: IMPORT_FEHLER.fehlgeschlagen },
      { status: 500 },
    );
  } finally {
    await rm(ordner, { recursive: true, force: true });
  }
}
