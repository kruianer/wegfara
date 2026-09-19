import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PASSKEY_REGISTRATION_API } from "@/lib/auth/paths";
import { PASSKEY_MERKER } from "@/lib/auth/geraete-merker";
import { EinladungPasskeyView } from "./einladung-passkey-view";

/**
 * jsdom kennt keine Passkeys. Damit sich auch ein Windows-Laptop und ein
 * iPhone nachstellen lassen, laeuft die Bibliothek hier ueber diese
 * Schalter.
 */
const webauthn = vi.hoisted(() => ({
  unterstuetzt: false,
  startRegistration: vi.fn(),
}));

vi.mock("@simplewebauthn/browser", () => ({
  browserSupportsWebAuthn: () => webauthn.unterstuetzt,
  startRegistration: (...args: unknown[]) =>
    webauthn.startRegistration(...args),
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

/**
 * Ein Geraet, das die Aufforderung annimmt -- ob per Windows Hello, Face
 * ID oder Fingerabdruck, macht fuer die Anwendung keinen Unterschied: es
 * ist immer derselbe WebAuthn-Aufruf.
 */
function geraetMitEntsperrung() {
  webauthn.unterstuetzt = true;
  webauthn.startRegistration.mockResolvedValue({ id: "cred-neu" });
  return stubFetch(() => ({
    ok: true,
    body: { challenge: "aufforderung", status: "ok" },
  }));
}

beforeEach(() => {
  webauthn.unterstuetzt = false;
  webauthn.startRegistration.mockReset();
  localStorage.clear();
});

describe("Die Einladung legt sofort einen Passkey an (req-066)", () => {
  it("richtet ihn auf einem Windows-Laptop ohne Knopfdruck ein", async () => {
    const fetchMock = geraetMitEntsperrung();
    const navigate = vi.fn();

    render(
      <EinladungPasskeyView name="Clara Berger" hatEmail navigate={navigate} />,
    );

    await waitFor(() => expect(webauthn.startRegistration).toHaveBeenCalled());
    // Danach ist sie angemeldet und in der App.
    await waitFor(() => expect(navigate).toHaveBeenCalledWith("/"));
    expect(fetchMock).toHaveBeenCalledWith(PASSKEY_REGISTRATION_API);
  });

  it("richtet ihn auf dem iPhone ohne Knopfdruck ein", async () => {
    // Derselbe Weg -- die Anwendung schreibt nirgends vor, welches Geraet
    // die Entsperrung leistet.
    geraetMitEntsperrung();
    const navigate = vi.fn();

    render(
      <EinladungPasskeyView
        name="Clara Berger"
        hatEmail={false}
        navigate={navigate}
      />,
    );

    await waitFor(() => expect(navigate).toHaveBeenCalledWith("/"));
  });

  it("merkt sich den Passkey dieses Geraets", async () => {
    geraetMitEntsperrung();
    const navigate = vi.fn();

    render(
      <EinladungPasskeyView name="Clara Berger" hatEmail navigate={navigate} />,
    );

    await waitFor(() => expect(navigate).toHaveBeenCalledWith("/"));
    expect(localStorage.getItem(PASSKEY_MERKER)).toBe("ja");
  });

  it("zeigt kein Formular, solange das Einrichten laeuft", async () => {
    webauthn.unterstuetzt = true;
    webauthn.startRegistration.mockReturnValue(new Promise(() => {}));
    stubFetch(() => ({ ok: true, body: { challenge: "aufforderung" } }));

    render(<EinladungPasskeyView name="Clara Berger" hatEmail />);

    await waitFor(() => expect(webauthn.startRegistration).toHaveBeenCalled());
    expect(screen.getAllByRole("button")).toHaveLength(1);
  });

  it("nennt den Grund, wenn das Einrichten scheitert", async () => {
    webauthn.unterstuetzt = true;
    webauthn.startRegistration.mockRejectedValue(new Error("abgewiesen"));
    stubFetch(() => ({ ok: true, body: { challenge: "aufforderung" } }));

    render(<EinladungPasskeyView name="Clara Berger" hatEmail />);

    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Später einrichten" }),
    ).toBeInTheDocument();
  });
});

describe("EinladungPasskeyView (req-023)", () => {
  // jsdom kennt keine Passkeys — genau wie ein Geraet ohne Unterstuetzung.
  it("fordert die eingeladene Person auf, einen Passkey einzurichten", () => {
    render(<EinladungPasskeyView name="Clara Berger" hatEmail={false} />);

    expect(
      screen.getByRole("heading", { name: "Willkommen, Clara Berger" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Passkey einrichten" }),
    ).toBeInTheDocument();
  });

  it("verweist mit hinterlegter Adresse auf den Anmeldelink", () => {
    render(<EinladungPasskeyView name="Clara Berger" hatEmail />);

    expect(screen.getByText(/Anmeldelink an deine E-Mail/)).toBeInTheDocument();
  });

  it("verweist ohne Adresse auf den Reiseleiter", () => {
    render(<EinladungPasskeyView name="Max Gast" hatEmail={false} />);

    expect(
      screen.getByText(/wende dich an den Reiseleiter/),
    ).toBeInTheDocument();
  });

  it("laesst das Einrichten auf spaeter verschieben", async () => {
    const navigate = vi.fn();
    render(
      <EinladungPasskeyView
        name="Clara Berger"
        hatEmail={false}
        navigate={navigate}
      />,
    );

    await userEvent.click(
      screen.getByRole("button", { name: "Später einrichten" }),
    );

    expect(navigate).toHaveBeenCalledWith("/");
  });
});
