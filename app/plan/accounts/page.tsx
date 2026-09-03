import { getPool } from "@/lib/db/pool";
import { requireSuperAdmin } from "@/lib/auth/super-admin";
import { listAccountsOverview } from "@/lib/db/accounts";
import { AccountsView } from "./accounts-view";

// Haengt an der Sitzung des Aufrufers — nie statisch vorrendern.
export const dynamic = "force-dynamic";

/**
 * Die Account-Verwaltung (req-025). Sie sieht ausschliesslich der
 * Gesamt-Admin: requireSuperAdmin() verlangt zuerst eine Sitzung (req-016)
 * und danach die Kennzeichnung. Wer sie nicht traegt und diese Adresse
 * direkt aufruft, bekommt keinen Zugriff.
 */
export default async function AccountsPage() {
  const session = await requireSuperAdmin();
  const accounts = await listAccountsOverview(getPool(), new Date());

  return (
    <AccountsView
      accounts={accounts}
      ownAccountId={session.participant.accountId}
      currentAccountId={session.accountId}
    />
  );
}
