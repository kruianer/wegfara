import { currentSession } from "@/lib/auth/current-session";
import { forbidden, unauthorized } from "@/lib/auth/api-guard";
import { backupDir, backupOverview, deleteBackup } from "@/lib/backup/store";
import { currentEnvironment } from "@/lib/backup/environment";

/**
 * Ein einzelnes Backup loeschen (req-053). Von selbst verschwindet keines --
 * bei knappem Platz wird nur gewarnt; entfernt wird ausschliesslich hier,
 * und ausschliesslich vom Gesamt-Admin.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await currentSession();
  if (!session) return unauthorized();
  if (!session.superAdmin) return forbidden();

  const { id } = await params;
  const geloescht = await deleteBackup(backupDir(), id);
  if (!geloescht) return Response.json({ error: "unbekannt" }, { status: 404 });

  return Response.json(await backupOverview(backupDir(), currentEnvironment()));
}
