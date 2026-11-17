import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { KiModellFeld } from "@/lib/ki-modelle/zwecke";
import { KI_MODELLE_FEHLER } from "@/lib/ki-modelle/karte";
import { KiModelleCard } from "./ki-modelle-card";

/**
 * Die Karte "KI-Modelle" (req-108). Die Schnittstelle antwortet wie
 * app/api/ki-modelle/route.ts -- dort wird sie gegen die Datenbank und die
 * gemockten Dienste geprueft. Hier zaehlt, was die Karte daraus macht.
 */

const OPENAI_MODELLE = [
  { id: "gpt-4.1-mini", name: "gpt-4.1-mini", abschaltungAm: "2027-03-12" },
  { id: "gpt-5.6-luna", name: "gpt-5.6-luna", abschaltungAm: null },
  {
    id: "gpt-image-2.5-flare",
    name: "gpt-image-2.5-flare",
    abschaltungAm: null,
  },
];

function feld(teil: Partial<KiModellFeld> & Pick<KiModellFeld, "zweck">) {
  return {
    gewaehlt: null,
    ohneWahl: null,
    modelle: null,
    grund: null,
    gemerktAm: null,
    verschwunden: null,
    ...teil,
  } satisfies KiModellFeld;
}

const MIT_SCHLUESSELN: KiModellFeld[] = [
  feld({ zweck: "fragen", ohneWahl: "gpt-5.6-luna", modelle: OPENAI_MODELLE }),
  feld({
    zweck: "bilder",
    ohneWahl: "gpt-image-2.5-flare",
    modelle: OPENAI_MODELLE,
  }),
  feld({
    zweck: "chat",
    ohneWahl: "claude-sonnet-5-5",
    modelle: [
      { id: "claude-opus-5-5", name: "Claude Opus 5.5", abschaltungAm: null },
      {
        id: "claude-sonnet-5-5",
        name: "Claude Sonnet 5.5",
        abschaltungAm: null,
      },
    ],
  }),
];

