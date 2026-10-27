import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AI_FEHLER_TEXT } from "@/lib/ai/fehler";
import { apiKeyMissingHint } from "@/lib/api-keys/types";
import { MEIN_BEREICH_PATH } from "@/lib/auth/paths";
import type { ChatModell } from "@/lib/chat/modelle";
import type { ChatModelleAntwort } from "@/lib/chat/senden";
import { chatZeile, type ChatEreignis } from "@/lib/chat/strom";
import type { ChatNachricht } from "@/lib/chat/types";
import {
  ChatFenster,
  MODELLE_FEHLEN_HINWEIS,
  MODELLE_FEHLEN_OHNE_MODELL,
  MODELLE_WERDEN_GEHOLT,
  SUCHT_IM_WEB,
  VERLAUF_LEER_HINWEIS,
} from "./chat-fenster";

const TRIP_ID = "d5fda5ea-65e7-4b47-8096-62618599a288";
const WIEN_ID = "4b5f95d6-5ad3-4049-b71c-0b90fef8e950";

let nummer = 0;

function nachricht(
  rolle: "ich" | "ki",
  text: string,
  modell: string | null = null,
  tripId = TRIP_ID,
): ChatNachricht {
  nummer += 1;
  return {
    id: `nachricht-${nummer}`,
    tripId,
    rolle,
    text,
    modell,
    quellen: [],
    sucheFehler: null,
    createdAt: `2026-10-12T10:0${nummer}:00.000Z`,
  };
}

function chatModell(
  id: string,
  name: string,
  reihe: string | null,
  kontextTokens: number | null = null,
): ChatModell {
  return { id, name, reihe, kontextTokens };
}

/** Die Modellauswahl, wie die Schnittstelle sie gewoehnlich liefert. */
const KATALOG: ChatModell[] = [
  chatModell("claude-opus-5", "Claude Opus 5", "opus"),
  chatModell("claude-sonnet-5", "Claude Sonnet 5", "sonnet"),
  chatModell("claude-haiku-4-5", "Claude Haiku 4.5", "haiku"),
];

/**
 * Die Schnittstelle des Chats, aus dem Haus: GET gibt den Verlauf und die
 * Modellauswahl, POST stroemt die Ereignisse, die der Test vorgibt. Externe
 * Dienste werden gemockt (stack.md, Testing) -- hier ist die Schnittstelle
 * der Platz, an dem das geschieht.
 */
function schnittstelle(
  verlauf: Record<string, ChatNachricht[]> = {},
  antwort: ChatEreignis[] = [],
  modelle: ChatModelleAntwort | Promise<ChatModelleAntwort> = {
    modelle: KATALOG,
    grund: null,
  },
) {
  const stuecke = { aktuell: antwort };
  const fetchMock = vi.fn(async (eingabe: unknown, init?: RequestInit) => {
    const url = String(eingabe);
    if (url.startsWith("/api/chat/modelle")) {
      return Response.json(await modelle);
    }
    if (!init || init.method === undefined || init.method === "GET") {
      const tripId = new URL(url, "https://dev.wegfara.com").searchParams.get(
        "tripId",
      );
      return Response.json({ nachrichten: verlauf[tripId ?? ""] ?? [] });
    }
    if (init.method === "DELETE") return Response.json({ nachrichten: [] });
    return new Response(stuecke.aktuell.map(chatZeile).join(""), {
      status: 200,
      headers: { "Content-Type": "application/x-ndjson" },
    });
  });
  vi.stubGlobal("fetch", fetchMock);
  return {
    fetchMock,
    /** Was die naechste Frage als Antwort bekommt. */
    antwortetMit(...ereignisse: ChatEreignis[]) {
      stuecke.aktuell = ereignisse;
    },
    /** Wie oft die Modellauswahl geholt wurde. */
    modellAbrufe() {
      return fetchMock.mock.calls.filter(([url]) =>
        String(url).startsWith("/api/chat/modelle"),
      ).length;
    },
    /** Der Koerper der letzten gesendeten Frage. */
    letzteFrage() {
      const gesendet = fetchMock.mock.calls.filter(
        ([, init]) => (init as RequestInit | undefined)?.method === "POST",
      );
      const [, init] = gesendet.at(-1) as [unknown, RequestInit];
      return JSON.parse(String(init.body)) as {
        tripId: string;
        text: string;
        modell: string;
      };
    },
  };
}

function zeige(
  tripId = TRIP_ID,
  modell: string | null = null,
  hasAnthropicKey = true,
) {
  const onModellChange = vi.fn();
  const ergebnis = render(
    <ChatFenster
      tripId={tripId}
      hasAnthropicKey={hasAnthropicKey}
      modell={modell}
      onModellChange={onModellChange}
    />,
  );
  return { ...ergebnis, onModellChange };
}

function verlauf() {
  return screen.getByTestId("chat-verlauf");
}

function feld() {
  return screen.getByRole("textbox", { name: "Nachricht" });
}

async function sende(text: string) {
  const user = userEvent.setup();
  await user.type(feld(), text);
  await user.click(screen.getByRole("button", { name: "Senden" }));
  return user;
}

beforeEach(() => {
  nummer = 0;
  vi.unstubAllGlobals();
});

