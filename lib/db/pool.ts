import { Pool } from "pg";
import type { Queryable } from "./queryable";

let pool: Pool | undefined;

export function getPool(): Pool {
  if (!pool) {
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
  }
  return pool;
}

/**
 * Fuehrt mehrere Anweisungen auf einer einzigen Verbindung aus -- noetig
 * ueberall dort, wo eine Transaktion sie umschliessen soll (req-053,
 * Wiederherstellung). Ueber den Pool landete jede Anweisung womoeglich auf
 * einer anderen Verbindung, und "begin" umschloesse nichts.
 */
export async function withDatabaseClient<T>(
  run: (client: Queryable) => Promise<T>,
): Promise<T> {
  const client = await getPool().connect();
  try {
    return await run(client);
  } finally {
    client.release();
  }
}
