import { getPool } from "@/lib/db/pool";
import { currentSession } from "@/lib/auth/current-session";
import { forbidden, unauthorized } from "@/lib/auth/api-guard";
import { imageDir } from "@/lib/images/photo-store";
import { backupDir, backupOverview, createBackup } from "@/lib/backup/store";
import { currentEnvironment } from "@/lib/backup/environment";
import {
  DEPLOY_TOKEN_HEADER,
  deployTokenMatches,
} from "@/lib/backup/deploy-token";
import type { BackupSource } from "@/lib/backup/types";

/**
 * Die Backups (req-053). Sie sind Teil der Anwendung und nicht der
 * Infrastruktur (siehe delivery/stack.md): dieselbe Funktion sichert, ob
 * der Gesamt-Admin sie in der "Verwaltung" ausloest oder der prod-Deploy
 * sie vor dem Ausrollen aufruft.
 *
 * Wer darf: ausschliesslich der Gesamt-Admin -- ein Account-Admin, der
 * diese Adresse direkt aufruft, wird abgewiesen. Der Deploy hat keine
 * Sitzung und weist sich stattdessen mit dem Geheimnis der Umgebung aus
 * (siehe lib/backup/deploy-token.ts).
 */
async function overview() {
  return backupOverview(backupDir(), currentEnvironment());
}

export async function GET() {
  const session = await currentSession();
  if (!session) return unauthorized();
  if (!session.superAdmin) return forbidden();

  return Response.json(await overview());
}

export async function POST(request: Request) {
  const vomDeploy = deployTokenMatches(
    request.headers.get(DEPLOY_TOKEN_HEADER),
  );

  if (!vomDeploy) {
    const session = await currentSession();
    if (!session) return unauthorized();
    if (!session.superAdmin) return forbidden();
  }

  const source: BackupSource = vomDeploy ? "vor_deploy" : "von_hand";
  await createBackup({
    root: backupDir(),
    db: getPool(),
    imageDir: imageDir(),
    source,
    environment: currentEnvironment(),
    now: new Date(),
  });

  return Response.json(await overview());
}
