import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  DEVICES_API,
  LOGOUT_ALL_API,
  LOGOUT_API,
  RECOVERY_CODES_API,
} from "@/lib/auth/paths";
import { PASSKEY_REMOVAL_MESSAGE } from "@/lib/auth/devices";
import type { Participant } from "@/lib/participants/types";
import { MeinBereichView, type PasskeyInfo } from "./mein-bereich-view";

/**
 * jsdom kennt keine Passkeys. Damit sich auch ein Geraet nachstellen laesst,
 * das sie beherrscht, laeuft die Bibliothek hier ueber diesen Schalter.
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

const IPHONE: PasskeyInfo = {
  id: "cred-iphone",
  label: "iPhone",
  hinzugefuegtAm: "16.08.2026",
  zuletztVerwendet: "04.09.2026",
};

const IPAD: PasskeyInfo = {
  id: "cred-ipad",
  label: "iPad",
  hinzugefuegtAm: "20.08.2026",
  zuletztVerwendet: null,
};

const UWE: Participant = {
  id: "5e0cd230-3765-425b-be49-6a95028ba0b8",
  accountId: "eb873b95-257b-49c6-b08f-1709d6ad3b94",
  name: "Uwe Kremmel",
  nickname: null,
  email: "uwe@kremmel.org",
  phone: null,
  iban: null,
  loginEnabled: true,
  accountAdmin: true,
};

function stubFetch(body: unknown = { status: "ok" }, ok = true) {
  const fetchMock = vi.fn<
    (url: string, init?: RequestInit) => Promise<Response>
  >(async () => ({ ok, json: async () => body }) as Response);
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

beforeEach(() => {
  webauthn.unterstuetzt = false;
  webauthn.startRegistration.mockReset();
});

describe("Mein Bereich -- Konto (req-016)", () => {
  it("zeigt die Zahl der noch unverbrauchten Notfallcodes", () => {
    render(
      <MeinBereichView
        email="uwe@kremmel.org"
        passkeys={[]}
        offeneNotfallcodes={5}
      />,
    );

    expect(
      screen.getByText("Noch nicht verbraucht: 5 von 8."),
    ).toBeInTheDocument();
  });

  it("sagt, wenn noch kein Passkey hinterlegt ist", () => {
    render(
      <MeinBereichView
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
      <MeinBereichView
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
      <MeinBereichView
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
      <MeinBereichView
        email="uwe@kremmel.org"
        passkeys={[]}
        offeneNotfallcodes={8}
      />,
    );

    expect(
      screen.getByRole("button", { name: "Dieses Gerät hinzufügen" }),
    ).toBeDisabled();
  });

  // req-023: Teilnehmer erhalten keine Notfallcodes -- sie haben immer
  // jemanden, der sie mit einer neuen Einladung wieder hereinholt.
  it("zeigt einem Teilnehmer keine Notfallcodes (req-023)", () => {
    render(
      <MeinBereichView
        email={null}
        passkeys={[]}
        offeneNotfallcodes={0}
        notfallcodesVerfuegbar={false}
      />,
    );

    expect(screen.queryByRole("region", { name: "Notfallcodes" })).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Neuen Satz erzeugen" }),
    ).toBeNull();
    // Geraete und Abmelden bleiben ihm.
    expect(
      screen.getByRole("button", { name: "Dieses Gerät hinzufügen" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Abmelden" }),
    ).toBeInTheDocument();
  });
});

describe("Meine Geraete (req-037)", () => {
  it("zeigt je Passkey Name, Hinzugefuegt-am und Zuletzt-verwendet", () => {
    render(
      <MeinBereichView
        email="uwe@kremmel.org"
        passkeys={[IPHONE, IPAD]}
        offeneNotfallcodes={8}
      />,
    );

    expect(screen.getByText("iPhone")).toBeInTheDocument();
    expect(screen.getByText("Hinzugefügt am 16.08.2026")).toBeInTheDocument();
    expect(
      screen.getByText("Zuletzt verwendet am 04.09.2026"),
    ).toBeInTheDocument();

    expect(screen.getByText("iPad")).toBeInTheDocument();
    expect(screen.getByText("Hinzugefügt am 20.08.2026")).toBeInTheDocument();
    // Ein Geraet, mit dem noch keine Anmeldung gelaufen ist.
    expect(screen.getByText("Zuletzt verwendet: noch nie")).toBeInTheDocument();
  });

  it("entfernt ein Geraet und nimmt es aus der Liste", async () => {
    const user = userEvent.setup();
    const fetchMock = stubFetch({ status: "entfernt", id: IPAD.id });
    render(
      <MeinBereichView
        email="uwe@kremmel.org"
        passkeys={[IPHONE, IPAD]}
        offeneNotfallcodes={8}
      />,
    );

    await user.click(screen.getByRole("button", { name: "iPad entfernen" }));

    const [url, init] = fetchMock.mock.calls.at(-1)!;
    expect(url).toBe(DEVICES_API);
    expect(init?.method).toBe("DELETE");
    expect(JSON.parse(String(init?.body))).toEqual({ id: IPAD.id });
    await waitFor(() => expect(screen.queryByText("iPad")).toBeNull());
    expect(screen.getByText("iPhone")).toBeInTheDocument();
  });

  it("nennt den Grund, wenn der letzte Passkey nicht entfernt werden darf", async () => {
    const user = userEvent.setup();
    stubFetch({ error: PASSKEY_REMOVAL_MESSAGE.letzterOhneAdresse }, false);
    render(
      <MeinBereichView
        email={null}
        passkeys={[IPHONE]}
        offeneNotfallcodes={8}
      />,
    );

    await user.click(screen.getByRole("button", { name: "iPhone entfernen" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      PASSKEY_REMOVAL_MESSAGE.letzterOhneAdresse,
    );
    // Das Geraet bleibt in der Liste -- entfernt wurde nichts.
    expect(screen.getByText("iPhone")).toBeInTheDocument();
  });

  /**
   * req-043: wer nur das Smartphone dabei hat, richtet hier seinen Passkey
   * ein -- deshalb ist "Mein Bereich" auch aus dem Begleiter erreichbar.
   */
  it("fuegt dieses Geraet hinzu und reiht es ein", async () => {
    const user = userEvent.setup();
    webauthn.unterstuetzt = true;
    webauthn.startRegistration.mockResolvedValue({ id: "cred-windows" });
    stubFetch({ bezeichnung: "Passkey", hinzugefuegtAm: "04.09.2026" });
    render(
      <MeinBereichView
        email="uwe@kremmel.org"
        passkeys={[IPHONE]}
        offeneNotfallcodes={8}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: "Dieses Gerät hinzufügen" }),
    );

    // Danach lassen sich beide Geraete verwenden -- iPhone und Windows-PC.
    expect(await screen.findByText("Passkey")).toBeInTheDocument();
    expect(screen.getByText("iPhone")).toBeInTheDocument();
    expect(screen.getByText("Hinzugefügt am 04.09.2026")).toBeInTheDocument();
  });

  it("meldet ueberall ab und laesst die Passkeys stehen", async () => {
    const user = userEvent.setup();
    const fetchMock = stubFetch();
    const navigate = vi.fn();
    render(
      <MeinBereichView
        email="uwe@kremmel.org"
        passkeys={[IPHONE, IPAD]}
        offeneNotfallcodes={8}
        navigate={navigate}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Überall abmelden" }));

    expect(fetchMock).toHaveBeenCalledWith(LOGOUT_ALL_API, { method: "POST" });
    await waitFor(() => expect(navigate).toHaveBeenCalledWith("/"));
  });

  it("sagt, dass Ueberall abmelden auch dieses Geraet trifft", () => {
    render(
      <MeinBereichView
        email="uwe@kremmel.org"
        passkeys={[IPHONE]}
        offeneNotfallcodes={8}
      />,
    );

    expect(screen.getByText(/auch die hier/)).toBeInTheDocument();
    expect(screen.getByText(/Passkeys bleiben bestehen/)).toBeInTheDocument();
  });

  it("führt „Überall abmelden“ in der Karte „Meine Geräte“ (req-043)", () => {
    render(
      <MeinBereichView
        email="uwe@kremmel.org"
        passkeys={[IPHONE]}
        offeneNotfallcodes={8}
      />,
    );

    const karte = screen.getByRole("region", { name: "Meine Geräte" });
    expect(
      within(karte).getByRole("button", { name: "Überall abmelden" }),
    ).toBeInTheDocument();
  });
});