function antwortet(...antworten: [number, unknown][]) {
  const fetchMock = vi.fn();
  for (const [status, payload] of antworten) {
    fetchMock.mockResolvedValueOnce({
      ok: status < 400,
      status,
      json: async () => payload,
    });
  }
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

async function zeige(felder: KiModellFeld[]) {
  const fetchMock = antwortet([200, { felder }]);
  render(<KiModelleCard schluesselStand="" />);
  await waitFor(() =>
    expect(screen.queryByText("Die Modelle werden geholt…")).toBeNull(),
  );
  return fetchMock;
}

function optionen(name: string): string[] {
  return within(screen.getByRole("combobox", { name }))
    .getAllByRole("option")
    .map((option) => option.textContent ?? "");
}

beforeEach(() => {
  vi.unstubAllGlobals();
});

describe("Karte KI-Modelle (req-108)", () => {
  it("zeigt drei Auswahlfelder", async () => {
    await zeige(MIT_SCHLUESSELN);

    const karte = screen.getByRole("region", { name: "KI-Modelle" });
    expect(within(karte).getAllByRole("combobox")).toHaveLength(3);
    expect(screen.getByRole("combobox", { name: "Bilder" })).toBeVisible();
    expect(
      screen.getByRole("combobox", { name: "Chat im Planer" }),
    ).toBeVisible();
  });

  it("listet die Modelle, die der Dienst nennt", async () => {
    await zeige(MIT_SCHLUESSELN);

    expect(optionen("Chat im Planer")).toEqual([
      "Nichts gewählt — es gilt claude-sonnet-5-5",
      "Claude Opus 5.5",
      "Claude Sonnet 5.5",
    ]);
  });

  it("stellt das Abschaltdatum neben ein Modell, das auf dem Weg hinaus ist", async () => {
    await zeige(MIT_SCHLUESSELN);

    expect(optionen("Fragen")).toContain(
      "gpt-4.1-mini — wird am 12.03.2027 abgeschaltet",
    );
    expect(optionen("Fragen")).toContain("gpt-5.6-luna");
  });

  it("sagt ohne Schluessel, welcher fehlt, und listet keine Modelle", async () => {
    await zeige([
      feld({ zweck: "fragen", grund: "schluessel", ohneWahl: "gpt-5.6-luna" }),
      feld({ zweck: "bilder", grund: "schluessel" }),
      feld({ zweck: "chat", grund: "schluessel" }),
    ]);

    expect(screen.queryAllByRole("combobox")).toHaveLength(0);
    expect(
      within(screen.getByTestId("ki-modell-fragen")).getByText(
        /Für „KI-Suche“ ist kein Zugangsschlüssel hinterlegt/,
      ),
    ).toBeVisible();
    expect(
      within(screen.getByTestId("ki-modell-chat")).getByText(
        /Für „Chat im Planer“ ist kein Zugangsschlüssel hinterlegt/,
      ),
    ).toBeVisible();
    expect(
      screen.getAllByText(/in der Karte „Zugangsschlüssel“ darüber/),
    ).toHaveLength(3);
  });

  it("nennt ein verschwundenes Modell mit seinem Namen", async () => {
    await zeige([
      MIT_SCHLUESSELN[0],
      feld({
        zweck: "bilder",
        gewaehlt: "gpt-image-1",
        modelle: OPENAI_MODELLE,
        verschwunden: "gpt-image-1",
      }),
      MIT_SCHLUESSELN[2],
    ]);

    const bilder = screen.getByTestId("ki-modell-bilder");
    expect(within(bilder).getByRole("alert")).toHaveTextContent(
      "Das Modell „gpt-image-1“ nennt der Dienst nicht mehr",
    );
    expect(within(bilder).getByRole("alert")).toHaveTextContent(
      "Wähle ein anderes.",
    );
    expect(screen.getByRole("combobox", { name: "Bilder" })).toHaveValue(
      "gpt-image-1",
    );
  });

  it("sagt, wenn die Liste nur noch gemerkt ist", async () => {
    await zeige([
      feld({
        zweck: "fragen",
        modelle: OPENAI_MODELLE,
        gemerktAm: "2026-11-16T09:00:00.000Z",
      }),
      MIT_SCHLUESSELN[1],
      MIT_SCHLUESSELN[2],
    ]);

    expect(
      within(screen.getByTestId("ki-modell-fragen")).getByRole("status"),
    ).toHaveTextContent(
      "Der Dienst antwortet gerade nicht. Die Liste ist gemerkt — Stand 16.11.2026, 10:00.",
    );
    expect(optionen("Fragen")).toHaveLength(4);
  });

  it("sagt, wenn die Liste gar nicht zu holen ist", async () => {
    await zeige([
      feld({ zweck: "fragen", grund: "dienst", ohneWahl: "gpt-5.6-luna" }),
      MIT_SCHLUESSELN[1],
      MIT_SCHLUESSELN[2],
    ]);

    expect(screen.getByTestId("ki-modell-fragen")).toHaveTextContent(
      "Die Liste der Modelle ist gerade nicht zu holen",
    );
  });

  it("speichert die Wahl", async () => {
    const user = userEvent.setup();
    const fetchMock = await zeige(MIT_SCHLUESSELN);
    const neu = MIT_SCHLUESSELN.map((eintrag) =>
      eintrag.zweck === "bilder"
        ? { ...eintrag, gewaehlt: "gpt-image-2.5-flare" }
        : eintrag,
    );
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ felder: neu }),
    });

    await user.selectOptions(
      screen.getByRole("combobox", { name: "Bilder" }),
      "gpt-image-2.5-flare",
    );
    await user.click(
      screen.getByRole("button", { name: "Bilder: Wahl speichern" }),
    );

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Bilder: Wahl speichern" }),
      ).toBeDisabled(),
    );
    const [url, init] = fetchMock.mock.calls[1] as [
      string,
      { method: string; body: string },
    ];
    expect(url).toBe("/api/ki-modelle");
    expect(init.method).toBe("PUT");
    expect(JSON.parse(init.body)).toEqual({
      zweck: "bilder",
      modell: "gpt-image-2.5-flare",
    });
    expect(screen.getByRole("combobox", { name: "Bilder" })).toHaveValue(
      "gpt-image-2.5-flare",
    );
  });

  it("laesst die Wahl stehen und sagt es, wenn das Speichern scheitert", async () => {
    const user = userEvent.setup();
    const fetchMock = await zeige(MIT_SCHLUESSELN);
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({}),
    });

    await user.selectOptions(
      screen.getByRole("combobox", { name: "Fragen" }),
      "gpt-4.1-mini",
    );
    await user.click(
      screen.getByRole("button", { name: "Fragen: Wahl speichern" }),
    );

    expect(
      await within(screen.getByTestId("ki-modell-fragen")).findByRole("alert"),
    ).toHaveTextContent(KI_MODELLE_FEHLER.speichern);
    expect(screen.getByRole("combobox", { name: "Fragen" })).toHaveValue(
      "gpt-4.1-mini",
    );
  });
});
