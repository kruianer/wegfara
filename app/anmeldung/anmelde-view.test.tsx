import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  INVITATION_INVALID_NOTICE,
  LOGIN_LINK_INVALID_NOTICE,
  LOGIN_LINK_NOTICE,
  NO_ACTIVE_TRIP_NOTICE,
} from "@/lib/auth/messages";
import { PASSKEY_LOGIN_API, SETUP_PATH } from "@/lib/auth/paths";
import { PASSKEY_GRUND, passkeyGrundText } from "@/lib/auth/passkey-fehler";
import { PASSKEY_MERKER } from "@/lib/auth/geraete-merker";
import { GESTE_GRENZE_MS } from "@/lib/auth/entsperrung";
import { AnmeldeView } from "./anmelde-view";

/**
 * jsdom kennt keine Passkeys. Damit sich auch ein Browser nachstellen
 * laesst, der sie beherrscht, laeuft die Bibliothek hier ueber diese
 * Schalter.
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

/**
 * Ein Geraet, auf dem schon einmal ein Passkey benutzt wurde (req-066) --
 * nur dann startet die Anmeldeseite die Entsperrung von selbst.
 */
function geraetMitPasskey() {
  localStorage.setItem(PASSKEY_MERKER, "ja");
}

/** Ein Browser mit Passkey, der die Entsperrung annimmt. */
function browserMitPasskey(antwort: unknown = { id: "cred-iphone" }) {
  webauthn.unterstuetzt = true;
  geraetMitPasskey();
  webauthn.startAuthentication.mockResolvedValue(antwort);
  return stubFetch((url) =>
    url === PASSKEY_LOGIN_API
      ? { ok: true, body: { challenge: "aufforderung", weiter: "/go" } }
      : { ok: true, body: { notice: LOGIN_LINK_NOTICE } },
  );
}

/** So weist ein Browser eine Abfrage ab -- abgebrochen wie verweigert. */
function nichtErlaubt() {
  const fehler = new Error("nicht erlaubt");
  fehler.name = "NotAllowedError";
  return fehler;
}

beforeEach(() => {
  webauthn.unterstuetzt = false;
  webauthn.autofill = false;
  webauthn.startAuthentication.mockReset();
  localStorage.clear();
});

describe("Der Anmeldedialog traegt genau einen Weg (req-066)", () => {
  it('zeigt "Zugang verloren" und sonst keinen Anmeldeweg', () => {
    render(<AnmeldeView weiter="/go" />);

    expect(
      screen.getByRole("button", { name: "Zugang verloren" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Mit Passkey anmelden" }),
    ).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Anderes Gerät verwenden" }),
    ).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Notfallcode verwenden" }),
    ).toBeNull();
  });

  it("zeigt das E-Mail-Feld erst dahinter", async () => {
    const user = userEvent.setup();
    render(<AnmeldeView weiter="/go" />);

    expect(screen.queryByLabelText("E-Mail-Adresse")).toBeNull();

    await user.click(screen.getByRole("button", { name: "Zugang verloren" }));

    expect(screen.getByLabelText("E-Mail-Adresse")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Anmeldelink senden" }),
    ).toBeInTheDocument();
  });

  it("sagt, dass der Link ins hinterlegte Postfach geht", async () => {
    const user = userEvent.setup();
    render(<AnmeldeView weiter="/go" />);

    await user.click(screen.getByRole("button", { name: "Zugang verloren" }));

    // Wer eine fremde Adresse eintraegt, soll wissen, dass ihm das nichts
    // bringt -- der Link landet im fremden Postfach (req-066).
    expect(
      screen.getByText(/nicht an dieses Gerät|Adresse einer anderen Person/),
    ).toBeInTheDocument();
  });
});

