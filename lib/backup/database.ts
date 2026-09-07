import type { Queryable } from "@/lib/db/queryable";
import { BACKUP_TABLES } from "./tables";

/**
 * Die Datenbankhaelfte eines Backups (req-053): der Inhalt aller Tabellen,
 * gelesen und zurueckgeschrieben ueber gewoehnliches SQL. Bewusst kein
 * pg_dump: das Backup ist Teil der Anwendung und nicht der Infrastruktur
 * (siehe delivery/stack.md), und im Container der Anwendung liegen keine
 * PostgreSQL-Werkzeuge.
 */

/** Ein einfacher Wert, wie er in der Ablage steht. */
export type DumpValue = string | number | boolean | null;

export interface TableDump {
  name: string;
  columns: string[];
  /** Je Zeile ein Wert je Spalte, in der Reihenfolge von `columns`. */
  rows: DumpValue[][];
}

export interface DatabaseDump {
  tables: TableDump[];
}

interface ColumnInfo {
  name: string;
  dataType: string;
}

/**
 * Welche Spalten das Schema gerade hat -- Grundlage fuer beide Richtungen.
 * Beim Sichern bestimmt sie, was gelesen wird; beim Wiederherstellen, was
 * aus einem aelteren Backup ueberhaupt noch passt.
 */
async function readSchema(db: Queryable): Promise<Map<string, ColumnInfo[]>> {
  const { rows } = await db.query<{
    table_name: string;
    column_name: string;
    data_type: string;
  }>(
    `select table_name, column_name, data_type
       from information_schema.columns
      where table_schema = 'public'
      order by table_name, ordinal_position`,
  );

  const schema = new Map<string, ColumnInfo[]>();
  for (const row of rows) {
    const columns = schema.get(row.table_name) ?? [];
    columns.push({ name: row.column_name, dataType: row.data_type });
    schema.set(row.table_name, columns);
  }
  return schema;
}

function pad(value: number, length = 2): string {
  return String(value).padStart(length, "0");
}

/**
 * Ein Datum so festhalten, wie PostgreSQL es wieder liest. Der Treiber gibt
 * `date` und `timestamp` als Date im Zeitzonen-Verstaendnis des Servers
 * heraus -- daraus eine UTC-Zeichenkette zu machen, verschoebe einen
 * Reisetag um bis zu einen Tag. Gesichert wird deshalb, was ohne Zeitzone
 * dasteht; nur `timestamptz` traegt seinen Zeitpunkt wirklich absolut.
 */
export function serializeDate(value: Date, dataType: string): string {
  if (dataType === "date") {
    // Eine Datenbank im Arbeitsspeicher legt den Tag auf Mitternacht UTC,
    // PostgreSQL auf Mitternacht der Serverzeit. Was von beidem vorliegt,
    // verraet die Uhrzeit: nur die eine ist ortszeitlich Mitternacht.
    const lokal =
      value.getHours() === 0 &&
      value.getMinutes() === 0 &&
      value.getSeconds() === 0 &&
      value.getMilliseconds() === 0;
    return lokal
      ? `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`
      : value.toISOString().slice(0, 10);
  }

  if (dataType === "timestamp without time zone") {
    return (
      `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}` +
      `T${pad(value.getHours())}:${pad(value.getMinutes())}:${pad(value.getSeconds())}` +
      `.${pad(value.getMilliseconds(), 3)}`
    );
  }

  return value.toISOString();
}

export function serializeValue(value: unknown, dataType: string): DumpValue {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return serializeDate(value, dataType);
  if (typeof value === "bigint") return value.toString();
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }
  // Kommt im Schema nicht vor (siehe delivery/datenbank.md); lieber als
  // Text sichern als still verlieren.
  return JSON.stringify(value);
}

function quote(identifier: string): string {
  return `"${identifier.replace(/"/g, '""')}"`;
}

