import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  INVITATION_INVALID_NOTICE,
  LOGIN_FAILED_NOTICE,
  LOGIN_LINK_INVALID_NOTICE,
  LOGIN_LINK_NOTICE,
  NO_ACTIVE_TRIP_NOTICE,
  PASSKEY_FAILED_NOTICE,
} from "@/lib/auth/messages";
import { PASSKEY_LOGIN_API, SETUP_PATH } from "@/lib/auth/paths";
import { AnmeldeView } from "./anmelde-view";

/**
 * jsdom kennt weder Passkeys noch Conditional UI. Damit sich auch ein
 * Browser nachstellen laesst, der beides beherrscht, laeuft die Bibliothek
 * hier ueber diese Schalter.
 */
const webauthn = vi.hoisted(() => ({
  unterstuetzt: false,
  autofill: false,
  startAuthentication: vi.fn(),
}));

vi.mock("@simplewebauthn/browser", () => ({
  browserSupportsWebAuthn: () => webauthn.unterstuetzt,
  browserSupportsWebAuthnAutofill: async () => webauthn.autofill,
  startAuthentication: (...args: unknown[]) =>
    webauthn.startAuthentication(...args),
}));

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

/** Ein Browser mit Passkey und Conditional UI, der die Anmeldung annimmt. */
function browserMitPasskey(antwort: unknown = { id: "cred-iphone" }) {
  webauthn.unterstuetzt = true;
  webauthn.autofill = true;
  webauthn.startAuthentication.mockResolvedValue(antwort);
  return stubFetch((url) =>
    url === PASSKEY_LOGIN_API
      ? { ok: true, body: { challenge: "aufforderung", weiter: "/go" } }
      : { ok: true, body: { notice: LOGIN_LINK_NOTICE } },
  );
}

beforeEach(() => {
  webauthn.unterstuetzt = false;
  webauthn.autofill = false;
  webauthn.startAuthentication.mockReset();
});

describe("AnmeldeView (req-016)", () => {
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
    render(<AnmeldeView weiter="/go" fehler="link" />);

    expect(screen.getByRole("alert")).toHaveTextContent(
      LOGIN_LINK_INVALID_NOTICE,
    );
  });

  // req-023
  it("erklaert einen abgelaufenen oder verbrauchten Zugangslink", () => {
    render(<AnmeldeView weiter="/go" fehler="einladung" />);

    expect(screen.getByRole("alert")).toHaveTextContent(
      INVITATION_INVALID_NOTICE,
    );
  });

  // req-023: die Sitzung endet, sobald jemand keiner freigegebenen Reise
  // mehr zugeordnet ist -- die Anmeldeseite nennt den Grund.
  it("nennt den Grund, wenn die Person keiner laufenden Reise zugeordnet ist", () => {
    render(<AnmeldeView weiter="/go" fehler="keine-reise" />);

    expect(screen.getByRole("alert")).toHaveTextContent(NO_ACTIVE_TRIP_NOTICE);
  });
});

