import { randomUUID } from "node:crypto";
import type { Queryable } from "./queryable";
import { tripBelongsToAccount } from "./trips";
import type {
  ChatNachricht,
  ChatQuelle,
  ChatRolle,
  NeueChatNachricht,
} from "../chat/types";
import {
  PLAN_FEHLER_ARTEN,
  WEB_SUCHE_FEHLER_ARTEN,
  type PlanFehlerArt,
  type WebSucheFehlerArt,
} from "../ai/fehler";
import { istPlanWerkzeug, type PlanWerkzeug } from "../ai/chat-client";

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
  suche_fehler: string | null;
  plan_einblicke: string;
  plan_fehler: string | null;
  created_at: unknown;
}

interface ChatQuelleRow extends Record<string, unknown> {
  chat_nachricht_id: string;
  url: string;
  titel: string;
}

const CHAT_COLUMNS = `c.id, c.trip_id, c.rolle, c.text, c.modell, c.suche_fehler,
                      c.plan_einblicke, c.plan_fehler, c.created_at`;

function toSucheFehler(value: string | null): WebSucheFehlerArt | null {
  return WEB_SUCHE_FEHLER_ARTEN.find((art) => art === value) ?? null;
}

function toPlanFehler(value: string | null): PlanFehlerArt | null {
  return PLAN_FEHLER_ARTEN.find((art) => art === value) ?? null;
}

/** Die Blicke in den Plan liegen kommagetrennt ab (req-093). */
function toPlanEinblicke(value: string | null): PlanWerkzeug[] {
  return (value ?? "").split(",").filter(istPlanWerkzeug);
}

/** `timestamptz` liefert der Treiber als Date, das Test-Double als Text. */
function toIsoInstant(value: unknown): string {
  return value instanceof Date
    ? value.toISOString()
    : new Date(String(value)).toISOString();
}

function toChatNachricht(
  row: ChatNachrichtRow,
  quellen: ChatQuelle[],
): ChatNachricht {
  return {
    id: row.id,
    tripId: row.trip_id,
    rolle: row.rolle as ChatRolle,
    text: row.text,
    modell: row.modell,
    quellen,
    sucheFehler: toSucheFehler(row.suche_fehler),
    planEinblicke: toPlanEinblicke(row.plan_einblicke),
    planFehler: toPlanFehler(row.plan_fehler),
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

  // Die Quellen der Antworten (req-092), in der Reihenfolge, in der die
  // Antwort sie nennt -- eine Abfrage fuer die ganze Unterhaltung.
  const { rows: quellRows } = await db.query<ChatQuelleRow>(
    `select q.chat_nachricht_id, q.url, q.titel
     from chat_quelle q
     join chat_nachricht c on c.id = q.chat_nachricht_id
     join trip t on t.id = c.trip_id
     where t.account_id = $1 and c.trip_id = $2
     order by q.chat_nachricht_id asc, q.position asc`,
    [accountId, tripId],
  );
  const quellen = new Map<string, ChatQuelle[]>();
  for (const row of quellRows) {
    const liste = quellen.get(row.chat_nachricht_id) ?? [];
    liste.push({ url: row.url, titel: row.titel });
    quellen.set(row.chat_nachricht_id, liste);
  }

  return rows.map((row) => toChatNachricht(row, quellen.get(row.id) ?? []));
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
  const quellen = nachricht.quellen ?? [];
  const sucheFehler = nachricht.sucheFehler ?? null;
  // Je Werkzeug einmal, in der Reihenfolge des ersten Blicks (req-093).
  const planEinblicke = [...new Set(nachricht.planEinblicke ?? [])];
  const planFehler = nachricht.planFehler ?? null;
  await db.query(
    `insert into chat_nachricht (id, trip_id, rolle, text, modell, suche_fehler,
                                 plan_einblicke, plan_fehler, created_at)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      id,
      tripId,
      nachricht.rolle,
      nachricht.text,
      nachricht.modell,
      sucheFehler,
      planEinblicke.join(","),
      planFehler,
      now,
    ],
  );
  for (const [position, quelle] of quellen.entries()) {
    await db.query(
      `insert into chat_quelle (id, chat_nachricht_id, position, url, titel)
       values ($1, $2, $3, $4, $5)`,
      [randomUUID(), id, position, quelle.url, quelle.titel],
    );
  }
  return {
    id,
    tripId,
    rolle: nachricht.rolle,
    text: nachricht.text,
    modell: nachricht.modell,
    quellen,
    sucheFehler,
    planEinblicke,
    planFehler,
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
