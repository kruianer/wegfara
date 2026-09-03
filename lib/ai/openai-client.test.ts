// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { createOpenAiClient, environmentOpenAiKey } from "./openai-client";

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

function client(fetchMock: unknown, apiKey = "test-key") {
  return createOpenAiClient({
    apiKey,
    fetch: fetchMock as unknown as typeof fetch,
  });
}

describe("createOpenAiClient", () => {
  it("liefert den Antworttext der Chat-Completion", async () => {
    const fetchMock = vi.fn(async () =>
      chatCompletionResponse('{"names": ["Alberobello"]}'),
    );

    const result = await client(fetchMock).complete("Nenne einen Ort.");

    expect(result).toBe('{"names": ["Alberobello"]}');
    expect(fetchMock).toHaveBeenCalled();
  });

  it("liefert null, wenn der Dienst nicht erreichbar ist", async () => {
    const fetchMock = vi.fn(async () => {
      throw new Error("network down");
    });

    expect(await client(fetchMock).complete("Nenne einen Ort.")).toBeNull();
  });

  it("liefert null bei einer Fehler-Antwort", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(JSON.stringify({ error: { message: "boom" } }), {
          status: 500,
        }),
    );

    expect(await client(fetchMock).complete("Nenne einen Ort.")).toBeNull();
  });

  /**
   * Der Schluessel kommt vom Account, in dem gerade gearbeitet wird
   * (req-028) -- nicht aus der Umgebung. Sonst suchte ein Account auf Kosten
   * eines anderen.
   */
  it("sendet den mitgegebenen Zugangsschluessel und nicht den aus der Umgebung", async () => {
    vi.stubEnv("OPENAI_API_KEY", "schluessel-der-umgebung");
    const fetchMock = vi.fn(async () => chatCompletionResponse("ok"));

    await client(fetchMock, "schluessel-des-accounts").complete("Frage");

    const [, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      { headers: Headers },
    ];
    const headers = new Headers(init.headers);
    expect(headers.get("authorization")).toBe("Bearer schluessel-des-accounts");
    vi.unstubAllEnvs();
  });
});

describe("environmentOpenAiKey (req-028)", () => {
  it("liefert den Schluessel fuer Dienste ohne Account-Bezug", () => {
    vi.stubEnv("OPENAI_API_KEY", "schluessel-der-umgebung");

    expect(environmentOpenAiKey()).toBe("schluessel-der-umgebung");
    vi.unstubAllEnvs();
  });

  it("liefert null, wenn keiner hinterlegt ist", () => {
    vi.stubEnv("OPENAI_API_KEY", "");

    expect(environmentOpenAiKey()).toBeNull();
    vi.unstubAllEnvs();
  });
});
