// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { stromText } from "./chat-client";
import {
  CHAT_SYSTEM_PROMPT,
  WEB_SUCHE_MAX_USES,
  aiFehlerAusAnthropic,
  createAnthropicChatClient,
  createAnthropicModellKatalog,
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

/** Das Modell beginnt eine Web-Suche (req-092). */
function sucheStart(index: number, query = "Öffnungszeiten Museum"): string {
  return (
    ereignis("content_block_start", {
      type: "content_block_start",
      index,
      content_block: {
        type: "server_tool_use",
        id: `srvtoolu_${index}`,
        name: "web_search",
        input: {},
        caller: { type: "direct" },
      },
    }) +
    ereignis("content_block_delta", {
      type: "content_block_delta",
      index,
      delta: {
        type: "input_json_delta",
        partial_json: JSON.stringify({ query }),
      },
    }) +
    ereignis("content_block_stop", { type: "content_block_stop", index })
  );
}

/** Das Ergebnis einer Suche: eine Liste von Seiten oder ein Fehlercode. */
function sucheErgebnis(
  index: number,
  inhalt: { url: string; title: string }[] | { error_code: string },
): string {
  const content = Array.isArray(inhalt)
    ? inhalt.map((seite) => ({
        type: "web_search_result",
        url: seite.url,
        title: seite.title,
        encrypted_content: "verschluesselt",
        page_age: null,
      }))
    : { type: "web_search_tool_result_error", ...inhalt };
  return (
    ereignis("content_block_start", {
      type: "content_block_start",
      index,
      content_block: {
        type: "web_search_tool_result",
        tool_use_id: `srvtoolu_${index - 1}`,
        content,
        caller: { type: "direct" },
      },
    }) + ereignis("content_block_stop", { type: "content_block_stop", index })
  );
}

/** Ein Textblock, der sich auf eine Seite beruft (req-092). */
function zitierterText(
  index: number,
  text: string,
  url: string,
  title: string | null,
): string {
  return (
    ereignis("content_block_start", {
      type: "content_block_start",
      index,
      content_block: { type: "text", text: "", citations: null },
    }) +
    ereignis("content_block_delta", {
      type: "content_block_delta",
      index,
      delta: {
        type: "citations_delta",
        citation: {
          type: "web_search_result_location",
          url,
          title,
          cited_text: text,
          encrypted_index: "idx",
        },
      },
    }) +
    ereignis("content_block_delta", {
      type: "content_block_delta",
      index,
      delta: { type: "text_delta", text },
    }) +
    ereignis("content_block_stop", { type: "content_block_stop", index })
  );
}

async function alleStuecke(fetchMock: unknown) {
  const stuecke = [];
  for await (const stueck of client(fetchMock).antworte({
    modell: "claude-sonnet-5",
    verlauf: EINE_FRAGE,
  })) {
    stuecke.push(stueck);
  }
  return stuecke;
}

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
   * Keine Reisedaten im Zusammenhang (req-081, Constraints) und als einziges
   * Werkzeug die Web-Suche des Dienstes (req-092) -- kein web_fetch, keine
   * Code-Ausfuehrung.
   */
  it("gibt der KI nur die Web-Suche als Werkzeug", async () => {
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
    expect(körper.tools).toEqual([
      {
        type: "web_search_20250305",
        name: "web_search",
        max_uses: WEB_SUCHE_MAX_USES,
      },
    ]);
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

    expect(gesendet(fetchMock).max_tokens).toBe(16000);
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

describe("Web-Suche im Chat (req-092)", () => {
  it("nennt zu einer Antwort mit Suche ihre Quellen, wie der Dienst sie liefert", async () => {
    const fetchMock = antwortet(
      START,
      sucheStart(0),
      sucheErgebnis(1, [
        { url: "https://www.museum.de/besuch", title: "Besuch planen" },
      ]),
      zitierterText(
        2,
        "Das Museum ist dienstags bis sonntags von 10 bis 18 Uhr geöffnet.",
        "https://www.museum.de/besuch",
        "Besuch planen – Museum",
      ),
      ende("end_turn"),
    );

    expect(await alleStuecke(fetchMock)).toEqual([
      { art: "suche" },
      {
        art: "quelle",
        quelle: {
          url: "https://www.museum.de/besuch",
          titel: "Besuch planen – Museum",
        },
      },
      {
        art: "text",
        text: "Das Museum ist dienstags bis sonntags von 10 bis 18 Uhr geöffnet.",
      },
    ]);
  });

  it("nennt ohne Suche keine Quelle", async () => {
    const fetchMock = antwortet(
      START,
      BLOCK_START,
      textStueck("Ein Transfer ist die Fahrt zwischen zwei Orten."),
      BLOCK_STOP,
      ende("end_turn"),
    );

    const stuecke = await alleStuecke(fetchMock);

    expect(stuecke.map((stueck) => stueck.art)).toEqual(["text"]);
  });

  it("nennt drei Quellen je einmal, auch wenn die Antwort eine zweimal zitiert", async () => {
    const fetchMock = antwortet(
      START,
      sucheStart(0),
      sucheErgebnis(1, [
        { url: "https://a.example/1", title: "A" },
        { url: "https://b.example/2", title: "B" },
        { url: "https://c.example/3", title: "C" },
      ]),
      zitierterText(2, "Erstens. ", "https://a.example/1", "Seite A"),
      zitierterText(3, "Zweitens. ", "https://b.example/2", "Seite B"),
      zitierterText(4, "Noch einmal A. ", "https://a.example/1", "Seite A"),
      zitierterText(5, "Drittens.", "https://c.example/3", "Seite C"),
      ende("end_turn"),
    );

    const quellen = (await alleStuecke(fetchMock)).flatMap((stueck) =>
      stueck.art === "quelle" ? [stueck.quelle] : [],
    );

    expect(quellen).toEqual([
      { url: "https://a.example/1", titel: "Seite A" },
      { url: "https://b.example/2", titel: "Seite B" },
      { url: "https://c.example/3", titel: "Seite C" },
    ]);
  });

  it("nimmt den Titel des Suchergebnisses, wenn das Zitat keinen traegt", async () => {
    const fetchMock = antwortet(
      START,
      sucheStart(0),
      sucheErgebnis(1, [
        { url: "https://www.museum.de/besuch", title: "Besuch planen" },
      ]),
      zitierterText(2, "Geöffnet.", "https://www.museum.de/besuch", null),
      ende("end_turn"),
    );

    const quellen = (await alleStuecke(fetchMock)).flatMap((stueck) =>
      stueck.art === "quelle" ? [stueck.quelle] : [],
    );

    expect(quellen).toEqual([
      { url: "https://www.museum.de/besuch", titel: "Besuch planen" },
    ]);
  });

  it("macht aus einer Adresse ausserhalb des Webs keine Quelle", async () => {
    const fetchMock = antwortet(
      START,
      zitierterText(0, "Text.", "javascript:alert(1)", "Falle"),
      ende("end_turn"),
    );

    const stuecke = await alleStuecke(fetchMock);

    expect(stuecke.some((stueck) => stueck.art === "quelle")).toBe(false);
  });

  it("laesst eine Antwort stehen, deren Suche mitten darin scheitert, und nennt den Grund", async () => {
    const fetchMock = antwortet(
      START,
      zitierterText(
        0,
        "Das Museum liegt am Markt. ",
        "https://a.example/1",
        "A",
      ),
      sucheStart(1),
      sucheErgebnis(2, { error_code: "unavailable" }),
      ereignis("content_block_start", {
        type: "content_block_start",
        index: 3,
        content_block: { type: "text", text: "", citations: null },
      }),
      ereignis("content_block_delta", {
        type: "content_block_delta",
        index: 3,
        delta: {
          type: "text_delta",
          text: "Die Öffnungszeiten konnte ich nicht nachsehen.",
        },
      }),
      ende("end_turn"),
    );

    const { text, fehler } = await stromText(
      client(fetchMock).antworte({
        modell: "claude-sonnet-5",
        verlauf: EINE_FRAGE,
      }),
    );
    const stuecke = await alleStuecke(
      antwortet(
        START,
        sucheStart(0),
        sucheErgebnis(1, { error_code: "unavailable" }),
        ende("end_turn"),
      ),
    );

    expect(text).toBe(
      "Das Museum liegt am Markt. Die Öffnungszeiten konnte ich nicht nachsehen.",
    );
    expect(fehler).toBeNull();
    expect(stuecke).toContainEqual({ art: "suche_fehler", fehler: "dienst" });
  });

  it("benennt jeden Fehlercode der Suche", async () => {
    const erwartet: Record<string, string> = {
      max_uses_exceeded: "grenze",
      too_many_requests: "ueberlastet",
      unavailable: "dienst",
      invalid_tool_input: "anfrage",
      query_too_long: "anfrage",
      request_too_large: "anfrage",
    };
    for (const [code, art] of Object.entries(erwartet)) {
      const stuecke = await alleStuecke(
        antwortet(
          START,
          sucheStart(0),
          sucheErgebnis(1, { error_code: code }),
          zitierterText(2, "Weiter.", "https://a.example/1", "A"),
          ende("end_turn"),
        ),
      );
      expect(stuecke, code).toContainEqual({
        art: "suche_fehler",
        fehler: art,
      });
    }
  });

  /**
   * bug-032: die Pruefung auf eine leere Antwort zaehlt Textstuecke. Mit der
   * Suche kommen zuerst andere Bloecke -- solange der Strom laeuft, ist eine
   * Antwort ohne Text deshalb nicht leer.
   */
  it("verwirft eine Antwort nicht als leer, die mit einer Suche beginnt", async () => {
    const fetchMock = antwortet(
      START,
      sucheStart(0),
      sucheErgebnis(1, [{ url: "https://a.example/1", title: "A" }]),
      sucheStart(2),
      sucheErgebnis(3, [{ url: "https://b.example/2", title: "B" }]),
      zitierterText(
        4,
        "Geöffnet von 10 bis 18 Uhr.",
        "https://b.example/2",
        "B",
      ),
      ende("end_turn"),
    );

    const stuecke = await alleStuecke(fetchMock);

    expect(stuecke.map((stueck) => stueck.art)).toEqual([
      "suche",
      "suche",
      "quelle",
      "text",
    ]);
  });

  /**
   * bug-061 mit Suche: Suchergebnisse zaehlen gegen MAX_TOKENS. Stoesst die
   * Antwort nach der Suche und vor dem ersten Wort an die Grenze, ist sie
   * abgeschnitten -- nicht leer.
   */
  it("nennt eine Antwort, die nach der Suche an die Token-Grenze stoesst, abgeschnitten und nicht leer", async () => {
    const fetchMock = antwortet(
      START,
      sucheStart(0),
      sucheErgebnis(1, [{ url: "https://a.example/1", title: "A" }]),
      ende("max_tokens"),
    );

    const { text, fehler } = await stromText(
      client(fetchMock).antworte({
        modell: "claude-sonnet-5",
        verlauf: EINE_FRAGE,
      }),
    );

    expect(text).toBe("");
    expect(fehler?.art).toBe("abgeschnitten");
  });

  /**
   * Die Grenze steht beim Dienst: er fuehrt hoechstens max_uses Suchen aus
   * und meldet jeden weiteren Versuch als "max_uses_exceeded". Die Antwort
   * laeuft danach weiter.
   */
  it("haelt die Grenze der Suchen ein und laesst die Antwort weiterlaufen", async () => {
    const fetchMock = antwortet(
      START,
      sucheStart(0),
      sucheErgebnis(1, [{ url: "https://a.example/1", title: "A" }]),
      sucheStart(2),
      sucheErgebnis(3, { error_code: "max_uses_exceeded" }),
      zitierterText(4, "Laut A ist es offen.", "https://a.example/1", "A"),
      ende("end_turn"),
    );

    const stuecke = await alleStuecke(fetchMock);

    expect(WEB_SUCHE_MAX_USES).toBeGreaterThan(0);
    expect(gesendet(fetchMock).tools).toEqual([
      expect.objectContaining({ max_uses: WEB_SUCHE_MAX_USES }),
    ]);
    expect(stuecke).toContainEqual({ art: "suche_fehler", fehler: "grenze" });
    expect(stuecke.at(-1)).toEqual({
      art: "text",
      text: "Laut A ist es offen.",
    });
    expect(stuecke.some((stueck) => stueck.art === "fehler")).toBe(false);
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

  /**
   * Fall A aus bug-061: ein Denk-Block erreicht die Token-Grenze, bevor
   * ueberhaupt Text entstand. Das ist kein "leer" -- der Dienst hat
   * nachgedacht, nur nie geantwortet.
   */
  it("nennt eine Antwort, die beim Nachdenken an die Token-Grenze stoesst", async () => {
    const fetchMock = antwortet(
      START,
      BLOCK_START,
      BLOCK_STOP,
      ende("max_tokens"),
    );

    const { text, fehler } = await stromText(
      client(fetchMock).antworte({
        modell: "claude-opus-5",
        verlauf: EINE_FRAGE,
      }),
    );

    expect(text).toBe("");
    expect(fehler?.art).toBe("abgeschnitten");
  });

  /**
   * Fall B aus bug-061, der schwerere: eine halbe Antwort ist schon da,
   * als die Token-Grenze erreicht wird. Sie darf nicht als vollstaendige
   * Antwort durchgehen (fehler durfte bisher null sein).
   */
  it("nennt eine mitten im Satz abgeschnittene Antwort und laesst sie nicht als vollstaendig durchgehen", async () => {
    const fetchMock = antwortet(
      START,
      BLOCK_START,
      textStueck("Das Hotel liegt direkt am Hafen, und dann"),
      ende("max_tokens"),
    );

    const { text, fehler } = await stromText(
      client(fetchMock).antworte({
        modell: "claude-opus-5",
        verlauf: EINE_FRAGE,
      }),
    );

    expect(text).toBe("Das Hotel liegt direkt am Hafen, und dann");
    expect(fehler?.art).toBe("abgeschnitten");
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

/** Ein Eintrag des Katalogs im Format des Dienstes. */
function modellInfo(
  id: string,
  display_name: string,
  line: string | null,
  lifecycle = "active",
) {
  return {
    type: "model",
    id,
    display_name,
    created_at: "2026-09-01T00:00:00Z",
    lifecycle,
    line,
    deprecated_at: null,
    retires_at: null,
    max_input_tokens: 1000000,
    max_tokens: 128000,
    capabilities: null,
  };
}

/** Der Dienst nennt den Katalog in diesen Seiten, eine je Anfrage. */
function katalogSeiten(...seiten: ReturnType<typeof modellInfo>[][]) {
  return vi.fn(async () => {
    const daten = seiten.shift() ?? [];
    return Response.json({
      data: daten,
      has_more: seiten.length > 0,
      first_id: daten[0]?.id ?? null,
      last_id: daten.at(-1)?.id ?? null,
    });
  });
}

function katalog(fetchMock: unknown) {
  return createAnthropicModellKatalog({
    apiKey: "sk-ant-test",
    fetch: fetchMock as unknown as typeof fetch,
  });
}

describe("Katalog der Modelle bei Anthropic (req-090)", () => {
  it("liefert die Modelle des Dienstes in seiner Reihenfolge", async () => {
    const fetchMock = katalogSeiten([
      modellInfo("claude-opus-5-5", "Claude Opus 5.5", "opus"),
      modellInfo("claude-sonnet-5-5", "Claude Sonnet 5.5", "sonnet"),
      modellInfo("claude-haiku-4-5", "Claude Haiku 4.5", "haiku", "deprecated"),
    ]);

    const { modelle } = await katalog(fetchMock).liste();

    expect(modelle).toEqual([
      {
        id: "claude-opus-5-5",
        name: "Claude Opus 5.5",
        lebenslauf: "active",
        reihe: "opus",
        maxEingabeTokens: 1000000,
      },
      {
        id: "claude-sonnet-5-5",
        name: "Claude Sonnet 5.5",
        lebenslauf: "active",
        reihe: "sonnet",
        maxEingabeTokens: 1000000,
      },
      {
        id: "claude-haiku-4-5",
        name: "Claude Haiku 4.5",
        lebenslauf: "deprecated",
        reihe: "haiku",
        maxEingabeTokens: 1000000,
      },
    ]);
  });

  it("fragt beim Dienst nach dem Katalog, mit dem Schluessel des Accounts", async () => {
    const fetchMock = katalogSeiten([]);
    await katalog(fetchMock).liste();

    const [url, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      { headers: Headers | Record<string, string> },
    ];
    expect(String(url)).toContain("/v1/models");
    expect(new Headers(init.headers).get("x-api-key")).toBe("sk-ant-test");
  });

  it("holt auch die weiteren Seiten des Katalogs", async () => {
    const fetchMock = katalogSeiten(
      [modellInfo("claude-opus-5-5", "Claude Opus 5.5", "opus")],
      [modellInfo("claude-sonnet-5", "Claude Sonnet 5", "sonnet")],
    );

    const { modelle } = await katalog(fetchMock).liste();

    expect(modelle?.map((modell) => modell.id)).toEqual([
      "claude-opus-5-5",
      "claude-sonnet-5",
    ]);
  });

  it("nennt den Grund, wenn der Dienst den Schluessel ablehnt", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const ergebnis = await katalog(scheitert(401, "invalid x-api-key")).liste();

    expect(ergebnis.modelle).toBeNull();
    expect(ergebnis.fehler?.art).toBe("zugang");
  });

  it("nennt den Grund, wenn der Dienst nicht erreichbar ist", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const fetchMock = vi.fn(async () => {
      throw new TypeError("fetch failed");
    });

    const ergebnis = await katalog(fetchMock).liste();

    expect(ergebnis.modelle).toBeNull();
    expect(ergebnis.fehler?.art).toBe("netz");
  });
});