/**
 * Liest den gesamten Inhalt der Datenbank. Tabellen, die es im Schema nicht
 * (mehr) gibt, werden uebergangen -- so laeuft ein Backup auch, waehrend
 * eine Migration noch aussteht.
 */
export async function dumpDatabase(db: Queryable): Promise<DatabaseDump> {
  const schema = await readSchema(db);
  const tables: TableDump[] = [];

  for (const name of BACKUP_TABLES) {
    const columns = schema.get(name);
    if (!columns) continue;

    const columnNames = columns.map((column) => column.name);
    const { rows } = await db.query<Record<string, unknown>>(
      `select ${columnNames.map(quote).join(", ")} from ${quote(name)}`,
    );

    tables.push({
      name,
      columns: columnNames,
      rows: rows.map((row) =>
        columns.map((column) =>
          serializeValue(row[column.name], column.dataType),
        ),
      ),
    });
  }

  return { tables };
}

export function dumpRowCount(dump: DatabaseDump): number {
  return dump.tables.reduce((sum, table) => sum + table.rows.length, 0);
}

/**
 * Wie viele Zeilen auf einmal eingefuegt werden. PostgreSQL nimmt hoechstens
 * 65535 Parameter je Anweisung entgegen -- die Schranke gilt der Anzahl
 * Werte, nicht der Zeilen.
 */
const MAX_PARAMETERS = 2000;

/**
 * Schreibt den Inhalt eines Backups zurueck: erst wird jede Tabelle geleert,
 * dann wird eingefuegt. Beides laeuft in einer einzigen Transaktion -- eine
 * abgebrochene Wiederherstellung darf keine halb gefuellte Datenbank
 * hinterlassen.
 *
 * Der Aufrufer uebergibt eine eigene Verbindung (siehe withDatabaseClient in
 * lib/db/pool.ts): ueber einen Pool landete jede Anweisung womoeglich auf
 * einer anderen Verbindung, und die Transaktion umschloesse nichts.
 */
export async function restoreDatabase(
  client: Queryable,
  dump: DatabaseDump,
): Promise<void> {
  const schema = await readSchema(client);
  const byName = new Map(dump.tables.map((table) => [table.name, table]));

  // Nur Tabellen, die es hier wie dort gibt. Was das Backup nicht kennt,
  // wird trotzdem geleert: nach der Wiederherstellung steht die Datenbank
  // auf dem Stand des Backups und nicht auf einer Mischung aus beidem.
  const vorhanden = BACKUP_TABLES.filter((name) => schema.has(name));

  await client.query("begin");
  try {
    for (const name of [...vorhanden].reverse()) {
      await client.query(`delete from ${quote(name)}`);
    }

    for (const name of vorhanden) {
      const table = byName.get(name);
      if (!table || table.rows.length === 0) continue;

      const spalten = new Set(
        (schema.get(name) ?? []).map((column) => column.name),
      );
      // Eine Spalte, die es nicht mehr gibt, faellt weg; eine neue bekommt
      // ihren Vorgabewert. So laesst sich ein aelteres Backup einspielen,
      // ohne das Schema zurueckzudrehen.
      const indizes = table.columns
        .map((column, index) => ({ column, index }))
        .filter(({ column }) => spalten.has(column));
      if (indizes.length === 0) continue;

      const proSchub = Math.max(1, Math.floor(MAX_PARAMETERS / indizes.length));
      const ziel = indizes.map(({ column }) => quote(column)).join(", ");

      for (let start = 0; start < table.rows.length; start += proSchub) {
        const schub = table.rows.slice(start, start + proSchub);
        const werte: DumpValue[] = [];
        const platzhalter = schub.map((row) => {
          const stelle = indizes.map(({ index }) => {
            werte.push(row[index] ?? null);
            return `$${werte.length}`;
          });
          return `(${stelle.join(", ")})`;
        });

        await client.query(
          `insert into ${quote(name)} (${ziel}) values ${platzhalter.join(", ")}`,
          werte,
        );
      }
    }

    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  }
}
