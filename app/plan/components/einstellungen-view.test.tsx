import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Participant } from "@/lib/participants/types";
import { PARTICIPANT_ERRORS } from "@/lib/participants/validate";
import { EinstellungenView } from "./einstellungen-view";

const UWE: Participant = {
  id: "5e0cd230-3765-425b-be49-6a95028ba0b8",
  accountId: "eb873b95-257b-49c6-b08f-1709d6ad3b94",
  name: "Uwe Kremmel",
  nickname: null,
  email: "uwe@kremmel.org",
  phone: null,
  iban: null,
  loginEnabled: true,
};

const CLARA: Participant = {
  id: "9b1c1e3a-6d0a-4f57-9a3f-2c2b7f5f1111",
  accountId: UWE.accountId,
  name: "Clara Berger",
  nickname: null,
  email: null,
  phone: "+43 664 1234567",
  iban: "AT611904300234573201",
  loginEnabled: false,
};

/** Dieselbe Person, wie der Reiseleiter sie anspricht (req-020). */
const CLARI: Participant = { ...CLARA, nickname: "Clari" };

/**
 * Die Schnittstelle antwortet wie app/api/participants/route.ts -- dort
 * wird sie gegen die echte Datenbank geprueft. Hier zaehlt, was die Karte
 * daraus macht.
 */
function antwortet(status: number, payload: unknown): ReturnType<typeof vi.fn> {
  return vi.fn(async () => ({
    ok: status < 400,
    status,
    json: async () => payload,
  }));
}

function zeige(participants: Participant[] = [UWE]) {
  render(
    <EinstellungenView
      participants={participants}
      selfParticipantId={UWE.id}
    />,
  );
}

function zeile(name: string): HTMLElement {
  return screen.getByText(name).closest("li") as HTMLElement;
}

async function fuelleFeld(label: RegExp | string, wert: string) {
  const feld = screen.getByLabelText(label);
  await userEvent.clear(feld);
  if (wert.length > 0) await userEvent.type(feld, wert);
}

beforeEach(() => {
  vi.stubGlobal("fetch", antwortet(500, {}));
});

