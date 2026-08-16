import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  LOGIN_FAILED_NOTICE,
  LOGIN_LINK_INVALID_NOTICE,
  LOGIN_LINK_NOTICE,
} from "@/lib/auth/messages";
import { AnmeldeView } from "./anmelde-view";

function stubFetch(
  handler: (url: string, init?: RequestInit) => { ok: boolean; body: unknown },
) {
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    const { ok, body } = handler(url, init);
    return { ok, json: async () => body } as Response;
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("AnmeldeView (req-016)", () => {
  it("bietet zuerst die Anmeldung per Passkey an", () => {
    render(<AnmeldeView weiter="/go" />);

    expect(
      screen.getByRole("button", { name: "Mit Passkey anmelden" }),
    ).toBeInTheDocument();
  });

  it("bietet die Alternativen auf derselben Seite an", async () => {
    const user = userEvent.setup();
    render(<AnmeldeView weiter="/go" />);

    expect(screen.getByLabelText("E-Mail-Adresse")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Anmeldelink senden" }),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "Notfallcode verwenden" }),
    );

    expect(screen.getByLabelText("Notfallcode")).toBeInTheDocument();
  });

  it("weist auf fehlende Passkey-Unterstuetzung hin", () => {
    render(<AnmeldeView weiter="/go" />);

    // jsdom kennt keine Passkeys — genau wie ein Geraet ohne Unterstuetzung.
    expect(
      screen.getByRole("button", { name: "Mit Passkey anmelden" }),
    ).toBeDisabled();
    expect(screen.getByText(/keine Passkeys/)).toBeInTheDocument();
  });

  it("meldet nach dem Anfordern des Anmeldelinks den Versand", async () => {
    const user = userEvent.setup();
    const fetchMock = stubFetch(() => ({
      ok: true,
      body: { notice: LOGIN_LINK_NOTICE },
    }));
    render(<AnmeldeView weiter="/go" />);

    await user.type(screen.getByLabelText("E-Mail-Adresse"), "uwe@kremmel.org");
    await user.click(
      screen.getByRole("button", { name: "Anmeldelink senden" }),
    );

    expect(await screen.findByRole("status")).toHaveTextContent(
      LOGIN_LINK_NOTICE,
    );
    // Das gemerkte Ziel wandert mit, damit die Anmeldung dort endet, wo
    // sie unterbrochen wurde.
    const [, init] = fetchMock.mock.calls.at(-1)!;
    expect(JSON.parse(String(init?.body))).toEqual({
      email: "uwe@kremmel.org",
      weiter: "/go",
    });
  });

  it("meldet bei unbekannter Adresse dasselbe wie bei bekannter (req-016)", async () => {
    const user = userEvent.setup();
    // Die Schnittstelle antwortet in beiden Faellen gleich; die Ansicht
    // gibt genau diese Antwort weiter und faerbt sie nicht ein.
    stubFetch(() => ({ ok: true, body: { notice: LOGIN_LINK_NOTICE } }));

    const { unmount } = render(<AnmeldeView weiter="/go" />);
    await user.type(screen.getByLabelText("E-Mail-Adresse"), "uwe@kremmel.org");
    await user.click(
      screen.getByRole("button", { name: "Anmeldelink senden" }),
    );
    const bekannt = (await screen.findByRole("status")).textContent;
    unmount();

    render(<AnmeldeView weiter="/go" />);
    await user.type(
      screen.getByLabelText("E-Mail-Adresse"),
      "fremd@example.com",
    );
    await user.click(
      screen.getByRole("button", { name: "Anmeldelink senden" }),
    );
    const unbekannt = (await screen.findByRole("status")).textContent;

    expect(unbekannt).toBe(bekannt);
  });

  it("meldet mit einem Notfallcode an und geht dann weiter", async () => {
    const user = userEvent.setup();
    const fetchMock = stubFetch(() => ({
      ok: true,
      body: { weiter: "/anmeldung/notfallcodes?weiter=%2Fgo" },
    }));
    const navigate = vi.fn();
    render(<AnmeldeView weiter="/go" navigate={navigate} />);

    await user.click(
      screen.getByRole("button", { name: "Notfallcode verwenden" }),
    );
    await user.type(screen.getByLabelText("E-Mail-Adresse"), "uwe@kremmel.org");
    await user.type(screen.getByLabelText("Notfallcode"), "ABCD-EFGH-JKLM");
    await user.click(
      screen.getByRole("button", { name: "Mit Notfallcode anmelden" }),
    );

    await waitFor(() =>
      expect(navigate).toHaveBeenCalledWith(
        "/anmeldung/notfallcodes?weiter=%2Fgo",
      ),
    );
    const [, init] = fetchMock.mock.calls.at(-1)!;
    expect(JSON.parse(String(init?.body))).toEqual({
      email: "uwe@kremmel.org",
      code: "ABCD-EFGH-JKLM",
      weiter: "/go",
    });
  });

  it("nennt bei einem verbrauchten Notfallcode keinen Grund", async () => {
    const user = userEvent.setup();
    stubFetch(() => ({ ok: false, body: { error: LOGIN_FAILED_NOTICE } }));
    const navigate = vi.fn();
    render(<AnmeldeView weiter="/go" navigate={navigate} />);

    await user.click(
      screen.getByRole("button", { name: "Notfallcode verwenden" }),
    );
    await user.type(screen.getByLabelText("E-Mail-Adresse"), "uwe@kremmel.org");
    await user.type(screen.getByLabelText("Notfallcode"), "ABCD-EFGH-JKLM");
    await user.click(
      screen.getByRole("button", { name: "Mit Notfallcode anmelden" }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      LOGIN_FAILED_NOTICE,
    );
    expect(navigate).not.toHaveBeenCalled();
  });

  it("erklaert einen abgelaufenen oder verbrauchten Anmeldelink", () => {
    render(<AnmeldeView weiter="/go" linkFehler />);

    expect(screen.getByRole("alert")).toHaveTextContent(
      LOGIN_LINK_INVALID_NOTICE,
    );
  });
});