/**
 * "Mein Bereich" (req-043) fuehrt zusammen, was bis dahin auf "Konto",
 * "Account" und "Nutzer" verteilt war. Hier zaehlt, welche Karten
 * erscheinen -- und wem.
 */
describe("Mein Bereich -- die Karten (req-043)", () => {
  function karten(): (string | null)[] {
    return screen
      .getAllByRole("region")
      .map((bereich) => bereich.getAttribute("aria-label"));
  }

  function zeige(accountAdmin: boolean, notfallcodesVerfuegbar = false) {
    render(
      <MeinBereichView
        email="uwe@kremmel.org"
        passkeys={[IPHONE]}
        offeneNotfallcodes={8}
        notfallcodesVerfuegbar={notfallcodesVerfuegbar}
        accountAdmin={accountAdmin}
        participants={[UWE]}
        selfParticipantId={UWE.id}
        invitations={[]}
        apiKeys={[
          { kind: "ki_suche", lastFour: null },
          { kind: "google", lastFour: null },
        ]}
      />,
    );
  }

  it("zeigt dem Bereichs-Admin die Karten untereinander", () => {
    zeige(true);

    expect(karten()).toEqual([
      "Meine Geräte",
      "Personen",
      "Einladungen",
      "Zugangsschlüssel",
    ]);
  });

  it("stellt dem Reiseleiter die Notfallcodes dazwischen", () => {
    zeige(true, true);

    expect(karten()).toEqual([
      "Meine Geräte",
      "Notfallcodes",
      "Personen",
      "Einladungen",
      "Zugangsschlüssel",
    ]);
  });

  it("zeigt einem Teilnehmer ohne Kennzeichnung ausschließlich „Meine Geräte“", () => {
    zeige(false);

    expect(karten()).toEqual(["Meine Geräte"]);
  });

  it("zeigt einem Reiseleiter ohne Kennzeichnung nur Geräte und Notfallcodes", () => {
    zeige(false, true);

    expect(karten()).toEqual(["Meine Geräte", "Notfallcodes"]);
  });

  it("heißt „Mein Bereich“", () => {
    zeige(true);

    expect(
      screen.getByRole("heading", { name: "Mein Bereich", level: 1 }),
    ).toBeInTheDocument();
  });
});

