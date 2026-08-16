import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LOGOUT_API, RECOVERY_CODES_API } from "@/lib/auth/paths";
import { KontoView } from "./konto-view";

const NEUE_CODES = [
  "ABCD-EFGH-JKLM",
  "NPQR-STUV-WXYZ",
  "2345-6789-ABCD",
  "EFGH-JKLM-NPQR",
  "STUV-WXYZ-2345",
  "6789-ABCD-EFGH",
  "JKLM-NPQR-STUV",
  "WXYZ-2345-6789",
];

function stubFetch(body: unknown = { status: "ok" }) {
  const fetchMock = vi.fn(
    async () => ({ ok: true, json: async () => body }) as Response,
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("KontoView (req-016)", () => {
  it("zeigt die Zahl der noch unverbrauchten Notfallcodes", () => {
    render(
      <KontoView
        email="uwe@kremmel.org"
        passkeys={[]}
        offeneNotfallcodes={5}
      />,
    );

    expect(
      screen.getByText("Noch nicht verbraucht: 5 von 8."),
    ).toBeInTheDocument();
  });

  it("zeigt die hinterlegten Passkeys", () => {
    render(
      <KontoView
        email="uwe@kremmel.org"
        passkeys={[
          { id: "cred-1", label: "Telefon" },
          { id: "cred-2", label: "Laptop" },
        ]}
        offeneNotfallcodes={8}
      />,
    );

    expect(screen.getByText("Telefon")).toBeInTheDocument();
    expect(screen.getByText("Laptop")).toBeInTheDocument();
  });

  it("sagt, wenn noch kein Passkey hinterlegt ist", () => {
    render(
      <KontoView
        email="uwe@kremmel.org"
        passkeys={[]}
        offeneNotfallcodes={8}
      />,
    );

    expect(screen.getByText(/noch kein Passkey/)).toBeInTheDocument();
  });

  it("erzeugt einen neuen Satz Notfallcodes und zeigt ihn einmalig", async () => {
    const user = userEvent.setup();
    const fetchMock = stubFetch({ codes: NEUE_CODES, offen: 8 });
    render(
      <KontoView
        email="uwe@kremmel.org"
        passkeys={[]}
        offeneNotfallcodes={3}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: "Neuen Satz erzeugen" }),
    );

    expect(fetchMock).toHaveBeenCalledWith(RECOVERY_CODES_API, {
      method: "POST",
    });
    for (const code of NEUE_CODES) {
      expect(await screen.findByText(code)).toBeInTheDocument();
    }
    expect(
      await screen.findByText("Noch nicht verbraucht: 8 von 8."),
    ).toBeInTheDocument();
  });

  it("meldet ab und geht zurueck auf die Startseite", async () => {
    const user = userEvent.setup();
    const fetchMock = stubFetch();
    const navigate = vi.fn();
    render(
      <KontoView
        email="uwe@kremmel.org"
        passkeys={[]}
        offeneNotfallcodes={8}
        navigate={navigate}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Abmelden" }));

    expect(fetchMock).toHaveBeenCalledWith(LOGOUT_API, { method: "POST" });
    await waitFor(() => expect(navigate).toHaveBeenCalledWith("/"));
  });

  it("weist auf fehlende Passkey-Unterstuetzung hin", () => {
    render(
      <KontoView
        email="uwe@kremmel.org"
        passkeys={[]}
        offeneNotfallcodes={8}
      />,
    );

    // jsdom kennt keine Passkeys — genau wie ein Geraet ohne Unterstuetzung.
    expect(
      screen.getByRole("button", { name: "Passkey einrichten" }),
    ).toBeDisabled();
  });
});
