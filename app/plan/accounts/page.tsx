import { getPool } from "@/lib/db/pool";
import { requireSuperAdmin } from "@/lib/auth/super-admin";
import { listAccountsOverview } from "@/lib/db/accounts";
import { backupDir, backupOverview } from "@/lib/backup/store";
import { currentEnvironment } from "@/lib/backup/environment";
import type { BackupOverview } from "@/lib/backup/types";
import { AccountsView } from "./accounts-view";

// Haengt an der Sitzung des Aufrufers — nie statisch vorrendern.
export const dynamic = "force-dynamic";

/**
 * Ohne gesetztes BACKUP_DIR gibt es keine Ablage -- dann bleibt die Liste
 * leer, statt dass die ganze Verwaltung nicht mehr aufgeht. Im Betrieb ist
 * die Variable gesetzt (siehe deploy/docker-compose.yml).
 */
async function backups(): Promise<BackupOverview> {
  const environment = currentEnvironment();
  try {
    return await backupOverview(backupDir(), environment);
  } catch {
    return {
      environment,
      entries: [],
      usedBytes: 0,
      freeBytes: 0,
      lowSpace: false,
    };
  }
}

/**
 * Die "Verwaltung" (req-025, bis req-036 "Account-Verwaltung"). Sie sieht
 * ausschliesslich der Gesamt-Admin: requireSuperAdmin() verlangt zuerst eine
 * Sitzung (req-016)
 * und danach die Kennzeichnung. Wer sie nicht traegt und diese Adresse
 * direkt aufruft, bekommt keinen Zugriff.
 *
 * Seit req-053 stehen hier auch die Backups.
 */
export default async function AccountsPage() {
  const session = await requireSuperAdmin();
  const accounts = await listAccountsOverview(getPool(), new Date());

  return (
    <AccountsView
      accounts={accounts}
      ownAccountId={session.participant.accountId}
      currentAccountId={session.accountId}
      backups={await backups()}
    />
  );
}
