import { getPool } from "@/lib/db/pool";
import {
  createChatNachricht,
  deleteChatNachrichten,
  listChatNachrichten,
} from "@/lib/db/chat-nachrichten";
import { tripBelongsToAccount } from "@/lib/db/trips";
import { currentSession } from "@/lib/auth/current-session";
import { unauthorized } from "@/lib/auth/api-guard";
import { accountApiKey } from "@/lib/api-keys/account-keys";
import { createAnthropicChatClient } from "@/lib/ai/anthropic-client";
import { chatZeile, type ChatEreignis } from "@/lib/chat/strom";
import { istChatModell } from "@/lib/chat/modelle";
import { chatEingabeFehler, zuSendenderText } from "@/lib/chat/validate";

/**
 * Die Schnittstelle des Chatfensters im Planer (req-081): GET holt die
 * Unterhaltung einer Reise, POST sendet eine Frage und laesst die Antwort
 * stueckweise zurueckkommen, DELETE verwirft die Unterhaltung.
 *
 * Ohne Anmeldung geht hier nichts, und der Mandant kommt ausschliesslich aus
 * der Anmeldung, nie aus der Anfrage (req-024). Wer eine Reise nicht sieht,
 * sieht ihre Unterhaltung nicht (req-023, security.md) -- die Kennung der
 * Reise kommt aus der Anfrage und wird deshalb hier gegen den Account
 * geprueft.
 *
 * Die Antwort kostet Geld und wird ueber den Anthropic-Zugangsschluessel des
 * Accounts abgerechnet (req-028): ohne ihn fragt die Schnittstelle gar nicht
 * erst. Geprueft wird das hier und nicht nur in der Oberflaeche.
 */

function invalidBody() {
  return Response.json({ error: "invalid body" }, { status: 400 });
}

function unknownTrip() {
  return Response.json({ error: "unknown trip" }, { status: 404 });
}

async function readBody(
  request: Request,
): Promise<Record<string, unknown> | null> {
  try {
    const body = await request.json();
    return typeof body === "object" && body !== null
      ? (body as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

/** Die Unterhaltung der Reise -- sie ueberdauert das Neuladen der Seite. */
export async function GET(request: Request) {
  const session = await currentSession();
  if (!session) return unauthorized();
  const accountId = session.accountId;

  const tripId = new URL(request.url).searchParams.get("tripId")?.trim() ?? "";
  if (tripId.length === 0) return invalidBody();

  const db = getPool();
  if (!(await tripBelongsToAccount(db, accountId, tripId))) {
    return unknownTrip();
  }

  return Response.json({
    nachrichten: await listChatNachrichten(db, accountId, tripId),
  });
}

/**
 * Eine Frage senden und die Antwort erhalten, waehrend sie entsteht
 * (req-081). Der Koerper der Antwort ist ein Strom von JSON-Zeilen (siehe
 * lib/chat/strom.ts) -- bei laengeren Antworten entstuende sonst der
 * Eindruck, es haenge.
 */
export async function POST(request: Request) {
  const session = await currentSession();
  if (!session) return unauthorized();
  const accountId = session.accountId;

  const body = await readBody(request);
  const tripId = typeof body?.tripId === "string" ? body.tripId.trim() : "";
  const eingabe = typeof body?.text === "string" ? body.text : "";
  const modell = body?.modell;
  if (
    !body ||
    tripId.length === 0 ||
    chatEingabeFehler(eingabe) !== null ||
    !istChatModell(modell)
  ) {
    return invalidBody();
  }
  // Nach der Pruefung steht hier Text -- chatEingabeFehler hat das Leere
  // bereits abgewiesen.
  const text = zuSendenderText(eingabe) ?? eingabe;

  const db = getPool();
  if (!(await tripBelongsToAccount(db, accountId, tripId))) {
    return unknownTrip();
  }

  // Bezahlt wird die Antwort vom Account, in dem gerade gearbeitet wird
  // (req-028) -- auf den Schluessel eines anderen wird nie zurueckgegriffen,
  // und der Schluessel der Umgebung (OPENAI_API_KEY) taugt dafuer ohnehin
  // nicht.
  const apiKey = await accountApiKey(db, accountId, "anthropic");
  if (!apiKey) {
    return Response.json({ error: "kein Zugangsschluessel" }, { status: 409 });
  }

  // Die Frage wird abgelegt, bevor gefragt wird: schlaegt die Antwort fehl,
  // ist sie nicht verloren und laesst sich erneut senden (req-081).
  const frage = await createChatNachricht(
    db,
    accountId,
    tripId,
    { rolle: "ich", text, modell: null },
    new Date(),
  );
  if (!frage) return unknownTrip();

  // Der Zusammenhang ist der Verlauf dieser Reise, die neue Frage zuletzt --
  // und nichts weiter: keine Werkzeuge, keine Reisedaten (req-081).
  const verlauf = await listChatNachrichten(db, accountId, tripId);
  const ai = createAnthropicChatClient({ apiKey });

  const strom = new ReadableStream<Uint8Array>({
    async start(controller) {
      const encoder = new TextEncoder();
      function sende(ereignis: ChatEreignis) {
        controller.enqueue(encoder.encode(chatZeile(ereignis)));
      }

      sende({ art: "frage", nachricht: frage });

      let antwortText = "";
      for await (const stueck of ai.antworte({
        modell,
        verlauf: verlauf.map((nachricht) => ({
          rolle: nachricht.rolle,
          text: nachricht.text,
        })),
      })) {
        if (stueck.art === "fehler") {
          // Der Grund steht im Verlauf an der Stelle, an der die Antwort
          // stuende. Eine halbe Antwort wird dabei NICHT abgelegt: die Frage
          // soll sich erneut senden lassen, ohne dass ein Bruchstueck im
          // Verlauf stehen bleibt.
          sende({ art: "fehler", grund: stueck.fehler.art });
          controller.close();
          return;
        }
        antwortText += stueck.text;
        sende(stueck);
      }

      const antwort = await createChatNachricht(
        db,
        accountId,
        tripId,
        { rolle: "ki", text: antwortText, modell },
        new Date(),
      );
      if (antwort) sende({ art: "antwort", nachricht: antwort });
      controller.close();
    },
  });

  return new Response(strom, {
    headers: {
      // Eine Zeile je Stueck (application/x-ndjson), nicht ein fertiger
      // Koerper.
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

/** Die Unterhaltung verwerfen (req-081): danach ist der Verlauf leer. */
export async function DELETE(request: Request) {
  const session = await currentSession();
  if (!session) return unauthorized();
  const accountId = session.accountId;

  const body = await readBody(request);
  const tripId = typeof body?.tripId === "string" ? body.tripId.trim() : "";
  if (!body || tripId.length === 0) return invalidBody();

  const db = getPool();
  if (!(await tripBelongsToAccount(db, accountId, tripId))) {
    return unknownTrip();
  }

  await deleteChatNachrichten(db, accountId, tripId);
  return Response.json({ nachrichten: [] });
}
