import { randomUUID } from "node:crypto";
import type { Queryable } from "../db/queryable";
import { createAccount } from "../db/accounts";
import { createCredential } from "../db/credentials";
import {
  anyParticipantExists,
  createFirstParticipant,
} from "../db/participants";
import { OPERATOR_EMAIL } from "../operator";
import { beginSession, type LoginResult } from "./login";
import { normalizeEmail } from "./email";

/**
 * Ersteinrichtung (req-037): der Weg, auf dem eine frisch deployte, leere
 * Umgebung ohne Kommandozeile zu ihrem ersten Zugang kommt.
 *
 * Die Sicherheit liegt darin, dass es diesen Weg nur bei leerer
 * `participant`-Tabelle gibt: wer ihn sieht, ist der Erste. Mit dem ersten
 * Teilnehmer verschwindet er dauerhaft -- auch ueber die direkte URL, weil
 * jede Stelle hier fragt und nicht nur die Anzeige. Das Zeitfenster zwischen
 * Deploy und Ersteinrichtung ist der einzige verwundbare Moment.
 */

/** Der Betreiber, wenn BOOTSTRAP_EMAIL nichts anderes sagt. */
export const DEFAULT_BOOTSTRAP_EMAIL = OPERATOR_EMAIL;

/** Wie Account und Person heissen, solange niemand sie umbenannt hat. */
export const BOOTSTRAP_ACCOUNT_NAME = "Mein Bereich";
export const BOOTSTRAP_PARTICIPANT_NAME = "Betreiber";

export function bootstrapEmail(
  env: Record<string, string | undefined> = process.env,
): string {
  const konfiguriert = env.BOOTSTRAP_EMAIL?.trim();
  return normalizeEmail(konfiguriert ? konfiguriert : DEFAULT_BOOTSTRAP_EMAIL);
}

/**
 * Ob die Ersteinrichtung noch offensteht. Sie steht offen, solange die
 * Installation keine einzige Person kennt.
 */
export async function bootstrapAvailable(db: Queryable): Promise<boolean> {
  return !(await anyParticipantExists(db));
}

/**
 * Die Kennung, unter der der erste Passkey den Betreiber kennt. Sie entsteht
 * beim Anfordern der WebAuthn-Aufforderung und wird beim Hinterlegen wieder
 * verwendet, damit der Passkey auf demselben Benutzer sitzt wie alle
 * spaeteren desselben Kontos.
 */
export function newBootstrapParticipantId(): string {
  return randomUUID();
}

const UUID_MUSTER =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Die Kennung kommt aus einem Cookie und damit vom Browser -- sie wird
 * geprueft, bevor sie als Primaerschluessel in die Datenbank geht.
 */
export function isBootstrapParticipantId(value: unknown): value is string {
  return typeof value === "string" && UUID_MUSTER.test(value);
}

/**
 * Legt in einem Zug den ersten Account, den Betreiber als Teilnehmer mit
 * hinterlegter Adresse und seinen ersten Passkey an -- und meldet ihn an.
 *
 * Die Adresse ist von Anfang an hinterlegt, damit der Wiederherstellungsweg
 * ab der ersten Minute steht und nicht erst, wenn jemand daran denkt, eine zu
 * hinterlegen.
 *
 * Liefert null, wenn die Installation inzwischen doch schon jemanden kennt:
 * die Ersteinrichtung darf sich nicht zweimal ausfuehren lassen.
 */
export async function completeBootstrap(
  db: Queryable,
  participantId: string,
  credential: {
    id: string;
    publicKey: string;
    counter: number;
    transports: string[];
    label: string;
  },
  now: Date,
): Promise<LoginResult | null> {
  if (!(await bootstrapAvailable(db))) return null;

  const email = bootstrapEmail();
  const account = await createAccount(db, BOOTSTRAP_ACCOUNT_NAME, email);
  const participant = await createFirstParticipant(
    db,
    account.id,
    participantId,
    BOOTSTRAP_PARTICIPANT_NAME,
    email,
    now,
  );
  await createCredential(
    db,
    { ...credential, participantId: participant.id },
    now,
  );

  return beginSession(db, participant, now, credential.id);
}
