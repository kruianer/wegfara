/**
 * Minimale Schnittstelle, die sowohl ein echtes pg-Pool/-Client-Objekt als
 * auch ein Test-Double (z.B. pg-mem) erfuellen muss, damit Repositories in
 * lib/db/ ohne laufende Datenbank testbar sind.
 */
export interface Queryable {
  query<Row extends Record<string, unknown> = Record<string, unknown>>(
    text: string,
    params?: unknown[],
  ): Promise<{ rows: Row[] }>;
}
