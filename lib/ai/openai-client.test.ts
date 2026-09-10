// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  aiFehlerAusOpenAi,
  createOpenAiClient,
  environmentOpenAiKey,
  openAiModel,
} from "./openai-client";

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

function fehlerAntwort(status: number, message: string) {
  return new Response(JSON.stringify({ error: { message } }), { status });
}

function client(fetchMock: unknown, apiKey = "test-key") {
  return createOpenAiClient({
    apiKey,
    fetch: fetchMock as unknown as typeof fetch,
  });
}

/** Das Modell, mit dem der Aufruf tatsaechlich hinausging. */
async function gesendetesModell(fetchMock: {
  mock: { calls: unknown[][] };
}): Promise<string> {
  const [, init] = fetchMock.mock.calls[0] as [string, { body: string }];
  return (JSON.parse(init.body) as { model: string }).model;
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("openAiModel (bug-032)", () => {
  it("nimmt den Namen aus OPENAI_MODEL", () => {
    vi.stubEnv("OPENAI_MODEL", "gpt-4.1-mini");

    expect(openAiModel()).toBe("gpt-4.1-mini");
  });

  /**
   * Der Bug: docker-compose reicht `OPENAI_MODEL: ${OPENAI_MODEL}` auch dann
   * durch, wenn die Variable in der .env-Datei fehlt -- im Container kam der
   * leere String an. Mit `??` gelesen ging `model: ""` hinaus, und OpenAI
   * antwortete mit 400 "you must provide a model parameter".
   */
  it("nimmt den Standard, wenn OPENAI_MODEL leer durchgereicht wird", () => {
    vi.stubEnv("OPENAI_MODEL", "");

    expect(openAiModel()).toBe("gpt-5.6-luna");
  });

  it("nimmt den Standard, wenn OPENAI_MODEL nur Leerraum enthaelt", () => {
    vi.stubEnv("OPENAI_MODEL", "   ");

    expect(openAiModel()).toBe("gpt-5.6-luna");
  });
});

describe("createOpenAiClient", () => {
  it("liefert den Antworttext der Chat-Completion", async () => {
    const fetchMock = vi.fn(async () =>
      chatCompletionResponse('{"names": ["Alberobello"]}'),
    );

    const result = await client(fetchMock).complete("Nenne einen Ort.");

    expect(result).toEqual({ ok: true, text: '{"names": ["Alberobello"]}' });
    expect(fetchMock).toHaveBeenCalled();
  });

  it("schickt bei leerem OPENAI_MODEL den Standard-Modellnamen mit", async () => {
    vi.stubEnv("OPENAI_MODEL", "");
    vi.spyOn(console, "error").mockImplementation(() => {});
    const fetchMock = vi.fn(async () => chatCompletionResponse("ok"));

    await client(fetchMock).complete("Nenne einen Ort.");

    expect(await gesendetesModell(fetchMock)).toBe("gpt-5.6-luna");
  });

  it("nennt den Grund, wenn der Dienst nicht erreichbar ist", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const fetchMock = vi.fn(async () => {
      throw new Error("network down");
    });

    const antwort = await client(fetchMock).complete("Nenne einen Ort.");

    expect(antwort.ok).toBe(false);
    expect(antwort.ok === false && antwort.fehler.art).toBe("netz");
  });

  it("nennt den Grund bei einer Fehler-Antwort des Dienstes", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const fetchMock = vi.fn(async () => fehlerAntwort(500, "boom"));

    const antwort = await client(fetchMock).complete("Nenne einen Ort.");

    expect(antwort).toEqual({
      ok: false,
      fehler: { art: "dienst", detail: "boom" },
    });
  });

  /**
   * Der Fall aus bug-032, wie er auf dev ankam: OpenAI sagt genau, was fehlt.
   * Genau dieser Satz gehoert weitergereicht -- ein blosses "Fehler" schickt
   * den Nutzer zu seinem Zugangsschluessel (vgl. bug-021, bug-026).
   */
  it("erkennt einen fehlenden Modellnamen und reicht die Worte des Dienstes weiter", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const fetchMock = vi.fn(async () =>
      fehlerAntwort(400, "you must provide a model parameter"),
    );

    const antwort = await client(fetchMock).complete("Nenne einen Ort.");

    expect(antwort).toEqual({
      ok: false,
      fehler: {
        art: "modell",
        detail: "you must provide a model parameter",
      },
    });
  });

  it("schreibt den Grund ins Log", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const fetchMock = vi.fn(async () =>
      fehlerAntwort(400, "you must provide a model parameter"),
    );

    await client(fetchMock).complete("Nenne einen Ort.");

    expect(log).toHaveBeenCalledWith(
      expect.stringContaining("you must provide a model parameter"),
    );
  });

  it("nennt eine Antwort ohne Inhalt als eigenen Grund", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const fetchMock = vi.fn(async () => chatCompletionResponse(""));

    const antwort = await client(fetchMock).complete("Nenne einen Ort.");

    expect(antwort.ok === false && antwort.fehler.art).toBe("leer");
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
  });

  /**
   * Kennt das Modell die Websuche nicht, wird ohne sie gefragt (req-058).
   * Scheitert auch das, steht am Ende der Grund des zweiten Versuchs.
   */
  it("fragt ohne Websuche weiter und nennt sonst den Grund", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(fehlerAntwort(400, "unknown tool: web_search"))
      .mockResolvedValueOnce(chatCompletionResponse("ohne Suche"));

    const antwort = await client(fetchMock).completeWithWebSearch("Frage");

    expect(antwort).toEqual({ ok: true, text: "ohne Suche" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("liefert den Grund, wenn auch der Versuch ohne Websuche scheitert", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const fetchMock = vi.fn(async () =>
      fehlerAntwort(401, "Incorrect API key provided"),
    );

    const antwort = await client(fetchMock).completeWithWebSearch("Frage");

    expect(antwort.ok === false && antwort.fehler.art).toBe("zugang");
  });
});

describe("aiFehlerAusOpenAi (bug-032)", () => {
  it.each([
    [401, "Incorrect API key provided", "zugang"],
    [403, "Country not supported", "zugang"],
    [429, "You exceeded your current quota", "kontingent"],
    [404, "The model does not exist", "modell"],
    [400, "you must provide a model parameter", "modell"],
    [400, "messages is required", "anfrage"],
    [503, "The engine is overloaded", "dienst"],
  ])("bildet %i auf %s ab", (status, message, art) => {
    expect(aiFehlerAusOpenAi({ status, error: { message } })).toEqual({
      art,
      detail: message,
    });
  });

  it("gilt ohne Status als nicht erreichbar", () => {
    expect(aiFehlerAusOpenAi(new Error("fetch failed"))).toEqual({
      art: "netz",
      detail: "fetch failed",
    });
  });
});

describe("environmentOpenAiKey (req-028)", () => {
  it("liefert den Schluessel fuer Dienste ohne Account-Bezug", () => {
    vi.stubEnv("OPENAI_API_KEY", "schluessel-der-umgebung");

    expect(environmentOpenAiKey()).toBe("schluessel-der-umgebung");
  });

  it("liefert null, wenn keiner hinterlegt ist", () => {
    vi.stubEnv("OPENAI_API_KEY", "");

    expect(environmentOpenAiKey()).toBeNull();
  });
});
