import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  NotfallcodesView,
  RECOVERY_CODES_GONE_NOTICE,
} from "./notfallcodes-view";

const CODES = [
  "ABCD-EFGH-JKLM",
  "NPQR-STUV-WXYZ",
  "2345-6789-ABCD",
  "EFGH-JKLM-NPQR",
  "STUV-WXYZ-2345",
  "6789-ABCD-EFGH",
  "JKLM-NPQR-STUV",
  "WXYZ-2345-6789",
];

function stubCodes(codes: string[] | null) {
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () => ({ ok: true, json: async () => ({ codes }) }) as Response,
    ),
  );
}

describe("NotfallcodesView (req-016)", () => {
  it("zeigt die acht Notfallcodes nach der ersten Anmeldung", async () => {
    stubCodes(CODES);
    render(<NotfallcodesView weiter="/go" />);

    const liste = await screen.findByRole("list");
    expect(within(liste).getAllByRole("listitem")).toHaveLength(8);
    for (const code of CODES) {
      expect(screen.getByText(code)).toBeInTheDocument();
    }
  });

  it("zeigt sie beim erneuten Aufruf der Seite nicht noch einmal", async () => {
    // Die Schnittstelle liefert die Codes nur ein einziges Mal aus.
    stubCodes(null);
    render(<NotfallcodesView weiter="/go" />);

    expect(await screen.findByRole("status")).toHaveTextContent(
      RECOVERY_CODES_GONE_NOTICE,
    );
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });

  it("laesst die Codes kopieren", async () => {
    const user = userEvent.setup();
    stubCodes(CODES);
    const copyToClipboard = vi.fn(async () => {});
    render(<NotfallcodesView weiter="/go" copyToClipboard={copyToClipboard} />);

    await user.click(await screen.findByRole("button", { name: "Kopieren" }));

    expect(copyToClipboard).toHaveBeenCalledWith(CODES.join("\n"));
  });

  it("laesst die Codes drucken", async () => {
    const user = userEvent.setup();
    stubCodes(CODES);
    const print = vi.fn();
    render(<NotfallcodesView weiter="/go" print={print} />);

    await user.click(await screen.findByRole("button", { name: "Drucken" }));

    expect(print).toHaveBeenCalled();
  });

  it("geht erst nach der Bestaetigung weiter", async () => {
    const user = userEvent.setup();
    stubCodes(CODES);
    const navigate = vi.fn();
    render(<NotfallcodesView weiter="/go" navigate={navigate} />);

    const weiterButton = await screen.findByRole("button", { name: "Weiter" });
    expect(weiterButton).toBeDisabled();

    await user.click(screen.getByRole("checkbox"));
    await user.click(weiterButton);

    await waitFor(() => expect(navigate).toHaveBeenCalledWith("/go"));
  });
});
