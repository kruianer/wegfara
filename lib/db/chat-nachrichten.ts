import { randomUUID } from "node:crypto";
import type { Queryable } from "./queryable";
import { tripBelongsToAccount } from "./trips";
import type {
  ChatNachricht,
  ChatRolle,
  NeueChatNachricht,
} from "../chat/types";

/**
 * Der Datenzugriff auf den Verlauf des Chatfensters im Planer (req-081).
 *
 * Die Mandantentrennung laeuft ueber die Reise, wie bei poi, activity,
 * document und kostenzeile: jede Abfrage filtert nach dem Account, zu dem die
 * Reise gehoert. Wer eine Reise nicht sieht, sieht ihre Unterhaltung nicht
 * (req-023, security.md) -- und eine Reise eines fremden Accounts existiert
 * fuer diese Sitzung gar nicht.
 */

interface ChatNachrichtRow extends Record<string, unknown> {
  id: string;
  trip_id: string;
  rolle: string;
  text: string;
  modell: string | null;
  created_at: unknown;
}

const CHAT_COLUMNS = `c.id, c.trip_id, c.rolle, c.text, c.modell, c.created_at`;

/** `timestamptz` liefert der Treiber als Date, das Test-Double als Text. */
function toIsoInstant(value: unknown): string {
  return value instanceof Date
    ? value.toISOString()
    : new Date(String(value)).toISOString();
}

function toChatNachricht(row: ChatNachrichtRow): ChatNachricht {
  return {
    id: row.id,
    tripId: row.trip_id,
    rolle: row.rolle as ChatRolle,
    text: row.text,
    modell: row.modell,
    createdAt: toIsoInstant(row.created_at),
  };
}

/**
 * Die Unterhaltung einer Reise in zeitlicher Folge (req-081) -- die aelteste
 * Nachricht zuerst, so wie der Verlauf sie zeigt. Bei gleicher Zeit
 * entscheidet die Kennung, damit die Reihenfolge bei jedem Laden dieselbe
 * ist.
 *
 * Eine Reise eines fremden Accounts hat hier keinen Verlauf: die Abfrage
 * findet dann gar nichts.
 */
export async function listChatNachrichten(
  db: Queryable,
  accountId: string,
  tripId: string,
): Promise<ChatNachricht[]> {
  const { rows } = await db.query<ChatNachrichtRow>(
    `select ${CHAT_COLUMNS}
     from chat_nachricht c
     join trip t on t.id = c.trip_id
     where t.account_id = $1 and c.trip_id = $2
     order by c.created_at asc, c.id asc`,
    [accountId, tripId],
  );
  return rows.map(toChatNachricht);
}

/**
 * Legt eine Nachricht an. Ein Vorgang, bei dem Datenverlust droht -- eine
 * geschriebene Frage und eine erhaltene Antwort sollen nicht an einem
 * geschlossenen Fenster haengen bleiben: geschrieben wird sofort und nicht
 * verzoegert (siehe delivery/stack.md, Conventions).
 *
 * Gehoert die Reise nicht zum Account, entsteht nichts und es kommt null
 * zurueck -- die Kennung der Reise kommt aus der Anfrage und wird deshalb
 * hier gegen den Mandanten geprueft.
 */
export async function createChatNachricht(
  db: Queryable,
  accountId: string,
  tripId: string,
  nachricht: NeueChatNachricht,
  now: Date,
): Promise<ChatNachricht | null> {
  if (!(await tripBelongsToAccount(db, accountId, tripId))) return null;

  const id = randomUUID();
  await db.query(
    `insert into chat_nachricht (id, trip_id, rolle, text, modell, created_at)
     values ($1, $2, $3, $4, $5, $6)`,
    [id, tripId, nachricht.rolle, nachricht.text, nachricht.modell, now],
  );
  return {
    id,
    tripId,
    rolle: nachricht.rolle,
    text: nachricht.text,
    modell: nachricht.modell,
    createdAt: now.toISOString(),
  };
}

/**
 * Verwirft die Unterhaltung einer Reise (req-081): danach ist der Verlauf
 * leer und man kann neu beginnen. Ein Loeschen wird sofort geschrieben, nicht
 * verzoegert (stack.md).
 *
 * Gehoert die Reise nicht zum Account, wird nichts geloescht.
 */
export async function deleteChatNachrichten(
  db: Queryable,
  accountId: string,
  tripId: string,
): Promise<void> {
  if (!(await tripBelongsToAccount(db, accountId, tripId))) return;

  await db.query(`delete from chat_nachricht where trip_id = $1`, [tripId]);
}