describe("Die Entsperrung kommt von selbst (req-037)", () => {
  it("startet die Anmeldung beim Oeffnen, ohne dass jemand einen Knopf drueckt", async () => {
    const fetchMock = browserMitPasskey();
    const navigate = vi.fn();

    render(<AnmeldeView weiter="/go" navigate={navigate} />);

    await waitFor(() =>
      expect(webauthn.startAuthentication).toHaveBeenCalledWith(
        expect.objectContaining({ useBrowserAutofill: true }),
      ),
    );
    await waitFor(() => expect(navigate).toHaveBeenCalledWith("/go"));
    expect(fetchMock).toHaveBeenCalledWith(PASSKEY_LOGIN_API);
  });

  it("traegt am Anmeldefeld die Kennzeichnung, die der Browser dafuer braucht", () => {
    render(<AnmeldeView weiter="/go" />);

    expect(screen.getByLabelText("E-Mail-Adresse")).toHaveAttribute(
      "autocomplete",
      "username webauthn",
    );
  });

  it("startet nichts, wenn der Browser kein Conditional UI kann", async () => {
    webauthn.unterstuetzt = true;
    webauthn.autofill = false;
    stubFetch(() => ({ ok: true, body: {} }));

    render(<AnmeldeView weiter="/go" />);

    await waitFor(() =>
      expect(webauthn.startAuthentication).not.toHaveBeenCalled(),
    );
    // Stattdessen fuehrt der Knopf zum selben Ziel.
    expect(
      screen.getByRole("button", { name: "Mit Passkey anmelden" }),
    ).toBeEnabled();
  });

  it("bleibt still, wenn niemand die Entsperrung beantwortet", async () => {
    webauthn.unterstuetzt = true;
    webauthn.autofill = true;
    webauthn.startAuthentication.mockRejectedValue(new Error("abgebrochen"));
    stubFetch(() => ({ ok: true, body: { challenge: "aufforderung" } }));

    render(<AnmeldeView weiter="/go" />);

    await waitFor(() =>
      expect(webauthn.startAuthentication).toHaveBeenCalled(),
    );
    // Wer nur seine Adresse eintippen will, hat nichts falsch gemacht.
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("meldet ueber den Rueckfallknopf zum selben Ziel an", async () => {
    const user = userEvent.setup();
    webauthn.unterstuetzt = true;
    webauthn.autofill = false;
    webauthn.startAuthentication.mockResolvedValue({ id: "cred-iphone" });
    stubFetch((url) =>
      url === PASSKEY_LOGIN_API
        ? { ok: true, body: { challenge: "aufforderung", weiter: "/go" } }
        : { ok: true, body: {} },
    );
    const navigate = vi.fn();

    render(<AnmeldeView weiter="/go" navigate={navigate} />);
    await user.click(
      screen.getByRole("button", { name: "Mit Passkey anmelden" }),
    );

    await waitFor(() => expect(navigate).toHaveBeenCalledWith("/go"));
  });

  it("nennt den Grund, wenn die Anmeldung per Knopf scheitert", async () => {
    const user = userEvent.setup();
    webauthn.unterstuetzt = true;
    webauthn.startAuthentication.mockRejectedValue(new Error("abgelehnt"));
    stubFetch(() => ({ ok: true, body: { challenge: "aufforderung" } }));

    render(<AnmeldeView weiter="/go" />);
    await user.click(
      screen.getByRole("button", { name: "Mit Passkey anmelden" }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      PASSKEY_FAILED_NOTICE,
    );
  });
});

describe("Anderes Geraet verwenden (req-037)", () => {
  it("laesst den Browser den QR-Code des Cross-Device-Flows zeigen", async () => {
    const user = userEvent.setup();
    webauthn.unterstuetzt = true;
    webauthn.startAuthentication.mockResolvedValue({ id: "cred-handy" });
    stubFetch((url) =>
      url === PASSKEY_LOGIN_API
        ? { ok: true, body: { challenge: "aufforderung", weiter: "/go" } }
        : { ok: true, body: {} },
    );
    const navigate = vi.fn();

    render(<AnmeldeView weiter="/go" navigate={navigate} />);
    await user.click(
      screen.getByRole("button", { name: "Anderes Gerät verwenden" }),
    );

    // "hybrid" steuert den Browser auf das Handy statt auf dieses Geraet.
    await waitFor(() =>
      expect(webauthn.startAuthentication).toHaveBeenCalledWith({
        optionsJSON: expect.objectContaining({ hints: ["hybrid"] }),
      }),
    );
    await waitFor(() => expect(navigate).toHaveBeenCalledWith("/go"));
  });
});

describe("Ersteinrichtung starten (req-037)", () => {
  it("zeigt den Weg, solange die Umgebung niemanden kennt", () => {
    render(<AnmeldeView weiter="/go" ersteinrichtung />);

    expect(
      screen.getByRole("link", { name: "Ersteinrichtung starten" }),
    ).toHaveAttribute("href", SETUP_PATH);
  });

  it("zeigt ihn nicht mehr, sobald ein Teilnehmer existiert", () => {
    render(<AnmeldeView weiter="/go" />);

    expect(screen.queryByText("Ersteinrichtung starten")).toBeNull();
  });
});
