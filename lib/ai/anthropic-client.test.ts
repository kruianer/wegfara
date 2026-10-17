// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { stromText } from "./chat-client";
import {
  CHAT_SYSTEM_PROMPT,
  aiFehlerAusAnthropic,
  createAnthropicChatClient,
} from "./anthropic-client";

/** Ein Ereignis im Format des Dienstes (Server-Sent Events). */
function ereignis(type: string, data: unknown): string {
  return `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`;
}

const START = ereignis("message_start", {
  type: "message_start",
  message: {
    id: "msg_1",
    type: "message",
    role: "assistant",
    model: "claude-sonnet-5",
    content: [],
    stop_reason: null,
    stop_sequence: null,
    usage: { input_tokens: 10, output_tokens: 0 },
  },
});

const BLOCK_START = ereignis("content_block_start", {
  type: "content_block_start",
  index: 0,
  content_block: { type: "text", text: "", citations: null },
});

function textStueck(text: string): string {
  return ereignis("content_block_delta", {
    type: "content_block_delta",
    index: 0,
    delta: { type: "text_delta", text },
  });
}

const BLOCK_STOP = ereignis("content_block_stop", {
  type: "content_block_stop",
  index: 0,
});

function ende(stopReason: string, stopDetails: unknown = null): string {
  return (
    ereignis("message_delta", {
      type: "message_delta",
      delta: {
        stop_reason: stopReason,
        stop_sequence: null,
        stop_details: stopDetails,
        container: null,
      },
      usage: { output_tokens: 5 },
    }) + ereignis("message_stop", { type: "message_stop" })
  );
}

/** Der Dienst antwortet mit diesen Ereignissen, Stueck fuer Stueck. */
function antwortet(...teile: string[]) {
  return vi.fn(
    async () =>
      new Response(
        new ReadableStream<Uint8Array>({
          start(controller) {
            const encoder = new TextEncoder();
            for (const teil of teile) controller.enqueue(encoder.encode(teil));
            controller.close();
          },
        }),
        { status: 200, headers: { "Content-Type": "text/event-stream" } },
      ),
  );
}

function scheitert(status: number, message: string) {
  return vi.fn(
    async () =>
      new Response(JSON.stringify({ error: { message } }), {
        status,
        headers: { "Content-Type": "application/json" },
      }),
  );
}

function client(fetchMock: unknown, apiKey = "sk-ant-test") {
  return createAnthropicChatClient({
    apiKey,
    fetch: fetchMock as unknown as typeof fetch,
  });
}

/** Was tatsaechlich hinausging. */
function gesendet(fetchMock: { mock: { calls: unknown[][] } }) {
  const [, init] = fetchMock.mock.calls[0] as [string, { body: string }];
  return JSON.parse(init.body) as Record<string, unknown>;
}

const EINE_FRAGE = [{ rolle: "ich" as const, text: "Was gibt es in Amalfi?" }];

describe("Anthropic-Anbindung des Chats (req-081)", () => {
  it("liefert die Antwort stueckweise, waehrend sie entsteht", async () => {
    const fetchMock = antwortet(
      START,
      BLOCK_START,
      textStueck("In Amalfi "),
      textStueck("gibt es den Dom."),
      BLOCK_STOP,
      ende("end_turn"),
    );

    const stuecke = [];
    for await (const stueck of client(fetchMock).antworte({
      modell: "claude-sonnet-5",
      verlauf: EINE_FRAGE,
    })) {
      stuecke.push(stueck);
    }

    expect(stuecke).toEqual([
      { art: "text", text: "In Amalfi " },
      { art: "text", text: "gibt es den Dom." },
    ]);
  });

  it("fragt das Modell, das der Aufrufer nennt", async () => {
    const fetchMock = antwortet(
      START,
      BLOCK_START,
      textStueck("Gern."),
      BLOCK_STOP,
      ende("end_turn"),
    );

    await stromText(
      client(fetchMock).antworte({
        modell: "claude-opus-5",
        verlauf: EINE_FRAGE,
      }),
    );

    expect(gesendet(fetchMock).model).toBe("claude-opus-5");
  });

  it("gibt den ganzen Verlauf als Zusammenhang mit", async () => {
    const fetchMock = antwortet(
      START,
      BLOCK_START,
      textStueck("Ja."),
      BLOCK_STOP,
      ende("end_turn"),
    );

    await stromText(
      client(fetchMock).antworte({
        modell: "claude-sonnet-5",
        verlauf: [
          { rolle: "ich", text: "Erste Frage" },
          { rolle: "ki", text: "Erste Antwort" },
          { rolle: "ich", text: "Zweite Frage" },
        ],
      }),
    );

    expect(gesendet(fetchMock).messages).toEqual([
      { role: "user", content: "Erste Frage" },
      { role: "assistant", content: "Erste Antwort" },
      { role: "user", content: "Zweite Frage" },
    ]);
  });

  /**
   * Keine Werkzeuge und keine Reisedaten im Zusammenhang (req-081,
   * Constraints): die KI antwortet auf das Geschriebene, nichts weiter.
   */
  it("gibt der KI keine Werkzeuge", async () => {
    const fetchMock = antwortet(
      START,
      BLOCK_START,
      textStueck("Gern."),
      BLOCK_STOP,
      ende("end_turn"),
    );

    await stromText(
      client(fetchMock).antworte({
        modell: "claude-sonnet-5",
        verlauf: EINE_FRAGE,
      }),
    );

    const körper = gesendet(fetchMock);
    expect(körper.tools).toBeUndefined();
    // Der Systemtext ist eine Konstante: er nennt weder die geoeffnete Reise
    // noch einen ihrer Orte oder Tage -- er sagt im Gegenteil, dass die KI
    // die Reise nicht kennt.
    expect(körper.system).toBe(CHAT_SYSTEM_PROMPT);
    expect(CHAT_SYSTEM_PROMPT).toContain("kennst die geöffnete Reise nicht");
  });

  it("begrenzt die Laenge einer Antwort", async () => {
    const fetchMock = antwortet(
      START,
      BLOCK_START,
      textStueck("Gern."),
      BLOCK_STOP,
      ende("end_turn"),
    );

    await stromText(
      client(fetchMock).antworte({
        modell: "claude-sonnet-5",
        verlauf: EINE_FRAGE,
      }),
    );

    expect(gesendet(fetchMock).max_tokens).toBe(8192);
  });

  it("nimmt den Zugangsschluessel des Accounts mit", async () => {
    const fetchMock = antwortet(
      START,
      BLOCK_START,
      textStueck("Gern."),
      BLOCK_STOP,
      ende("end_turn"),
    );

    await stromText(
      client(fetchMock, "sk-ant-account").antworte({
        modell: "claude-sonnet-5",
        verlauf: EINE_FRAGE,
      }),
    );

    const [, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      { headers: HeadersInit },
    ];
    const headers = new Headers(init.headers);
    expect(headers.get("x-api-key")).toBe("sk-ant-account");
  });
});