describe("Chatfenster -- die Unterhaltung (req-081)", () => {
  it("zeigt zu Beginn den Hinweis, dass noch nichts dasteht", async () => {
    schnittstelle();
    zeige();

    expect(await screen.findByText(VERLAUF_LEER_HINWEIS)).toBeInTheDocument();
  });

  it("zeigt die Antwort im Verlauf, wenn ich eine Frage sende", async () => {
    const dienst = schnittstelle();
    dienst.antwortetMit(
      { art: "frage", nachricht: nachricht("ich", "Was gibt es in Amalfi?") },
      { art: "text", text: "Den Dom." },
      {
        art: "antwort",
        nachricht: nachricht("ki", "Den Dom.", "claude-sonnet-5"),
      },
    );
    zeige();
    await screen.findByText(VERLAUF_LEER_HINWEIS);

    await sende("Was gibt es in Amalfi?");

    expect(
      await within(verlauf()).findByText("Was gibt es in Amalfi?"),
    ).toBeInTheDocument();
    expect(within(verlauf()).getByText("Den Dom.")).toBeInTheDocument();
  });

  /**
   * Die Antwort erscheint, waehrend sie entsteht (req-081): nach dem ersten
   * Stueck steht das erste Stueck da -- nicht erst am Ende die ganze Antwort.
   */
  it("laesst die Antwort sichtbar wachsen", async () => {
    const dienst = schnittstelle();
    const user = userEvent.setup();
    let weiter: (() => void) | null = null;
    const zweitesStueck = new Promise<void>((resolve) => {
      weiter = resolve;
    });
    // Der Strom haelt nach dem ersten Stueck an, bis der Test ihn weiterlaufen
    // laesst -- so ist der Zwischenstand pruefbar.
    vi.stubGlobal(
      "fetch",
      vi.fn(async (eingabe: unknown, init?: RequestInit) => {
        if (!init?.method || init.method === "GET") {
          return Response.json({ nachrichten: [] });
        }
        return new Response(
          new ReadableStream<Uint8Array>({
            async start(controller) {
              const encoder = new TextEncoder();
              controller.enqueue(
                encoder.encode(
                  chatZeile({
                    art: "frage",
                    nachricht: nachricht("ich", "Erzähl etwas"),
                  }) + chatZeile({ art: "text", text: "Erstes Stück." }),
                ),
              );
              await zweitesStueck;
              controller.enqueue(
                encoder.encode(
                  chatZeile({ art: "text", text: " Zweites Stück." }) +
                    chatZeile({
                      art: "antwort",
                      nachricht: nachricht(
                        "ki",
                        "Erstes Stück. Zweites Stück.",
                        "claude-sonnet-5",
                      ),
                    }),
                ),
              );
              controller.close();
            },
          }),
          { status: 200 },
        );
      }),
    );
    // Dieser Mock kennt keine Modellauswahl -- gewaehlt ist trotzdem eines.
    zeige(TRIP_ID, "claude-sonnet-5");
    await screen.findByText(VERLAUF_LEER_HINWEIS);

    await user.type(feld(), "Erzähl etwas");
    await user.click(screen.getByRole("button", { name: "Senden" }));

    // Mitten in der Antwort: das erste Stueck steht schon da.
    const entstehend = await screen.findByTestId("chat-entstehend");
    expect(entstehend).toHaveTextContent("Erstes Stück.");
    expect(entstehend).not.toHaveTextContent("Zweites Stück.");

    weiter!();

    await waitFor(() =>
      expect(
        within(verlauf()).getByText("Erstes Stück. Zweites Stück."),
      ).toBeInTheDocument(),
    );
    expect(screen.queryByTestId("chat-entstehend")).not.toBeInTheDocument();
    expect(dienst.fetchMock).toBeDefined();
  });

  it("stellt Fragen und Antworten in zeitlicher Folge", async () => {
    schnittstelle({
      [TRIP_ID]: [
        nachricht("ich", "Erste Frage"),
        nachricht("ki", "Erste Antwort", "claude-sonnet-5"),
        nachricht("ich", "Zweite Frage"),
        nachricht("ki", "Zweite Antwort", "claude-opus-5"),
      ],
    });
    zeige();

    await within(verlauf()).findByText("Claude Opus 5");

    const zeilen = within(verlauf()).getAllByRole("listitem");
    expect(zeilen.map((zeile) => zeile.textContent)).toEqual([
      "Erste Frage",
      "Erste AntwortClaude Sonnet 5",
      "Zweite Frage",
      "Zweite AntwortClaude Opus 5",
    ]);
  });

  /** Der Verlauf ueberdauert das Neuladen der Seite (req-081). */
  it("holt die vorhandene Unterhaltung beim Oeffnen", async () => {
    schnittstelle({
      [TRIP_ID]: [
        nachricht("ich", "Von früher"),
        nachricht("ki", "Ja", "claude-sonnet-5"),
      ],
    });
    zeige();

    expect(await screen.findByText("Von früher")).toBeInTheDocument();
    expect(screen.queryByText(VERLAUF_LEER_HINWEIS)).not.toBeInTheDocument();
  });

  /** Ein Reisewechsel zeigt die Unterhaltung dieser Reise (req-081). */
  it("zeigt beim Wechsel der Reise deren Unterhaltung", async () => {
    schnittstelle({
      [TRIP_ID]: [nachricht("ich", "Zur Amalfiküste")],
      [WIEN_ID]: [nachricht("ich", "Nach Wien", null, WIEN_ID)],
    });
    const { rerender, onModellChange } = zeige();
    await screen.findByText("Zur Amalfiküste");

    rerender(
      <ChatFenster
        tripId={WIEN_ID}
        hasAnthropicKey
        modell={null}
        onModellChange={onModellChange}
      />,
    );

    expect(await screen.findByText("Nach Wien")).toBeInTheDocument();
    expect(screen.queryByText("Zur Amalfiküste")).not.toBeInTheDocument();
  });

  it("sendet nichts, wo nichts steht", async () => {
    const dienst = schnittstelle();
    zeige();
    await screen.findByText(VERLAUF_LEER_HINWEIS);
    const user = userEvent.setup();

    await user.type(feld(), "   ");

    expect(screen.getByRole("button", { name: "Senden" })).toBeDisabled();
    expect(
      dienst.fetchMock.mock.calls.filter(
        ([, init]) => (init as RequestInit | undefined)?.method === "POST",
      ),
    ).toHaveLength(0);
  });

  it("leert das Feld nach dem Senden", async () => {
    const dienst = schnittstelle();
    dienst.antwortetMit(
      { art: "frage", nachricht: nachricht("ich", "Hallo") },
      {
        art: "antwort",
        nachricht: nachricht("ki", "Hallo!", "claude-sonnet-5"),
      },
    );
    zeige();
    await screen.findByText(VERLAUF_LEER_HINWEIS);

    await sende("Hallo");

    await waitFor(() => expect(feld()).toHaveValue(""));
  });
});

