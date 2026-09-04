import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ShareOutcome } from "@/lib/qr/qr-image";
import { TransferCodePanel } from "./transfer-code-panel";

const UWE_ID = "5e0cd230-3765-425b-be49-6a95028ba0b8";
const IBAN = "DE89370400440532013000";

/**
 * Die Schnittstelle antwortet wie app/api/bankverbindung/route.ts -- dort
 * wird sie gegen die echte Datenbank geprueft. Hier zaehlt, was die Flaeche
 * daraus macht.
 */
function server(payload: unknown, status = 200): ReturnType<typeof vi.fn> {
  return vi.fn(async () => ({
    ok: status < 400,
    status,
    json: async () => payload,
  }));
}

function zeige({
  iban = IBAN as string | null,
  status = 200,
  copyToClipboard = vi.fn(async () => {}),
  shareCode = vi.fn(async (): Promise<ShareOutcome> => "geteilt"),
} = {}) {
  vi.stubGlobal("fetch", server({ iban }, status));
  render(
    <TransferCodePanel
      recipientId={UWE_ID}
      recipientName="Uwe Kremmel"
      amountCents={4000}
      onClose={() => {}}
      copyToClipboard={copyToClipboard}
      shareCode={shareCode}
    />,
  );
  return { copyToClipboard, shareCode };
}

/** Die Flaeche, sobald die Bankverbindung da ist. */
async function flaeche(): Promise<HTMLElement> {
  const bereich = screen.getByRole("region", {
    name: "Überweisungscode für Uwe Kremmel",
  });
  await waitFor(() =>
    expect(
      screen.queryByText("Bankverbindung wird geholt …"),
    ).not.toBeInTheDocument(),
  );
  return bereich;
}

beforeEach(() => {
  vi.unstubAllGlobals();
});

describe("Fläche mit dem Überweisungscode (req-031)", () => {
  it("zeigt einen Code, wenn der Empfaenger eine Bankverbindung hat", async () => {
    zeige();

    await flaeche();

    expect(
      screen.getByRole("img", { name: "Überweisungscode für Uwe Kremmel" }),
    ).toBeInTheDocument();
  });

  it("nennt den Betrag der Zahlung", async () => {
    zeige();

    expect(await flaeche()).toHaveTextContent("40,00 €");
  });

  it("nennt die Bankverbindung des Empfaengers", async () => {
    zeige();

    expect(await flaeche()).toHaveTextContent("DE89 3704 0044 0532 0130 00");
  });

  it("nennt den vollen Namen des Empfaengers", async () => {
    zeige();

    expect(await flaeche()).toHaveTextContent("Uwe Kremmel");
  });

  it("legt die Bankverbindung ohne Leerzeichen in die Zwischenablage", async () => {
    const user = userEvent.setup();
    const { copyToClipboard } = zeige();
    await flaeche();

    await user.click(
      screen.getByRole("button", { name: "Bankverbindung kopieren" }),
    );

    expect(copyToClipboard).toHaveBeenCalledWith(IBAN);
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(
        "Bankverbindung liegt in der Zwischenablage",
      ),
    );
  });

  it("legt den Betrag als Zahl in die Zwischenablage", async () => {
    const user = userEvent.setup();
    const { copyToClipboard } = zeige();
    await flaeche();

    await user.click(screen.getByRole("button", { name: "Betrag kopieren" }));

    expect(copyToClipboard).toHaveBeenCalledWith("40,00");
  });

  it("bietet den Code auf Auslösen als Bild an", async () => {
    const user = userEvent.setup();
    const { shareCode } = zeige();
    await flaeche();

    await user.click(screen.getByRole("button", { name: "Als Bild teilen" }));

    expect(shareCode).toHaveBeenCalledWith(
      expect.objectContaining({ dark: expect.any(Array) }),
      "ueberweisungscode.png",
      "Überweisung an Uwe Kremmel",
    );
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(
        "als Bild weitergereicht",
      ),
    );
  });

  it("sagt, wenn sich das Bild nicht weitergeben laesst", async () => {
    const user = userEvent.setup();
    zeige({
      shareCode: vi.fn(async (): Promise<ShareOutcome> => "gescheitert"),
    });
    await flaeche();

    await user.click(screen.getByRole("button", { name: "Als Bild teilen" }));

    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(
        "lässt sich auf diesem Gerät nicht als Bild teilen",
      ),
    );
  });

  it("zeigt ohne hinterlegte Bankverbindung keinen Code, sondern den Grund", async () => {
    zeige({ iban: null });

    const bereich = await flaeche();

    expect(
      screen.queryByRole("img", { name: /Überweisungscode/ }),
    ).not.toBeInTheDocument();
    expect(bereich).toHaveTextContent(
      "Für Uwe Kremmel ist keine Bankverbindung hinterlegt.",
    );
  });

  it("bietet ohne Code auch nichts zum Teilen an", async () => {
    zeige({ iban: null });
    await flaeche();

    expect(
      screen.queryByRole("button", { name: "Als Bild teilen" }),
    ).not.toBeInTheDocument();
  });

  it("sagt es, wenn sich die Bankverbindung nicht holen laesst", async () => {
    zeige({ status: 500 });

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Die Bankverbindung ließ sich nicht holen.",
      ),
    );
  });
});