/**
 * Ein Fehler wird benannt und nicht verschluckt (bug-021, bug-026, bug-027,
 * bug-032) -- jeder Grund kommt mit seinem Namen beim Aufrufer an.
 */
describe("Fehlschlaege der Anthropic-Anbindung (bug-032, req-081)", () => {
  it("nennt einen abgelehnten Zugangsschluessel", async () => {
    const { fehler } = await stromText(
      client(scheitert(401, "invalid x-api-key")).antworte({
        modell: "claude-sonnet-5",
        verlauf: EINE_FRAGE,
      }),
    );

    expect(fehler?.art).toBe("zugang");
    expect(fehler?.detail).toContain("invalid x-api-key");
  });

  it("nennt ein erschoepftes Kontingent", async () => {
    const { fehler } = await stromText(
      client(scheitert(429, "rate limited")).antworte({
        modell: "claude-sonnet-5",
        verlauf: EINE_FRAGE,
      }),
    );

    expect(fehler?.art).toBe("kontingent");
  });

  it("nennt ein unbekanntes Modell", async () => {
    const { fehler } = await stromText(
      client(scheitert(404, "model not found")).antworte({
        modell: "claude-gibt-es-nicht",
        verlauf: EINE_FRAGE,
      }),
    );

    expect(fehler?.art).toBe("modell");
  });

  it("nennt eine Stoerung des Dienstes", async () => {
    const { fehler } = await stromText(
      client(scheitert(500, "overloaded")).antworte({
        modell: "claude-sonnet-5",
        verlauf: EINE_FRAGE,
      }),
    );

    expect(fehler?.art).toBe("dienst");
  });

  it("nennt einen nicht erreichbaren Dienst", async () => {
    const netzAus = vi.fn(async () => {
      throw new Error("network down");
    });

    const { fehler } = await stromText(
      client(netzAus).antworte({
        modell: "claude-sonnet-5",
        verlauf: EINE_FRAGE,
      }),
    );

    expect(fehler?.art).toBe("netz");
  });

  /**
   * Eine abgelehnte Anfrage kommt mit HTTP 200 zurueck und traegt den Grund
   * "refusal" -- sie darf nicht als leere Antwort im Verlauf erscheinen.
   */
  it("nennt eine abgelehnte Anfrage", async () => {
    const fetchMock = antwortet(
      START,
      BLOCK_START,
      textStueck("Dazu "),
      BLOCK_STOP,
      ende("refusal", {
        type: "refusal",
        category: "cyber",
        explanation: "Die Anfrage wurde abgelehnt.",
      }),
    );

    const { text, fehler } = await stromText(
      client(fetchMock).antworte({
        modell: "claude-opus-5",
        verlauf: EINE_FRAGE,
      }),
    );

    // Was bis dahin kam, bleibt stehen; dahinter steht der Grund.
    expect(text).toBe("Dazu ");
    expect(fehler?.art).toBe("anfrage");
    expect(fehler?.detail).toBe("Die Anfrage wurde abgelehnt.");
  });

  it("nennt eine Antwort ohne Inhalt", async () => {
    const fetchMock = antwortet(
      START,
      BLOCK_START,
      BLOCK_STOP,
      ende("end_turn"),
    );

    const { text, fehler } = await stromText(
      client(fetchMock).antworte({
        modell: "claude-sonnet-5",
        verlauf: EINE_FRAGE,
      }),
    );

    expect(text).toBe("");
    expect(fehler?.art).toBe("leer");
  });

  it("bildet einen Fehlschlag ohne Status auf das Netz ab", () => {
    expect(aiFehlerAusAnthropic(new Error("boom")).art).toBe("netz");
  });
});