/**
 * Fehlt der Anthropic-Zugangsschluessel, sagt der Bereich das -- mit dem Weg
 * dorthin, wo man ihn hinterlegt (req-081, req-028). Er zeigt kein leeres
 * Fenster, in das man vergeblich schreibt.
 */
describe("Chatfenster -- Quellen einer Web-Suche (req-092)", () => {
  const DREI_QUELLEN = [
    { url: "https://www.museum.de/besuch", titel: "Besuch planen" },
    { url: "https://www.stadt.de/museen", titel: "Museen der Stadt" },
    { url: "https://reise.example/tipps", titel: "Tipps für den Besuch" },
  ];

  function mitQuellen(text: string, quellen: typeof DREI_QUELLEN) {
    return { ...nachricht("ki", text, "claude-sonnet-5"), quellen };
  }

  it("nennt zu einer Antwort mit Suche ihre Quellen", async () => {
    const dienst = schnittstelle();
    dienst.antwortetMit(
      { art: "frage", nachricht: nachricht("ich", "Wann hat es geöffnet?") },
      { art: "suche" },
      { art: "quelle", quelle: DREI_QUELLEN[0] },
      { art: "text", text: "Von 10 bis 18 Uhr." },
      {
        art: "antwort",
        nachricht: mitQuellen("Von 10 bis 18 Uhr.", [DREI_QUELLEN[0]]),
      },
    );
    zeige();
    await screen.findByText(VERLAUF_LEER_HINWEIS);

    await sende("Wann hat es geöffnet?");

    const quellen = await within(verlauf()).findByRole("list", {
      name: "Quellen",
    });
    expect(
      within(quellen).getByRole("link", { name: /Besuch planen/ }),
    ).toHaveAttribute("href", "https://www.museum.de/besuch");
  });

  /**
   * Mit dem Haus-Mock stuende die Antwort sofort fertig da -- der Strom
   * haelt deshalb nach der Suche an, bis der Test ihn weiterlaufen laesst.
   */
  it("zeigt, dass gerade gesucht wird, bis der Text kommt", async () => {
    const user = userEvent.setup();
    let weiter: () => void = () => {};
    const nachDerSuche = new Promise<void>((resolve) => {
      weiter = resolve;
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_eingabe: unknown, init?: RequestInit) => {
        if (!init?.method || init.method === "GET") {
          return Response.json({ nachrichten: [] });
        }
        return new Response(
          new ReadableStream<Uint8Array>({
            async start(controller) {
              const encoder = new TextEncoder();
              controller.enqueue(
                encoder.encode(
                  chatZeile({
                    art: "frage",
                    nachricht: nachricht("ich", "Wann hat es geöffnet?"),
                  }) + chatZeile({ art: "suche" }),
                ),
              );
              await nachDerSuche;
              controller.enqueue(
                encoder.encode(
                  chatZeile({ art: "quelle", quelle: DREI_QUELLEN[0] }) +
                    chatZeile({ art: "text", text: "Von 10 bis 18 Uhr." }) +
                    chatZeile({
                      art: "antwort",
                      nachricht: mitQuellen("Von 10 bis 18 Uhr.", [
                        DREI_QUELLEN[0],
                      ]),
                    }),
                ),
              );
              controller.close();
            },
          }),
          { status: 200 },
        );
      }),
    );
    zeige(TRIP_ID, "claude-sonnet-5");
    await screen.findByText(VERLAUF_LEER_HINWEIS);

    await user.type(feld(), "Wann hat es geöffnet?");
    await user.click(screen.getByRole("button", { name: "Senden" }));

    // Mitten in der Suche: der Hinweis steht am Eintrag der Antwort.
    const hinweis = await within(verlauf()).findByText(SUCHT_IM_WEB);
    expect(hinweis.closest("li")).toContainElement(
      screen.getByTestId("chat-entstehend"),
    );

    weiter();

    await within(verlauf()).findByText("Von 10 bis 18 Uhr.");
    expect(within(verlauf()).queryByText(SUCHT_IM_WEB)).not.toBeInTheDocument();
  });

  it("zeigt ohne Suche keinen Suchhinweis", async () => {
    const dienst = schnittstelle();
    dienst.antwortetMit(
      { art: "frage", nachricht: nachricht("ich", "Was ist ein Transfer?") },
      { art: "text", text: "Die Fahrt dazwischen." },
      {
        art: "antwort",
        nachricht: nachricht("ki", "Die Fahrt dazwischen.", "claude-sonnet-5"),
      },
    );
    zeige();
    await screen.findByText(VERLAUF_LEER_HINWEIS);

    await sende("Was ist ein Transfer?");

    await within(verlauf()).findByText("Die Fahrt dazwischen.");
    expect(within(verlauf()).queryByText(SUCHT_IM_WEB)).not.toBeInTheDocument();
  });

  it("zeigt zu einer Antwort ohne Suche keine Quellenzeile", async () => {
    schnittstelle({
      [TRIP_ID]: [
        nachricht("ich", "Was ist ein Transfer?"),
        nachricht("ki", "Die Fahrt zwischen zwei Orten.", "claude-sonnet-5"),
      ],
    });
    zeige();

    await within(verlauf()).findByText("Die Fahrt zwischen zwei Orten.");

    expect(
      within(verlauf()).queryByRole("list", { name: "Quellen" }),
    ).not.toBeInTheDocument();
    expect(within(verlauf()).queryByRole("link")).not.toBeInTheDocument();
  });

  it("nennt alle drei Quellen als Adresse mit Titel", async () => {
    schnittstelle({
      [TRIP_ID]: [
        nachricht("ich", "Wann hat es geöffnet?"),
        mitQuellen("Von 10 bis 18 Uhr.", DREI_QUELLEN),
      ],
    });
    zeige();

    const quellen = await within(verlauf()).findByRole("list", {
      name: "Quellen",
    });
    const verweise = within(quellen).getAllByRole("link");
    expect(verweise).toHaveLength(3);
    DREI_QUELLEN.forEach((quelle, i) => {
      expect(verweise[i]).toHaveAttribute("href", quelle.url);
      expect(verweise[i]).toHaveTextContent(quelle.titel);
      expect(verweise[i]).toHaveTextContent(quelle.url);
    });
  });

  it("oeffnet eine Quelle in einem neuen Reiter", async () => {
    schnittstelle({
      [TRIP_ID]: [
        nachricht("ich", "Wann hat es geöffnet?"),
        mitQuellen("Von 10 bis 18 Uhr.", DREI_QUELLEN),
      ],
    });
    zeige();

    const verweise = await within(verlauf()).findAllByRole("link");
    for (const verweis of verweise) {
      expect(verweis).toHaveAttribute("target", "_blank");
      expect(verweis).toHaveAttribute("rel", "noopener noreferrer");
    }
  });
});

