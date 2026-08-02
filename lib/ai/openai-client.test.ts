// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createOpenAiClient } from "./openai-client";

beforeEach(() => {
  vi.stubEnv("OPENAI_API_KEY", "test-key");
});

function chatCompletionResponse(content: string) {
  return new Response(
    JSON.stringify({
      id: "chatcmpl-1",
      object: "chat.completion",
      created: 0,
      model: "gpt-5.6-luna",
      choices: [
        {
          index: 0,
          message: { role: "assistant", content },
          finish_reason: "stop",
        },
      ],
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}

describe("createOpenAiClient", () => {
  it("liefert den Antworttext der Chat-Completion", async () => {
    const fetchMock = vi.fn(async () =>
      chatCompletionResponse('{"names": ["Alberobello"]}'),
    );
    const client = createOpenAiClient(fetchMock as unknown as typeof fetch);

    const result = await client.complete("Nenne einen Ort.");

    expect(result).toBe('{"names": ["Alberobello"]}');
    expect(fetchMock).toHaveBeenCalled();
  });

  it("liefert null, wenn der Dienst nicht erreichbar ist", async () => {
    const fetchMock = vi.fn(async () => {
      throw new Error("network down");
    });
    const client = createOpenAiClient(fetchMock as unknown as typeof fetch);

    expect(await client.complete("Nenne einen Ort.")).toBeNull();
  });

  it("liefert null bei einer Fehler-Antwort", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(JSON.stringify({ error: { message: "boom" } }), {
          status: 500,
        }),
    );
    const client = createOpenAiClient(fetchMock as unknown as typeof fetch);

    expect(await client.complete("Nenne einen Ort.")).toBeNull();
  });
});