describe("AnmeldeView (req-016)", () => {
  /** Der Weg zum E-Mail-Feld -- es steht hinter "Zugang verloren". */
  async function zugangVerloren(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByRole("button", { name: "Zugang verloren" }));
  }

  it("meldet nach dem Anfordern des Anmeldelinks den Versand", async () => {
    const user = userEvent.setup();
    const fetchMock = stubFetch(() => ({
      ok: true,
      body: { notice: LOGIN_LINK_NOTICE },
    }));
    render(<AnmeldeView weiter="/go" />);

    await zugangVerloren(user);
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
    await zugangVerloren(user);
    await user.type(screen.getByLabelText("E-Mail-Adresse"), "uwe@kremmel.org");
    await user.click(
      screen.getByRole("button", { name: "Anmeldelink senden" }),
    );
    const bekannt = (await screen.findByRole("status")).textContent;
    unmount();

    render(<AnmeldeView weiter="/go" />);
    await zugangVerloren(user);
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

  it("meldet niemanden an, wer eine fremde Adresse eintraegt (req-066)", async () => {
    const user = userEvent.setup();
    stubFetch(() => ({ ok: true, body: { notice: LOGIN_LINK_NOTICE } }));
    const navigate = vi.fn();
    render(<AnmeldeView weiter="/go" navigate={navigate} />);

    await zugangVerloren(user);
    await user.type(
      screen.getByLabelText("E-Mail-Adresse"),
      "fremde@person.example",
    );
    await user.click(
      screen.getByRole("button", { name: "Anmeldelink senden" }),
    );

    // Der Link geht ins fremde Postfach; hier passiert nichts weiter.
    expect(await screen.findByRole("status")).toHaveTextContent(
      LOGIN_LINK_NOTICE,
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

describe("Beim Oeffnen sofort Face ID (req-066)", () => {
  it("startet die Entsperrung beim Oeffnen, ohne dass jemand etwas antippt", async () => {
    const fetchMock = browserMitPasskey();
    const navigate = vi.fn();

    render(<AnmeldeView weiter="/go" navigate={navigate} />);

    await waitFor(() =>
      expect(webauthn.startAuthentication).toHaveBeenCalledWith({
        optionsJSON: expect.objectContaining({ challenge: "aufforderung" }),
      }),
    );
    // Angemeldet, ohne dass ein weiterer Knopf gedrueckt wurde.
    await waitFor(() => expect(navigate).toHaveBeenCalledWith("/go"));
    expect(fetchMock).toHaveBeenCalledWith(PASSKEY_LOGIN_API);
  });

  it("zeigt kein Formular, solange die Entsperrung laeuft", async () => {
    webauthn.unterstuetzt = true;
    geraetMitPasskey();
    // Die Abfrage steht offen -- sie wird weder beantwortet noch abgelehnt.
    webauthn.startAuthentication.mockReturnValue(new Promise(() => {}));
    stubFetch(() => ({ ok: true, body: { challenge: "aufforderung" } }));

    render(<AnmeldeView weiter="/go" />);

    await waitFor(() =>
      expect(webauthn.startAuthentication).toHaveBeenCalled(),
    );
    expect(screen.queryByLabelText("E-Mail-Adresse")).toBeNull();
    expect(screen.queryByRole("textbox")).toBeNull();
    // Genau eine Flaeche -- und sonst nichts.
    expect(screen.getAllByRole("button")).toHaveLength(1);
  });

  it("merkt sich den Passkey dieses Geraets", async () => {
    localStorage.clear();
    webauthn.unterstuetzt = true;
    geraetMitPasskey();
    webauthn.startAuthentication.mockResolvedValue({ id: "cred-iphone" });
    stubFetch(() => ({
      ok: true,
      body: { challenge: "aufforderung", weiter: "/go" },
    }));
    const navigate = vi.fn();

    render(<AnmeldeView weiter="/go" navigate={navigate} />);

    await waitFor(() => expect(navigate).toHaveBeenCalledWith("/go"));
    expect(localStorage.getItem(PASSKEY_MERKER)).toBe("ja");
  });
});

describe("Verlangt der Browser eine Geste (req-066)", () => {
  it("laesst genau eine Flaeche stehen statt eines Formulars", async () => {
    webauthn.unterstuetzt = true;
    geraetMitPasskey();
    // Safari weist den Aufruf ohne Geste sofort ab.
    webauthn.startAuthentication.mockRejectedValue(nichtErlaubt());
    stubFetch(() => ({ ok: true, body: { challenge: "aufforderung" } }));

    render(<AnmeldeView weiter="/go" />);

    await waitFor(() =>
      expect(webauthn.startAuthentication).toHaveBeenCalled(),
    );
    expect(screen.getByRole("button", { name: "Entsperren" })).toBeEnabled();
    expect(screen.queryByLabelText("E-Mail-Adresse")).toBeNull();
    // Wer nichts angetippt hat, hat auch nichts falsch gemacht.
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("meldet nach einem Tap auf die Flaeche an", async () => {
    const user = userEvent.setup();
    webauthn.unterstuetzt = true;
    geraetMitPasskey();
    webauthn.startAuthentication.mockRejectedValueOnce(nichtErlaubt());
    webauthn.startAuthentication.mockResolvedValue({ id: "cred-iphone" });
    stubFetch(() => ({
      ok: true,
      body: { challenge: "aufforderung", weiter: "/go" },
    }));
    const navigate = vi.fn();

    render(<AnmeldeView weiter="/go" navigate={navigate} />);
    await user.click(screen.getByRole("button", { name: "Entsperren" }));

    await waitFor(() => expect(navigate).toHaveBeenCalledWith("/go"));
  });
});

describe("Scheitert die Entsperrung (req-066)", () => {
  it("zeigt den Anmeldedialog, wenn der Nutzer abbricht", async () => {
    webauthn.unterstuetzt = true;
    geraetMitPasskey();
    // Ein Abbruch durch den Nutzer kommt mit demselben Fehlernamen zurueck
    // wie eine verweigerte Abfrage -- nur eben nicht sofort.
    webauthn.startAuthentication.mockImplementation(async () => {
      await new Promise((fertig) => setTimeout(fertig, GESTE_GRENZE_MS + 50));
      throw nichtErlaubt();
    });
    stubFetch(() => ({ ok: true, body: { challenge: "aufforderung" } }));

    render(<AnmeldeView weiter="/go" />);

    expect(
      await screen.findByRole("button", { name: "Zugang verloren" }),
    ).toBeInTheDocument();
    // Der Grund steht da -- nicht ein Satz, der fuer jeden Grund derselbe
    // ist (req-066).
    expect(screen.getByRole("alert")).toHaveTextContent(/abgebrochen/);
  });

  it("zeigt den Anmeldedialog, wenn die Entsperrung niemanden erkennt", async () => {
    webauthn.unterstuetzt = true;
    geraetMitPasskey();
    webauthn.startAuthentication.mockResolvedValue({ id: "cred-fremd" });
    // Der Server weist die Antwort ab: dieser Passkey gehoert zu niemandem.
    stubFetch((url, init) =>
      url === PASSKEY_LOGIN_API && init?.method === "POST"
        ? {
            ok: false,
            body: {
              grund: PASSKEY_GRUND.passkeyUnbekannt,
              error: passkeyGrundText(
                PASSKEY_GRUND.passkeyUnbekannt,
                "anmelden",
              ),
            },
          }
        : { ok: true, body: { challenge: "aufforderung" } },
    );

    render(<AnmeldeView weiter="/go" />);

    expect(
      await screen.findByRole("button", { name: "Zugang verloren" }),
    ).toBeInTheDocument();
    // Der Server nennt den Schritt, und genau der steht auf dem Schirm.
    expect(screen.getByRole("alert")).toHaveTextContent(
      passkeyGrundText(PASSKEY_GRUND.passkeyUnbekannt, "anmelden"),
    );
  });
});

describe("Ohne Passkey auf diesem Geraet (req-066)", () => {
  it("zeigt den Anmeldedialog ohne vergebliche Entsperrung", async () => {
    webauthn.unterstuetzt = true;
    // Kein Merker: auf diesem Geraet wurde noch nie ein Passkey benutzt.
    stubFetch(() => ({ ok: true, body: { notice: LOGIN_LINK_NOTICE } }));

    render(<AnmeldeView weiter="/go" />);

    expect(
      screen.getByRole("button", { name: "Zugang verloren" }),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(webauthn.startAuthentication).not.toHaveBeenCalled(),
    );
  });

  it("zeigt den Anmeldedialog, wenn der Browser keine Passkeys kennt", async () => {
    geraetMitPasskey();
    stubFetch(() => ({ ok: true, body: { notice: LOGIN_LINK_NOTICE } }));

    render(<AnmeldeView weiter="/go" />);

    expect(
      screen.getByRole("button", { name: "Zugang verloren" }),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(webauthn.startAuthentication).not.toHaveBeenCalled(),
    );
  });

  it("zeigt den Anmeldedialog, wenn die Seite mit einem Grund aufgerufen wurde", async () => {
    webauthn.unterstuetzt = true;
    geraetMitPasskey();
    stubFetch(() => ({ ok: true, body: { notice: LOGIN_LINK_NOTICE } }));

    render(<AnmeldeView weiter="/go" fehler="keine-reise" />);

    // Der Grund gehoert gelesen, nicht von einer Abfrage ueberdeckt.
    expect(screen.getByRole("alert")).toHaveTextContent(NO_ACTIVE_TRIP_NOTICE);
    await waitFor(() =>
      expect(webauthn.startAuthentication).not.toHaveBeenCalled(),
    );
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