describe("Chatfenster ohne Zugangsschlüssel (req-081, req-028)", () => {
  function zeigeOhneSchluessel() {
    return zeige(TRIP_ID, null, false);
  }

  it("nennt den fehlenden Schlüssel als Grund", async () => {
    schnittstelle();
    zeigeOhneSchluessel();

    const hinweis = await screen.findByTestId("chat-kein-schluessel");
    expect(hinweis).toHaveTextContent(apiKeyMissingHint("anthropic"));
    expect(hinweis).toHaveTextContent("Chat im Planer");
  });

  it("nennt den Weg zum Hinterlegen", async () => {
    schnittstelle();
    zeigeOhneSchluessel();

    const hinweis = await screen.findByTestId("chat-kein-schluessel");
    expect(hinweis).toHaveTextContent("Mein Bereich");
    expect(
      within(hinweis).getByRole("link", { name: /Mein Bereich/ }),
    ).toHaveAttribute("href", MEIN_BEREICH_PATH);
  });

  it("zeigt kein Feld, in das man vergeblich schreibt", async () => {
    schnittstelle();
    zeigeOhneSchluessel();
    await screen.findByTestId("chat-kein-schluessel");

    expect(
      screen.queryByRole("textbox", { name: "Nachricht" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Senden" }),
    ).not.toBeInTheDocument();
    // Und auch keine Aufforderung, die erste Nachricht zu schreiben.
    expect(screen.queryByText(VERLAUF_LEER_HINWEIS)).not.toBeInTheDocument();
  });

  /** Was schon geredet wurde, bleibt lesbar -- der Schluessel fehlt, nicht der Verlauf. */
  it("zeigt eine vorhandene Unterhaltung weiterhin", async () => {
    schnittstelle({
      [TRIP_ID]: [
        nachricht("ich", "Von früher"),
        nachricht("ki", "Ja", "claude-sonnet-5"),
      ],
    });
    zeigeOhneSchluessel();

    expect(await screen.findByText("Von früher")).toBeInTheDocument();
    expect(screen.getByTestId("chat-kein-schluessel")).toBeInTheDocument();
  });

  it("zeigt mit Schlüssel das Feld und keinen Hinweis", async () => {
    schnittstelle();
    zeige();

    await screen.findByText(VERLAUF_LEER_HINWEIS);
    expect(
      screen.queryByTestId("chat-kein-schluessel"),
    ).not.toBeInTheDocument();
    expect(feld()).toBeInTheDocument();
  });
});

/**
 * Eine Unterhaltung laesst sich verwerfen und neu beginnen (req-081) -- nach
 * einer Rueckfrage, denn zurueckzuholen ist sie nicht.
 */
describe("Chatfenster -- verwerfen (req-081)", () => {
  async function oeffneRueckfrage() {
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Verwerfen" }));
    return user;
  }

  it("bietet das Verwerfen nur an, wo etwas steht", async () => {
    schnittstelle();
    zeige();
    await screen.findByText(VERLAUF_LEER_HINWEIS);

    expect(
      screen.queryByRole("button", { name: "Verwerfen" }),
    ).not.toBeInTheDocument();
  });

  it("fragt vor dem Verwerfen zurück", async () => {
    schnittstelle({ [TRIP_ID]: [nachricht("ich", "Steht noch da")] });
    zeige();
    await screen.findByText("Steht noch da");

    await oeffneRueckfrage();

    expect(
      screen.getByRole("alertdialog", { name: "Unterhaltung verwerfen" }),
    ).toBeInTheDocument();
    // Verworfen ist noch nichts.
    expect(screen.getByText("Steht noch da")).toBeInTheDocument();
  });

  it("laesst die Unterhaltung stehen, wenn ich abbreche", async () => {
    schnittstelle({ [TRIP_ID]: [nachricht("ich", "Steht noch da")] });
    zeige();
    await screen.findByText("Steht noch da");
    const user = await oeffneRueckfrage();

    await user.click(screen.getByRole("button", { name: "Abbrechen" }));

    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(screen.getByText("Steht noch da")).toBeInTheDocument();
  });

  it("leert den Verlauf und laesst neu beginnen", async () => {
    const dienst = schnittstelle({
      [TRIP_ID]: [
        nachricht("ich", "Weg damit"),
        nachricht("ki", "Gern", "claude-sonnet-5"),
      ],
    });
    zeige();
    await screen.findByText("Weg damit");
    const user = await oeffneRueckfrage();

    await user.click(
      screen.getByRole("button", { name: "Endgültig verwerfen" }),
    );

    expect(await screen.findByText(VERLAUF_LEER_HINWEIS)).toBeInTheDocument();
    expect(screen.queryByText("Weg damit")).not.toBeInTheDocument();
    expect(screen.queryByText("Gern")).not.toBeInTheDocument();
    // Und man kann neu beginnen.
    expect(feld()).toBeEnabled();
    dienst.antwortetMit(
      { art: "frage", nachricht: nachricht("ich", "Von vorn") },
      { art: "antwort", nachricht: nachricht("ki", "Gut", "claude-sonnet-5") },
    );
    await sende("Von vorn");
    expect(await within(verlauf()).findByText("Gut")).toBeInTheDocument();
  });

  it("nennt es, wenn das Verwerfen nicht klappt", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (eingabe: unknown, init?: RequestInit) => {
        if (!init?.method || init.method === "GET") {
          return Response.json({
            nachrichten: [nachricht("ich", "Bleibt doch")],
          });
        }
        return new Response(null, { status: 500 });
      }),
    );
    zeige();
    await screen.findByText("Bleibt doch");
    const user = await oeffneRueckfrage();

    await user.click(
      screen.getByRole("button", { name: "Endgültig verwerfen" }),
    );

    expect(
      await screen.findByTestId("chat-verwerfen-error"),
    ).toBeInTheDocument();
    expect(screen.getByText("Bleibt doch")).toBeInTheDocument();
  });
});

