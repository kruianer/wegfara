import { getPool } from "@/lib/db/pool";
import { currentSession } from "@/lib/auth/current-session";
import { unauthorized } from "@/lib/auth/api-guard";
import { accountApiKey } from "@/lib/api-keys/account-keys";
import { createAnthropicModellKatalog } from "@/lib/ai/anthropic-client";
import { chatModelleZwischengespeichert } from "@/lib/chat/modell-katalog-cache";
import type { ChatModelleAntwort } from "@/lib/chat/senden";

/**
 * Die Modellauswahl des Chatfensters (req-090): welche Modelle der Dienst
 * gerade anbietet. Gefragt wird hier im Server und nie im Browser -- der
 * Zugangsschluessel des Accounts (req-028) verlaesst den Server nicht.
 *
 * Die Antwort kommt aus dem Zwischenspeicher, solange der frisch ist; das
 * Oeffnen des Chats loest also nicht jedes Mal eine Anfrage beim Dienst aus.
 */
export async function GET() {
  const session = await currentSession();
  if (!session) return unauthorized();
  const accountId = session.accountId;

  const apiKey = await accountApiKey(getPool(), accountId, "anthropic");
  if (!apiKey) {
    return Response.json({
      modelle: null,
      grund: "schluessel",
    } satisfies ChatModelleAntwort);
  }

  const modelle = await chatModelleZwischengespeichert(
    accountId,
    () => createAnthropicModellKatalog({ apiKey }),
    Date.now(),
  );
  return Response.json(
    (modelle
      ? { modelle, grund: null }
      : { modelle: null, grund: "dienst" }) satisfies ChatModelleAntwort,
    { headers: { "Cache-Control": "no-store" } },
  );
}