/**
 * Der Zugangsschluessel wird nach dem Speichern nie wieder ausgegeben --
 * sichtbar sind nur sein Zustand und seine letzten vier Zeichen (req-028).
 */
describe("Mein Bereich -- Zugangsschlüssel (req-028, req-043)", () => {
  it("zeigt nach dem Setzen die letzten vier Zeichen", async () => {
    const user = userEvent.setup();
    stubFetch({
      keys: [
        { kind: "ki_suche", lastFour: "a3f9" },
        { kind: "google", lastFour: null },
      ],
    });
    render(
      <MeinBereichView
        email="uwe@kremmel.org"
        passkeys={[]}
        offeneNotfallcodes={8}
        notfallcodesVerfuegbar={false}
        accountAdmin
        participants={[UWE]}
        selfParticipantId={UWE.id}
        apiKeys={[
          { kind: "ki_suche", lastFour: null },
          { kind: "google", lastFour: null },
        ]}
      />,
    );

    await user.click(screen.getAllByRole("button", { name: "Setzen" })[0]);
    await user.type(
      screen.getByLabelText("Zugangsschlüssel für KI-Suche"),
      "sk-test-a3f9",
    );
    await user.click(screen.getByRole("button", { name: "Speichern" }));

    expect(await screen.findByText("Gesetzt (…a3f9)")).toBeInTheDocument();
  });
});