describe("Chatfenster -- die Modellauswahl (req-081)", () => {
  it("fuehrt die Modelle der Schnittstelle", async () => {
    schnittstelle();
    zeige();
    await screen.findByText(VERLAUF_LEER_HINWEIS);

    const auswahl = screen.getByRole("combobox", { name: /Modell/ });
    expect(
      within(auswahl)
        .getAllByRole("option")
        .map((option) => option.textContent),
    ).toEqual(["Claude Opus 5", "Claude Sonnet 5", "Claude Haiku 4.5"]);
  });

  it("steht auf Sonnet, wenn nichts gewaehlt wurde", async () => {
    schnittstelle();
    zeige();

    await waitFor(() =>
      expect(screen.getByRole("combobox", { name: /Modell/ })).toHaveValue(
        "claude-sonnet-5",
      ),
    );
  });

  it("meldet einen Wechsel nach oben", async () => {
    schnittstelle();
    const { onModellChange } = zeige();
    await screen.findByText(VERLAUF_LEER_HINWEIS);
    const user = userEvent.setup();

    await user.selectOptions(screen.getByRole("combobox", { name: /Modell/ }), [
      "claude-opus-5",
    ]);

    expect(onModellChange).toHaveBeenCalledWith("claude-opus-5");
  });

  /**
   * Ein Wechsel mitten in der Unterhaltung ist erlaubt; die folgenden
   * Antworten kommen vom neuen Modell (req-081).
   */
  it("fragt nach einem Wechsel das neue Modell", async () => {
    const dienst = schnittstelle();
    dienst.antwortetMit(
      { art: "frage", nachricht: nachricht("ich", "Erste Frage") },
      {
        art: "antwort",
        nachricht: nachricht("ki", "Erste Antwort", "claude-sonnet-5"),
      },
    );
    const { rerender, onModellChange } = zeige();
    await screen.findByText(VERLAUF_LEER_HINWEIS);
    await sende("Erste Frage");
    await waitFor(() =>
      expect(dienst.letzteFrage().modell).toBe("claude-sonnet-5"),
    );

    // Das gewaehlte Modell liegt in PlanView -- ein Wechsel kommt als neue
    // Eigenschaft zurueck.
    rerender(
      <ChatFenster
        tripId={TRIP_ID}
        hasAnthropicKey
        modell="claude-haiku-4-5"
        onModellChange={onModellChange}
      />,
    );
    dienst.antwortetMit(
      { art: "frage", nachricht: nachricht("ich", "Zweite Frage") },
      {
        art: "antwort",
        nachricht: nachricht("ki", "Zweite Antwort", "claude-haiku-4-5"),
      },
    );
    await sende("Zweite Frage");

    await waitFor(() =>
      expect(dienst.letzteFrage().modell).toBe("claude-haiku-4-5"),
    );
  });

  it("nennt zu jeder Antwort das Modell, von dem sie kam", async () => {
    schnittstelle({
      [TRIP_ID]: [
        nachricht("ich", "Frage"),
        nachricht("ki", "Von Opus", "claude-opus-5"),
        nachricht("ich", "Noch eine"),
        nachricht("ki", "Von Haiku", "claude-haiku-4-5"),
      ],
    });
    zeige();
    await screen.findByText("Von Opus");

    expect(within(verlauf()).getByText("Claude Opus 5")).toBeInTheDocument();
    expect(within(verlauf()).getByText("Claude Haiku 4.5")).toBeInTheDocument();
  });

  it("stellt an eine eigene Nachricht kein Modell", async () => {
    schnittstelle({ [TRIP_ID]: [nachricht("ich", "Nur meine Frage")] });
    zeige();
    await screen.findByText("Nur meine Frage");

    const zeile = within(verlauf()).getByRole("listitem");
    expect(zeile.textContent).toBe("Nur meine Frage");
  });
});