describe("EinstellungenView (req-019)", () => {
  it('zeigt die Karte "Reiseteilnehmer"', () => {
    zeige();

    expect(
      screen.getByRole("heading", { name: /Reiseteilnehmer/ }),
    ).toBeInTheDocument();
  });

  it("nennt die Zahl der Personen", () => {
    zeige([UWE, CLARA]);

    expect(
      screen.getByRole("heading", { name: /Reiseteilnehmer/ }),
    ).toHaveTextContent("2 Personen");
  });

  it("zeigt den eigenen Eintrag", () => {
    zeige();

    expect(screen.getByText("Uwe Kremmel")).toBeInTheDocument();
    expect(zeile("Uwe Kremmel")).toHaveTextContent("uwe@kremmel.org");
  });

  it("kennzeichnet den eigenen Eintrag als eigene Person", () => {
    zeige([UWE, CLARA]);

    expect(zeile("Uwe Kremmel")).toHaveTextContent("Du");
    expect(zeile("Clara Berger")).not.toHaveTextContent("Du");
  });

  it("zeigt Telefonnummer und Bankverbindung je Person", () => {
    zeige([UWE, CLARA]);

    const clara = zeile("Clara Berger");
    expect(clara).toHaveTextContent("+43 664 1234567");
    expect(clara).toHaveTextContent("AT611904300234573201");
  });

  it("bietet beim eigenen Eintrag keine Möglichkeit zum Entfernen", () => {
    zeige([UWE, CLARA]);

    expect(
      within(zeile("Uwe Kremmel")).queryByRole("button", {
        name: /entfernen/i,
      }),
    ).toBeNull();
    expect(
      within(zeile("Clara Berger")).getByRole("button", { name: /entfernen/i }),
    ).toBeInTheDocument();
  });

  it("legt eine Person mit Telefonnummer und Bankverbindung an", async () => {
    const angelegt = { ...CLARA, email: null };
    vi.stubGlobal("fetch", antwortet(201, { participant: angelegt }));
    zeige();

    await userEvent.click(
      screen.getByRole("button", { name: "Teilnehmer hinzufügen" }),
    );
    await fuelleFeld("Name", "Clara Berger");
    await fuelleFeld("Telefonnummer", "+43 664 1234567");
    await fuelleFeld(/Bankverbindung/, "AT611904300234573201");
    await userEvent.click(screen.getByRole("button", { name: "Speichern" }));

    expect(await screen.findByText("Clara Berger")).toBeInTheDocument();
  });

  it("legt eine Person nur mit dem Namen an", async () => {
    const gast = {
      ...CLARA,
      name: "Max Gast",
      email: null,
      phone: null,
      iban: null,
    };
    vi.stubGlobal("fetch", antwortet(201, { participant: gast }));
    zeige();

    await userEvent.click(
      screen.getByRole("button", { name: "Teilnehmer hinzufügen" }),
    );
    await fuelleFeld("Name", "Max Gast");
    await userEvent.click(screen.getByRole("button", { name: "Speichern" }));

    expect(await screen.findByText("Max Gast")).toBeInTheDocument();
  });

  it("legt ohne Namen nichts an und benennt die Stelle", async () => {
    const fetchMock = antwortet(201, { participant: CLARA });
    vi.stubGlobal("fetch", fetchMock);
    zeige();

    await userEvent.click(
      screen.getByRole("button", { name: "Teilnehmer hinzufügen" }),
    );
    await fuelleFeld("Telefonnummer", "+43 664 1234567");
    await userEvent.click(screen.getByRole("button", { name: "Speichern" }));

    expect(
      await screen.findByText(PARTICIPANT_ERRORS.nameRequired),
    ).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.queryByText("Clara Berger")).toBeNull();
  });

  it("legt bei unzulässiger Bankverbindung nichts an", async () => {
    const fetchMock = antwortet(201, { participant: CLARA });
    vi.stubGlobal("fetch", fetchMock);
    zeige();

    await userEvent.click(
      screen.getByRole("button", { name: "Teilnehmer hinzufügen" }),
    );
    await fuelleFeld("Name", "Clara Berger");
    await fuelleFeld(/Bankverbindung/, "AT611904300234573200");
    await userEvent.click(screen.getByRole("button", { name: "Speichern" }));

    expect(
      await screen.findByText(PARTICIPANT_ERRORS.ibanInvalid),
    ).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("legt bei bereits vergebener Adresse nichts an", async () => {
    vi.stubGlobal(
      "fetch",
      antwortet(400, { errors: { email: PARTICIPANT_ERRORS.emailTaken } }),
    );
    zeige();

    await userEvent.click(
      screen.getByRole("button", { name: "Teilnehmer hinzufügen" }),
    );
    await fuelleFeld("Name", "Clara Berger");
    await fuelleFeld("E-Mail-Adresse", "uwe@kremmel.org");
    await userEvent.click(screen.getByRole("button", { name: "Speichern" }));

    expect(
      await screen.findByText(PARTICIPANT_ERRORS.emailTaken),
    ).toBeInTheDocument();
    expect(screen.queryByText("Clara Berger")).toBeNull();
  });

  it("ändert die Telefonnummer einer Person", async () => {
    vi.stubGlobal(
      "fetch",
      antwortet(200, {
        participant: { ...CLARA, phone: "+43 664 7654321" },
      }),
    );
    zeige([UWE, CLARA]);

    await userEvent.click(
      within(zeile("Clara Berger")).getByRole("button", { name: /ändern/i }),
    );
    await fuelleFeld("Telefonnummer", "+43 664 7654321");
    await userEvent.click(screen.getByRole("button", { name: "Speichern" }));

    await waitFor(() =>
      expect(zeile("Clara Berger")).toHaveTextContent("+43 664 7654321"),
    );
  });

  it("fragt vor dem Entfernen mit dem Namen der Person zurück", async () => {
    zeige([UWE, CLARA]);

    await userEvent.click(
      within(zeile("Clara Berger")).getByRole("button", { name: /entfernen/i }),
    );

    const rueckfrage = screen.getByRole("alertdialog");
    expect(rueckfrage).toHaveTextContent("Clara Berger");
    expect(screen.getByText("Clara Berger")).toBeInTheDocument();
  });

  it("entfernt die Person erst nach Bestätigung", async () => {
    vi.stubGlobal("fetch", antwortet(200, { status: "ok" }));
    zeige([UWE, CLARA]);

    await userEvent.click(
      within(zeile("Clara Berger")).getByRole("button", { name: /entfernen/i }),
    );
    await userEvent.click(
      within(screen.getByRole("alertdialog")).getByRole("button", {
        name: "Endgültig entfernen",
      }),
    );

    await waitFor(() => expect(screen.queryByText("Clara Berger")).toBeNull());
  });

  it("entfernt nichts, solange die Rückfrage nicht bestätigt ist", async () => {
    const fetchMock = antwortet(200, { status: "ok" });
    vi.stubGlobal("fetch", fetchMock);
    zeige([UWE, CLARA]);

    await userEvent.click(
      within(zeile("Clara Berger")).getByRole("button", { name: /entfernen/i }),
    );
    await userEvent.click(screen.getByRole("button", { name: "Abbrechen" }));

    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByText("Clara Berger")).toBeInTheDocument();
  });

  it("nennt die Person in der Rückfrage beim Nicknamen (req-020)", async () => {
    zeige([UWE, CLARI]);

    await userEvent.click(
      within(zeile("Clara Berger")).getByRole("button", { name: /entfernen/i }),
    );

    expect(screen.getByRole("alertdialog")).toHaveTextContent("Clari");
  });

  it("lässt die Eingaben stehen und weist hin, wenn das Speichern fehlschlägt", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("kein Netz");
      }),
    );
    zeige();

    await userEvent.click(
      screen.getByRole("button", { name: "Teilnehmer hinzufügen" }),
    );
    await fuelleFeld("Name", "Clara Berger");
    await userEvent.click(screen.getByRole("button", { name: "Speichern" }));

    expect(
      await screen.findByTestId("participant-save-error"),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Name")).toHaveValue("Clara Berger");
  });
});

