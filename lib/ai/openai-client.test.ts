// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  aiFehlerAusOpenAi,
  createOpenAiClient,
  createOpenAiModellKatalog,
  environmentOpenAiKey,
  openAiAbschaltDatum,
  openAiBildModell,
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

/** Die Antwort des Bilddienstes: das Bild als Base64 (req-072). */
function bildAntwort(inhalt: string) {
  return new Response(
    JSON.stringify({
      created: 0,
      data: [{ b64_json: Buffer.from(inhalt).toString("base64") }],
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

describe("openAiBildModell (req-072)", () => {
  it("nimmt den Namen aus OPENAI_IMAGE_MODEL", () => {
    vi.stubEnv("OPENAI_IMAGE_MODEL", "dall-e-3");

    expect(openAiBildModell()).toBe("dall-e-3");
  });

  it("nimmt den Standard, wenn OPENAI_IMAGE_MODEL leer durchgereicht wird", () => {
    vi.stubEnv("OPENAI_IMAGE_MODEL", "");

    expect(openAiBildModell()).toBe("gpt-image-2.5-flare");
  });

  it("zeigt im Standard nicht auf das abgeschaltete gpt-image-1 (bug-076)", () => {
    vi.stubEnv("OPENAI_IMAGE_MODEL", undefined);

    expect(openAiBildModell()).not.toBe("gpt-image-1");
  });
});

describe("createOpenAiClient.generateImage (req-072)", () => {
  it("liefert die Bilddaten der Antwort", async () => {
    const fetchMock = vi.fn(async () => bildAntwort("bild-bytes"));

    const antwort = await client(fetchMock).generateImage("Ein Wanderweg.");

    expect(antwort.ok).toBe(true);
    expect(
      antwort.ok === true && Buffer.from(antwort.bild.data).toString(),
    ).toBe("bild-bytes");
    expect(antwort.ok === true && antwort.bild.contentType).toBe("image/png");
  });

  it("schickt die Aufforderung und das Bildmodell mit", async () => {
    const fetchMock = vi.fn(async () => bildAntwort("bild-bytes"));

    await client(fetchMock).generateImage("Ein Wanderweg.");

    const [adresse, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      { body: string },
    ];
    expect(String(adresse)).toContain("/images/generations");
    const gesendet = JSON.parse(init.body) as {
      model: string;
      prompt: string;
    };
    expect(gesendet.model).toBe("gpt-image-2.5-flare");
    expect(gesendet.prompt).toBe("Ein Wanderweg.");
  });

  /**
   * Kein halbes Bild (req-072): kommt nichts Verwertbares zurueck, ist das
   * ein benannter Fehlschlag und keine leere Datei.
   */
  it("nennt eine Antwort ohne Bild als eigenen Grund", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const fetchMock = vi.fn(
      async () =>
        new Response(JSON.stringify({ data: [{}] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
    );

    const antwort = await client(fetchMock).generateImage("Ein Wanderweg.");

    expect(antwort.ok === false && antwort.fehler.art).toBe("leer");
  });

  it("nennt den Grund, wenn der Dienst die Anfrage ablehnt", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const fetchMock = vi.fn(async () =>
      fehlerAntwort(400, "Your request was rejected by our safety system"),
    );

    const antwort = await client(fetchMock).generateImage("Ein Wanderweg.");

    expect(antwort).toEqual({
      ok: false,
      fehler: {
        art: "anfrage",
        detail: "Your request was rejected by our safety system",
      },
    });
  });

  it("nennt den Grund, wenn der Zugangsschluessel abgelehnt wird", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const fetchMock = vi.fn(async () =>
      fehlerAntwort(401, "Incorrect API key provided"),
    );

    const antwort = await client(fetchMock).generateImage("Ein Wanderweg.");

    expect(antwort.ok === false && antwort.fehler.art).toBe("zugang");
  });

  it("schreibt den Grund ins Log", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const fetchMock = vi.fn(async () => fehlerAntwort(500, "boom"));

    await client(fetchMock).generateImage("Ein Wanderweg.");

    expect(log).toHaveBeenCalledWith(expect.stringContaining("boom"));
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

describe("createOpenAiModellKatalog (req-108)", () => {
  function modellListe(data: unknown[]) {
    return new Response(JSON.stringify({ object: "list", data }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  it("fragt GET /v1/models mit dem Schluessel des Accounts", async () => {
    const fetchMock = vi.fn(async () =>
      modellListe([
        { id: "gpt-5.6-luna", object: "model", created: 0, owned_by: "openai" },
      ]),
    );

    const ergebnis = await createOpenAiModellKatalog({
      apiKey: "sk-account",
      fetch: fetchMock as unknown as typeof fetch,
    }).liste();

    expect(ergebnis).toEqual({
      modelle: [{ id: "gpt-5.6-luna", abschaltungAm: null }],
      fehler: null,
    });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      { headers: Record<string, string> | Headers },
    ];
    expect(String(url)).toMatch(/\/v1\/models$/);
    expect(new Headers(init.headers).get("authorization")).toBe(
      "Bearer sk-account",
    );
  });

  it("liest das optionale shutdown_date", async () => {
    const fetchMock = vi.fn(async () =>
      modellListe([
        { id: "gpt-image-1", created: 0, shutdown_date: "2026-10-23" },
        { id: "gpt-4.1-mini", created: 0, shutdown_date: 1804809600 },
      ]),
    );

    const ergebnis = await createOpenAiModellKatalog({
      apiKey: "sk-account",
      fetch: fetchMock as unknown as typeof fetch,
    }).liste();

    expect(ergebnis.modelle).toEqual([
      { id: "gpt-image-1", abschaltungAm: "2026-10-23" },
      { id: "gpt-4.1-mini", abschaltungAm: "2027-03-12" },
    ]);
  });

  it("nennt den Grund, wenn der Dienst nicht antwortet", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const fetchMock = vi.fn(async () =>
      fehlerAntwort(401, "Incorrect API key"),
    );

    const ergebnis = await createOpenAiModellKatalog({
      apiKey: "sk-falsch",
      fetch: fetchMock as unknown as typeof fetch,
    }).liste();

    expect(ergebnis.modelle).toBeNull();
    expect(ergebnis.fehler?.art).toBe("zugang");
  });
});

describe("openAiAbschaltDatum (req-108)", () => {
  it("laesst ein fehlendes oder unlesbares Datum weg", () => {
    expect(openAiAbschaltDatum(undefined)).toBeNull();
    expect(openAiAbschaltDatum(null)).toBeNull();
    expect(openAiAbschaltDatum("bald")).toBeNull();
  });
});

describe("Modellwahl des Accounts (req-108)", () => {
  it("fragt mit dem gewaehlten Modell, auch wenn die Umgebung ein anderes nennt", async () => {
    vi.stubEnv("OPENAI_MODEL", "gpt-4.1-mini");
    const fetchMock = vi.fn(async () => chatCompletionResponse("Antwort"));

    await createOpenAiClient({
      apiKey: "test-key",
      modell: "gpt-5.6-luna",
      fetch: fetchMock as unknown as typeof fetch,
    }).complete("Frage");

    expect(await gesendetesModell(fetchMock)).toBe("gpt-5.6-luna");
  });

  it("erzeugt das Bild mit dem gewaehlten Bildmodell", async () => {
    vi.stubEnv("OPENAI_IMAGE_MODEL", "gpt-image-2.5-flare");
    const fetchMock = vi.fn(async () => bildAntwort("bild"));

    await createOpenAiClient({
      apiKey: "test-key",
      bildModell: "gpt-image-2.5-sunburst",
      fetch: fetchMock as unknown as typeof fetch,
    }).generateImage("Ein Wanderweg.");

    expect(await gesendetesModell(fetchMock)).toBe("gpt-image-2.5-sunburst");
  });

  it("nimmt ohne Wahl OPENAI_IMAGE_MODEL aus der Umgebung -- der Rueckfall bleibt", async () => {
    vi.stubEnv("OPENAI_IMAGE_MODEL", "dall-e-3");
    const fetchMock = vi.fn(async () => bildAntwort("bild"));

    await createOpenAiClient({
      apiKey: "test-key",
      bildModell: null,
      fetch: fetchMock as unknown as typeof fetch,
    }).generateImage("Ein Wanderweg.");

    expect(await gesendetesModell(fetchMock)).toBe("dall-e-3");
  });

  it("nimmt ohne Wahl und ohne Umgebung den Standard -- ein lebendes Modell (bug-076)", async () => {
    vi.stubEnv("OPENAI_IMAGE_MODEL", undefined);
    vi.stubEnv("OPENAI_MODEL", undefined);
    const fetchMock = vi.fn(async () => bildAntwort("bild"));

    await createOpenAiClient({
      apiKey: "test-key",
      fetch: fetchMock as unknown as typeof fetch,
    }).generateImage("Ein Wanderweg.");

    expect(await gesendetesModell(fetchMock)).toBe("gpt-image-2.5-flare");
    expect(openAiModel(null)).toBe("gpt-5.6-luna");
  });
});