/** Was der Dienst heute anbietet, die neueren zuerst (req-090). */
const FUENF_AKTIVE: ChatModell[] = [
  chatModell("claude-opus-5-5", "Claude Opus 5.5", "opus", 1000000),
  chatModell("claude-sonnet-5-5", "Claude Sonnet 5.5", "sonnet", 1000000),
  chatModell("claude-haiku-5-5", "Claude Haiku 5.5", "haiku", 200000),
  chatModell("claude-opus-5", "Claude Opus 5", "opus", 1000000),
  chatModell("claude-sonnet-5", "Claude Sonnet 5", "sonnet", 1000000),
];

function auswahlFeld() {
  return screen.getByRole("combobox", { name: /Modell/ });
}

function optionen() {
  return within(auswahlFeld()).getAllByRole("option");
}

/** Das Fenster mit der Wahl in einem Zustand darueber, wie in PlanView. */
function ZeigeMitWahl() {
  const [modell, setModell] = useState<string | null>(null);
  return (
    <ChatFenster
      tripId={TRIP_ID}
      hasAnthropicKey
      modell={modell}
      onModellChange={setModell}
    />
  );
}

describe("Chatfenster -- Modelle vom Dienst (req-090)", () => {
  it("fuehrt genau die fuenf aktiven Modelle des Dienstes", async () => {
    schnittstelle({}, [], { modelle: FUENF_AKTIVE, grund: null });
    zeige();

    await waitFor(() => expect(optionen()).toHaveLength(5));
    expect(optionen().map((option) => option.getAttribute("value"))).toEqual(
      FUENF_AKTIVE.map((modell) => modell.id),
    );
  });

  it("beschriftet mit dem Namen des Dienstes und nicht mit der Kennung", async () => {
    schnittstelle({}, [], { modelle: FUENF_AKTIVE, grund: null });
    zeige();

    await waitFor(() => expect(optionen()).toHaveLength(5));
    const sonnet = optionen()[1];
    expect(sonnet).toHaveTextContent("Claude Sonnet 5.5");
    expect(sonnet.textContent).not.toContain("claude-sonnet-5-5");
    expect(sonnet.textContent).toBe(
      "Claude Sonnet 5.5 — 1.000.000 Token Kontext",
    );
  });

  it("behaelt die Reihenfolge des Dienstes", async () => {
    schnittstelle({}, [], { modelle: FUENF_AKTIVE, grund: null });
    zeige();

    await waitFor(() => expect(optionen()).toHaveLength(5));
    expect(optionen().map((option) => option.textContent)).toEqual([
      "Claude Opus 5.5 — 1.000.000 Token Kontext",
      "Claude Sonnet 5.5 — 1.000.000 Token Kontext",
      "Claude Haiku 5.5 — 200.000 Token Kontext",
      "Claude Opus 5 — 1.000.000 Token Kontext",
      "Claude Sonnet 5 — 1.000.000 Token Kontext",
    ]);
  });

  it("waehlt fuer eine neue Unterhaltung das neueste Sonnet vor", async () => {
    schnittstelle({}, [], { modelle: FUENF_AKTIVE, grund: null });
    zeige();

    await waitFor(() => expect(auswahlFeld()).toHaveValue("claude-sonnet-5-5"));
  });

  it("waehlt ohne Sonnet das erste Modell vor", async () => {
    schnittstelle({}, [], {
      modelle: [
        chatModell("claude-haiku-5-5", "Claude Haiku 5.5", "haiku"),
        chatModell("claude-opus-5-5", "Claude Opus 5.5", "opus"),
      ],
      grund: null,
    });
    zeige();

    await waitFor(() => expect(auswahlFeld()).toHaveValue("claude-haiku-5-5"));
  });

  it("bleibt bei dem Modell, mit dem die Unterhaltung laeuft", async () => {
    schnittstelle(
      {
        [TRIP_ID]: [
          nachricht("ich", "Frage"),
          nachricht("ki", "Antwort", "claude-opus-5"),
        ],
      },
      [],
      { modelle: FUENF_AKTIVE, grund: null },
    );
    zeige();

    await within(verlauf()).findByText("Claude Opus 5");
    expect(auswahlFeld()).toHaveValue("claude-opus-5");
  });

  it("nimmt die Vorwahl, wenn das laufende Modell nicht mehr zur Wahl steht", async () => {
    schnittstelle(
      {
        [TRIP_ID]: [
          nachricht("ich", "Frage"),
          nachricht("ki", "Antwort", "claude-haiku-4-5"),
        ],
      },
      [],
      { modelle: FUENF_AKTIVE, grund: null },
    );
    zeige();

    await within(verlauf()).findByText("Antwort");
    await waitFor(() => expect(auswahlFeld()).toHaveValue("claude-sonnet-5-5"));
  });

  it("laesst am Verlauf die Kennung stehen, die der Dienst nicht mehr nennt", async () => {
    schnittstelle(
      {
        [TRIP_ID]: [
          nachricht("ich", "Frage"),
          nachricht("ki", "Von früher", "claude-opus-4-1"),
        ],
      },
      [],
      { modelle: FUENF_AKTIVE, grund: null },
    );
    zeige();

    await waitFor(() => expect(optionen()).toHaveLength(5));
    expect(within(verlauf()).getByText("claude-opus-4-1")).toBeInTheDocument();
  });

  it("fragt mit genau dem Modell, das ich waehle", async () => {
    const dienst = schnittstelle({}, [], {
      modelle: FUENF_AKTIVE,
      grund: null,
    });
    dienst.antwortetMit(
      { art: "frage", nachricht: nachricht("ich", "Hallo") },
      {
        art: "antwort",
        nachricht: nachricht("ki", "Servus", "claude-haiku-5-5"),
      },
    );
    render(<ZeigeMitWahl />);
    await waitFor(() => expect(optionen()).toHaveLength(5));

    const user = await sende("Hallo");
    await within(verlauf()).findByText("Servus");
    expect(dienst.letzteFrage().modell).toBe("claude-sonnet-5-5");

    await user.selectOptions(auswahlFeld(), ["claude-haiku-5-5"]);
    await sende("Und jetzt?");

    await waitFor(() =>
      expect(dienst.letzteFrage().modell).toBe("claude-haiku-5-5"),
    );
  });

  it("zeigt, solange die Liste geholt wird, das laufende Modell", async () => {
    let liefern: (antwort: ChatModelleAntwort) => void = () => {};
    schnittstelle(
      {
        [TRIP_ID]: [
          nachricht("ich", "Frage"),
          nachricht("ki", "Antwort", "claude-opus-5"),
        ],
      },
      [],
      new Promise<ChatModelleAntwort>((resolve) => {
        liefern = resolve;
      }),
    );
    zeige();

    await within(verlauf()).findByText("Antwort");
    expect(auswahlFeld()).toHaveValue("claude-opus-5");
    expect(auswahlFeld()).toBeEnabled();
    expect(optionen()).toHaveLength(1);

    liefern({ modelle: FUENF_AKTIVE, grund: null });
    await waitFor(() => expect(optionen()).toHaveLength(5));
    expect(auswahlFeld()).toHaveValue("claude-opus-5");
  });

  it("zeigt, solange die Liste geholt wird und nichts laeuft, keinen leeren Zustand", async () => {
    schnittstelle({}, [], new Promise<ChatModelleAntwort>(() => {}));
    zeige();

    await screen.findByText(VERLAUF_LEER_HINWEIS);
    expect(optionen().map((option) => option.textContent)).toEqual([
      MODELLE_WERDEN_GEHOLT,
    ]);
  });
});