describe("Nickname je Person (req-020)", () => {
  it("zeigt den Nicknamen in der Liste", () => {
    zeige([UWE, CLARI]);

    expect(screen.getByText("Clari")).toBeInTheDocument();
  });

  it("zeigt bei der Bankverbindung den vollen Namen", () => {
    zeige([UWE, CLARI]);

    const mitBankverbindung = screen
      .getByText("AT611904300234573201")
      .closest("li") as HTMLElement;
    expect(mitBankverbindung).toHaveTextContent("Clara Berger");
  });

  it("zeigt den Namen, wo kein Nickname hinterlegt ist", () => {
    zeige([UWE, { ...CLARA, name: "Max Gast", iban: null, phone: null }]);

    expect(screen.getByText("Max Gast")).toBeInTheDocument();
  });

  it("führt das Feld direkt nach dem Namen", async () => {
    zeige();

    await userEvent.click(
      screen.getByRole("button", { name: "Teilnehmer hinzufügen" }),
    );

    const beschriftungen = Array.from(
      screen
        .getByRole("form", { name: "Neuer Teilnehmer" })
        .querySelectorAll("label"),
    ).map((label) => label.textContent);
    expect(beschriftungen).toEqual([
      "Name",
      "Nickname",
      "E-Mail-Adresse",
      "Telefonnummer",
      "Bankverbindung (IBAN)",
    ]);
  });

  it("legt einen Nicknamen mit 21 Zeichen nicht an", async () => {
    const fetchMock = antwortet(201, { participant: CLARI });
    vi.stubGlobal("fetch", fetchMock);
    zeige();
    const zuLang = "N".repeat(21);

    await userEvent.click(
      screen.getByRole("button", { name: "Teilnehmer hinzufügen" }),
    );
    await fuelleFeld("Name", "Clara Berger");
    await fuelleFeld("Nickname", zuLang);

    // Das Feld nimmt nur 20 Zeichen an -- der 21 Zeichen lange Nickname
    // erreicht die Schnittstelle gar nicht erst.
    expect(screen.getByLabelText("Nickname")).toHaveValue("N".repeat(20));

    await userEvent.click(screen.getByRole("button", { name: "Speichern" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const gesendet = JSON.parse(
      (fetchMock.mock.calls[0][1] as { body: string }).body,
    ) as { nickname: string };
    expect(gesendet.nickname).not.toBe(zuLang);
    expect(gesendet.nickname).toHaveLength(20);
  });

  it("legt eine Person nur mit Nicknamen nicht an", async () => {
    const fetchMock = antwortet(201, { participant: CLARI });
    vi.stubGlobal("fetch", fetchMock);
    zeige();

    await userEvent.click(
      screen.getByRole("button", { name: "Teilnehmer hinzufügen" }),
    );
    await fuelleFeld("Nickname", "Clari");
    await userEvent.click(screen.getByRole("button", { name: "Speichern" }));

    expect(
      await screen.findByText(PARTICIPANT_ERRORS.nameRequired),
    ).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.queryByText("Clari")).toBeNull();
  });

  it("zeigt nach dem Entfernen des Nicknamens wieder den Namen", async () => {
    vi.stubGlobal("fetch", antwortet(200, { participant: CLARA }));
    zeige([UWE, CLARI]);

    await userEvent.click(
      within(zeile("Clara Berger")).getByRole("button", { name: /ändern/i }),
    );
    await fuelleFeld("Nickname", "");
    await userEvent.click(screen.getByRole("button", { name: "Speichern" }));

    await waitFor(() => expect(screen.queryByText("Clari")).toBeNull());
    expect(screen.getByText("Clara Berger")).toBeInTheDocument();
  });

  it("nimmt den Nicknamen in die Änderung auf", async () => {
    const fetchMock = antwortet(200, { participant: CLARI });
    vi.stubGlobal("fetch", fetchMock);
    zeige([UWE, CLARA]);

    await userEvent.click(
      within(zeile("Clara Berger")).getByRole("button", { name: /ändern/i }),
    );
    await fuelleFeld("Nickname", "Clari");
    await userEvent.click(screen.getByRole("button", { name: "Speichern" }));

    expect(await screen.findByText("Clari")).toBeInTheDocument();
    expect(screen.getByText("Clara Berger")).toBeInTheDocument();
  });
});
