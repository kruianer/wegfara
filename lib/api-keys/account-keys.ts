import type { Queryable } from "../db/queryable";
import {
  deleteAccountApiKey,
  findAccountApiKeyCiphertext,
  listAccountApiKeys,
  saveAccountApiKey,
} from "../db/account-api-keys";
import {
  decryptSecret,
  encryptSecret,
  secretEncryptionKey,
} from "../secrets/encryption";
import {
  apiKeyStates,
  lastFourOf,
  type ApiKeyKind,
  type ApiKeyState,
} from "./types";

/**
 * Die Zugangsschluessel eines Accounts (req-028) -- die Stelle, an der
 * verschluesselt und entschluesselt wird. Ausserhalb dieser Datei sieht
 * niemand einen Schluessel im Klartext ausser den beiden Aussenanbindungen,
 * die ihn brauchen: OpenAI (req-014) und Google Places (req-026).
 *
 * Laeuft ausschliesslich auf dem Server: der Schluessel wird nach dem
 * Speichern nie wieder ausgegeben, weder in der Oberflaeche noch ueber eine
 * Schnittstelle (req-028, Constraints).
 */

/** Der Zustand beider Arten -- gesetzt mit letzten vier Zeichen, oder nicht. */
export async function accountApiKeyStates(
  db: Queryable,
  accountId: string,
): Promise<ApiKeyState[]> {
  return apiKeyStates(await listAccountApiKeys(db, accountId));
}

/**
 * Der Schluessel dieses Accounts im Klartext -- nur fuer die Anfrage beim
 * jeweiligen Dienst. null heisst: nicht hinterlegt, nicht entschluesselbar
 * oder ohne AUTH_SECRET in der Umgebung. In allen drei Faellen bleibt die
 * Funktion gesperrt; auf den Schluessel eines anderen Accounts oder aus den
 * Umgebungsvariablen wird nie zurueckgegriffen (req-028).
 */
export async function accountApiKey(
  db: Queryable,
  accountId: string,
  kind: ApiKeyKind,
): Promise<string | null> {
  const key = secretEncryptionKey();
  if (!key) return null;

  const ciphertext = await findAccountApiKeyCiphertext(db, accountId, kind);
  if (!ciphertext) return null;

  return decryptSecret(ciphertext, key);
}

/**
 * Hinterlegt einen Schluessel oder ersetzt den vorhandenen und liefert den
 * neuen Zustand beider Arten. Liefert null, wenn ohne AUTH_SECRET gar nicht
 * verschluesselt werden kann -- dann wird nichts gespeichert, statt den
 * Schluessel im Klartext abzulegen.
 */
export async function storeAccountApiKey(
  db: Queryable,
  accountId: string,
  kind: ApiKeyKind,
  apiKey: string,
  now: Date,
): Promise<ApiKeyState[] | null> {
  const key = secretEncryptionKey();
  if (!key) return null;

  await saveAccountApiKey(
    db,
    accountId,
    kind,
    encryptSecret(apiKey, key),
    lastFourOf(apiKey),
    now,
  );
  return accountApiKeyStates(db, accountId);
}

/** Entfernt einen Schluessel und liefert den neuen Zustand beider Arten. */
export async function removeAccountApiKey(
  db: Queryable,
  accountId: string,
  kind: ApiKeyKind,
): Promise<ApiKeyState[]> {
  await deleteAccountApiKey(db, accountId, kind);
  return accountApiKeyStates(db, accountId);
}