describe("Chatfenster -- wenn die Liste der Modelle fehlt (req-090)", () => {
  it("zeigt das laufende Modell und sagt, dass die Liste fehlt", async () => {
    schnittstelle(
      {
        [TRIP_ID]: [
          nachricht("ich", "Frage"),
          nachricht("ki", "Antwort", "claude-sonnet-5"),
        ],
      },
      [],
      { modelle: null, grund: "dienst" },
    );
    zeige();

    expect(await screen.findByText(MODELLE_FEHLEN_HINWEIS)).toBeVisible();
    expect(optionen().map((option) => option.getAttribute("value"))).toEqual([
      "claude-sonnet-5",
    ]);
    expect(auswahlFeld()).toHaveValue("claude-sonnet-5");
  });

  it("zeigt die eigene Wahl, wenn die Liste fehlt", async () => {
    schnittstelle({}, [], { modelle: null, grund: "dienst" });
    zeige(TRIP_ID, "claude-opus-5");

    expect(await screen.findByText(MODELLE_FEHLEN_HINWEIS)).toBeVisible();
    expect(auswahlFeld()).toHaveValue("claude-opus-5");
  });

  it("laesst mit dem laufenden Modell weiter fragen", async () => {
    const dienst = schnittstelle(
      {
        [TRIP_ID]: [
          nachricht("ich", "Frage"),
          nachricht("ki", "Antwort", "claude-sonnet-5"),
        ],
      },
      [
        { art: "frage", nachricht: nachricht("ich", "Weiter") },
        {
          art: "antwort",
          nachricht: nachricht("ki", "Gern", "claude-sonnet-5"),
        },
      ],
      { modelle: null, grund: "dienst" },
    );
    zeige();
    await screen.findByText(MODELLE_FEHLEN_HINWEIS);

    await sende("Weiter");

    await waitFor(() =>
      expect(dienst.letzteFrage().modell).toBe("claude-sonnet-5"),
    );
  });

  it("sagt es auch, wenn noch kein Modell lief", async () => {
    schnittstelle({}, [], { modelle: null, grund: "dienst" });
    zeige();

    expect(await screen.findByText(MODELLE_FEHLEN_OHNE_MODELL)).toBeVisible();
    expect(
      screen.queryByRole("combobox", { name: /Modell/ }),
    ).not.toBeInTheDocument();
  });

  it("sagt es auch, wenn die Schnittstelle gar nicht antwortet", async () => {
    const dienst = schnittstelle();
    dienst.fetchMock.mockImplementation(async (eingabe: unknown) => {
      if (String(eingabe).startsWith("/api/chat/modelle")) {
        throw new Error("network down");
      }
      return Response.json({ nachrichten: [] });
    });
    zeige(TRIP_ID, "claude-sonnet-5");

    expect(await screen.findByText(MODELLE_FEHLEN_HINWEIS)).toBeVisible();
    expect(auswahlFeld()).toHaveValue("claude-sonnet-5");
  });

  it("zeigt keinen Hinweis, wenn die Liste da ist", async () => {
    schnittstelle();
    zeige();

    await waitFor(() => expect(optionen()).toHaveLength(3));
    expect(screen.queryByText(MODELLE_FEHLEN_HINWEIS)).not.toBeInTheDocument();
    expect(
      screen.queryByText(MODELLE_FEHLEN_OHNE_MODELL),
    ).not.toBeInTheDocument();
  });
});

