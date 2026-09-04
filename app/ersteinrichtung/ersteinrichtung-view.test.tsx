import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PASSKEY_SETUP_FAILED_NOTICE } from "@/lib/auth/messages";
import { LOGIN_PATH, SETUP_API } from "@/lib/auth/paths";
import { ErsteinrichtungView } from "./ersteinrichtung-view";

const webauthn = vi.hoisted(() => ({
  unterstuetzt: false,
  startRegistration: vi.fn(),
}));

vi.mock("@simplewebauthn/browser", () => ({
  browserSupportsWebAuthn: () => webauthn.unterstuetzt,
  startRegistration: (...args: unknown[]) =>
    webauthn.startRegistration(...args),
}));

function stubFetch(body: unknown, ok = true) {
  const fetchMock = vi.fn(
    async () => ({ ok, json: async () => body }) as Response,
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

beforeEach(() => {
  webauthn.unterstuetzt = false;
  webauthn.startRegistration.mockReset();
});

describe("ErsteinrichtungView (req-037)", () => {
  it("nennt die Adresse, unter der der Betreiber hinterlegt wird", () => {
    render(<ErsteinrichtungView email="uwe@kremmel.org" />);

    // Der Wiederherstellungsweg steht damit ab der ersten Minute.
    expect(screen.getByText(/uwe@kremmel.org/)).toBeInTheDocument();
  });

  it("richtet den ersten Passkey ein und ist danach angemeldet", async () => {
    const user = userEvent.setup();
    webauthn.unterstuetzt = true;
    webauthn.startRegistration.mockResolvedValue({ id: "cred-1" });
    const fetchMock = stubFetch({ weiter: "/" });
    const navigate = vi.fn();

    render(<ErsteinrichtungView email="uwe@kremmel.org" navigate={navigate} />);
    await user.click(
      screen.getByRole("button", { name: "Passkey einrichten" }),
    );

    expect(fetchMock).toHaveBeenCalledWith(SETUP_API);
    await waitFor(() => expect(navigate).toHaveBeenCalledWith("/"));
  });

  it("nennt den Grund, wenn die Einrichtung scheitert", async () => {
    const user = userEvent.setup();
    webauthn.unterstuetzt = true;
    webauthn.startRegistration.mockRejectedValue(new Error("abgebrochen"));
    stubFetch({});

    render(<ErsteinrichtungView email="uwe@kremmel.org" />);
    await user.click(
      screen.getByRole("button", { name: "Passkey einrichten" }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      PASSKEY_SETUP_FAILED_NOTICE,
    );
  });

  it("weist auf ein Geraet ohne Passkey-Faehigkeit hin", () => {
    render(<ErsteinrichtungView email="uwe@kremmel.org" />);

    expect(
      screen.getByRole("button", { name: "Passkey einrichten" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("link", { name: "Zurück zur Anmeldung" }),
    ).toHaveAttribute("href", LOGIN_PATH);
  });
});
