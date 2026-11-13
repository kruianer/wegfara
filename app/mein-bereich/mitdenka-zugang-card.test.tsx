import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { MitdenkaZugangStand } from "@/lib/werkzeuge/zugang";
import {
  MITDENKA_EINMAL_HINWEIS,
  MITDENKA_ZUGANG_FEHLER,
  MitdenkaZugangCard,
} from "./mitdenka-zugang-card";

const OHNE: MitdenkaZugangStand = {
  vorhanden: false,
  zuletztBenutzt: null,
  googleAbfragenHeute: 0,
  googleGrenze: 50,
};

const ERZEUGT: MitdenkaZugangStand = { ...OHNE, vorhanden: true };

const SCHLUESSEL = "wegfara_Geheim-fuer-den-Test-1234567890abcdefghij";

/**
 * Die Schnittstelle antwortet wie app/api/mitdenka-zugang/route.ts -- dort
 * wird sie gegen die Datenbank geprueft. Hier zaehlt, was die Karte zeigt.
 */
function antwortet(status: number, payload: unknown) {
  const fetchMock = vi.fn(async () => ({
    ok: status < 400,
    status,
    json: async () => payload,
  }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

beforeEach(() => {
  vi.unstubAllGlobals();
});

describe("Karte „Zugang für mitdenka“ (req-104)", () => {
  it("zeigt den erzeugten Schlüssel im Klartext, mit dem Hinweis", async () => {
    const user = userEvent.setup();
    const fetchMock = antwortet(200, {
      schluessel: SCHLUESSEL,
      stand: ERZEUGT,
    });
    render(<MitdenkaZugangCard stand={OHNE} />);

    await user.click(
      screen.getByRole("button", { name: "Schlüssel erzeugen" }),
    );

    expect(await screen.findByText(SCHLUESSEL)).toBeInTheDocument();
    expect(screen.getByText(MITDENKA_EINMAL_HINWEIS)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Kopieren" }),
    ).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith("/api/mitdenka-zugang", {
      method: "POST",
    });
  });

  it("zeigt nach dem Neuladen keinen Schlüssel mehr im Klartext", () => {
    // Nach dem Neuladen kennt die Seite nur den Stand -- der Schluessel
    // kommt vom Server nie wieder (siehe page.tsx).
    render(<MitdenkaZugangCard stand={ERZEUGT} />);

    expect(screen.queryByTestId("mitdenka-schluessel")).toBeNull();
    expect(screen.queryByText(/wegfara_/)).toBeNull();
    expect(screen.getByText("Erzeugt")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Neuen Schlüssel erzeugen" }),
    ).toBeInTheDocument();
  });

  it("kopiert den Schlüssel in die Zwischenablage", async () => {
    const user = userEvent.setup();
    antwortet(200, { schluessel: SCHLUESSEL, stand: ERZEUGT });
    render(<MitdenkaZugangCard stand={OHNE} />);
    await user.click(
      screen.getByRole("button", { name: "Schlüssel erzeugen" }),
    );
    const writeText = vi
      .spyOn(navigator.clipboard, "writeText")
      .mockResolvedValue(undefined);

    await user.click(await screen.findByRole("button", { name: "Kopieren" }));

    expect(writeText).toHaveBeenCalledWith(SCHLUESSEL);
    expect(
      await screen.findByRole("button", { name: "Kopiert" }),
    ).toBeInTheDocument();
  });

  it("widerruft den Schlüssel", async () => {
    const user = userEvent.setup();
    const fetchMock = antwortet(200, { stand: OHNE });
    render(<MitdenkaZugangCard stand={ERZEUGT} />);

    await user.click(screen.getByRole("button", { name: "Widerrufen" }));

    expect(await screen.findByText("Keiner erzeugt")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Widerrufen" })).toBeNull();
    expect(fetchMock).toHaveBeenCalledWith("/api/mitdenka-zugang", {
      method: "DELETE",
    });
  });

  it("nennt einen Fehlschlag beim Erzeugen", async () => {
    const user = userEvent.setup();
    antwortet(500, {});
    render(<MitdenkaZugangCard stand={OHNE} />);

    await user.click(
      screen.getByRole("button", { name: "Schlüssel erzeugen" }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      MITDENKA_ZUGANG_FEHLER.erzeugen,
    );
  });

  it("nennt, wann der Schlüssel zuletzt benutzt wurde", () => {
    render(
      <MitdenkaZugangCard
        stand={{ ...ERZEUGT, zuletztBenutzt: "13.11.2026" }}
      />,
    );

    expect(screen.getByTestId("mitdenka-zuletzt-benutzt")).toHaveTextContent(
      "13.11.2026",
    );
  });

  it("nennt die Google-Abfragen heute von der Grenze", () => {
    render(
      <MitdenkaZugangCard stand={{ ...ERZEUGT, googleAbfragenHeute: 5 }} />,
    );

    expect(screen.getByTestId("mitdenka-google-stand")).toHaveTextContent(
      "5 von 50",
    );
  });
});