describe("Chatfenster ohne Zugangsschlüssel -- die Modellauswahl (req-090)", () => {
  it("nennt den fehlenden Schlüssel und zeigt keine leere Auswahl", async () => {
    const dienst = schnittstelle();
    zeige(TRIP_ID, null, false);

    expect(
      await screen.findByText(apiKeyMissingHint("anthropic")),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("combobox", { name: /Modell/ }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(MODELLE_FEHLEN_HINWEIS)).not.toBeInTheDocument();
    expect(dienst.modellAbrufe()).toBe(0);
  });

  it("zeigt das Modell einer vorhandenen Unterhaltung", async () => {
    schnittstelle({
      [TRIP_ID]: [
        nachricht("ich", "Frage"),
        nachricht("ki", "Antwort", "claude-sonnet-5"),
      ],
    });
    zeige(TRIP_ID, null, false);

    await within(verlauf()).findByText("Antwort");
    expect(
      screen.getByText(apiKeyMissingHint("anthropic")),
    ).toBeInTheDocument();
    expect(optionen().map((option) => option.getAttribute("value"))).toEqual([
      "claude-sonnet-5",
    ]);
  });
});

/**
 * Ein Fehler wird benannt und nicht verschluckt (bug-032): der Grund steht an
 * der Stelle, an der die Antwort stuende, und die Frage bleibt stehen.
 */
describe("Chatfenster -- wenn eine Antwort fehlschlaegt (req-081)", () => {
  it("nennt den Grund und laesst die Frage stehen", async () => {
    const dienst = schnittstelle();
    dienst.antwortetMit(
      { art: "frage", nachricht: nachricht("ich", "Geht das?") },
      { art: "fehler", grund: "kontingent" },
    );
    zeige();
    await screen.findByText(VERLAUF_LEER_HINWEIS);

    await sende("Geht das?");

    expect(
      await within(verlauf()).findByText(AI_FEHLER_TEXT.kontingent),
    ).toBeInTheDocument();
    expect(within(verlauf()).getByText("Geht das?")).toBeInTheDocument();
  });

  it("nennt den Grund auch, wenn die Schnittstelle gar nicht antwortet", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (eingabe: unknown, init?: RequestInit) => {
        if (!init?.method || init.method === "GET") {
          return Response.json({ nachrichten: [] });
        }
        throw new Error("network down");
      }),
    );
    // Dieser Mock kennt keine Modellauswahl -- gewaehlt ist trotzdem eines.
    zeige(TRIP_ID, "claude-sonnet-5");
    await screen.findByText(VERLAUF_LEER_HINWEIS);

    await sende("Hallo");

    expect(
      await within(verlauf()).findByText(AI_FEHLER_TEXT.netz),
    ).toBeInTheDocument();
  });

  /**
   * Die Frage laesst sich erneut senden, ohne sie noch einmal zu tippen
   * (req-081) -- sie steht ja noch im Verlauf.
   */
  it("sendet die Frage auf einen Tipp erneut", async () => {
    const dienst = schnittstelle();
    const gestellt = nachricht("ich", "Erneut senden");
    dienst.antwortetMit(
      { art: "frage", nachricht: gestellt },
      { art: "fehler", grund: "netz" },
    );
    zeige();
    await screen.findByText(VERLAUF_LEER_HINWEIS);
    await sende("Erneut senden");
    await within(verlauf()).findByText(AI_FEHLER_TEXT.netz);

    dienst.antwortetMit(
      // Dieselbe Frage mit derselben Kennung: sie steht schon im Verlauf.
      { art: "frage", nachricht: gestellt },
      {
        art: "antwort",
        nachricht: nachricht("ki", "Diesmal klappt es.", "claude-sonnet-5"),
      },
    );
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Erneut senden" }));

    expect(
      await within(verlauf()).findByText("Diesmal klappt es."),
    ).toBeInTheDocument();
    // Der Grund von vorhin steht nicht mehr da: er gehoerte zum
    // fehlgeschlagenen Versuch.
    expect(
      within(verlauf()).queryByText(AI_FEHLER_TEXT.netz),
    ).not.toBeInTheDocument();
    // Und die Frage steht genau einmal da, nicht zweimal.
    expect(within(verlauf()).getAllByText("Erneut senden")).toHaveLength(1);
    expect(dienst.letzteFrage()).toMatchObject({
      text: "Erneut senden",
      wiederholen: true,
    });
  });

  it("bietet das erneute Senden nur nach einem Fehlschlag an", async () => {
    const dienst = schnittstelle();
    dienst.antwortetMit(
      { art: "frage", nachricht: nachricht("ich", "Hallo") },
      {
        art: "antwort",
        nachricht: nachricht("ki", "Hallo!", "claude-sonnet-5"),
      },
    );
    zeige();
    await screen.findByText(VERLAUF_LEER_HINWEIS);

    await sende("Hallo");

    expect(await within(verlauf()).findByText("Hallo!")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Erneut senden" }),
    ).not.toBeInTheDocument();
  });
});
