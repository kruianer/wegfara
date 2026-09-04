import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Participant } from "@/lib/participants/types";
import type { Trip } from "@/lib/trips/types";
import type { TripParticipant } from "@/lib/trip-participants/types";
import { PARTICIPANT_ERRORS } from "@/lib/participants/validate";
import { ACCOUNT_ADMIN_ERRORS } from "@/lib/participants/account-admin";
import { AccountView } from "./account-view";

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

const CLARA: Participant = {
  id: "9b1c1e3a-6d0a-4f57-9a3f-2c2b7f5f1111",
  accountId: UWE.accountId,
  name: "Clara Berger",
  nickname: null,
  email: null,
  phone: "+43 664 1234567",
  iban: "AT611904300234573201",
  loginEnabled: false,
  accountAdmin: false,
};

/** Dieselbe Person, wie der Reiseleiter sie anspricht (req-020). */
const CLARI: Participant = { ...CLARA, nickname: "Clari" };

const SUEDITALIEN: Trip = {
  id: "d5fda5ea-65e7-4b47-8096-62618599a288",
  title: "Süditalien Rundreise",
  startDate: "2026-07-18",
  endDate: "2026-07-23",
  mainPlace: { name: "Amalfi", lat: 40.634, lng: 14.6027 },
  description: "",
  state: "in_planung",
};

/** Die Reise braucht immer einen Reiseleiter (req-021). */
const UWE_FUEHRT: TripParticipant = {
  tripId: SUEDITALIEN.id,
  participantId: UWE.id,
  role: "reiseleiter",
};

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

/**
 * Die Personen des Accounts liegen seit req-032 in PlanView; der Bereich
 * bekommt sie und meldet jede Aenderung zurueck. Hier haelt sie der Rahmen,
 * damit eine angelegte oder entfernte Person in der Liste ankommt.
 */
function Rahmen({
  participants: initial,
  accountAdmin,
}: {
  participants: Participant[];
  accountAdmin: boolean;
}) {
  const [participants, setParticipants] = useState(initial);
  const [tripParticipants, setTripParticipants] = useState<TripParticipant[]>([
    UWE_FUEHRT,
  ]);
  return (
    <AccountView
      participants={participants}
      onParticipantsChange={setParticipants}
      selfParticipantId={UWE.id}
      accountAdmin={accountAdmin}
      tripParticipants={tripParticipants}
      onTripParticipantsChange={setTripParticipants}
      apiKeys={[
        { kind: "ki_suche", lastFour: null },
        { kind: "google", lastFour: null },
      ]}
    />
  );
}

/**
 * Zeigt den Bereich. `accountAdmin` sagt, ob die angemeldete Person die
 * Personen des Accounts verwalten darf (req-027) -- die Verwaltung selbst
 * ist unveraendert, nur wer sie bedienen darf, hat sich geaendert.
 */
function zeige(participants: Participant[] = [UWE], accountAdmin = true) {
  render(<Rahmen participants={participants} accountAdmin={accountAdmin} />);
}

/** Die Karte "Reiseteilnehmer" (req-019). */
function personenKarte(): HTMLElement {
  return screen.getByRole("region", { name: "Reiseteilnehmer" });
}

function eintrag(name: string): HTMLElement | null {
  return within(personenKarte()).queryByText(name);
}

function findeEintrag(name: string): Promise<HTMLElement> {
  return waitFor(() => {
    const gefunden = eintrag(name);
    expect(gefunden).not.toBeNull();
    return gefunden as HTMLElement;
  });
}

function zeile(name: string): HTMLElement {
  return within(personenKarte()).getByText(name).closest("li") as HTMLElement;
}

async function fuelleFeld(label: RegExp | string, wert: string) {
  const feld = screen.getByLabelText(label);
  await userEvent.clear(feld);
  if (wert.length > 0) await userEvent.type(feld, wert);
}

beforeEach(() => {
  vi.stubGlobal("fetch", antwortet(500, {}));
});

describe("AccountView (req-019)", () => {
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

    expect(eintrag("Uwe Kremmel")).toBeInTheDocument();
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

    expect(await findeEintrag("Clara Berger")).toBeInTheDocument();
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

    expect(await findeEintrag("Max Gast")).toBeInTheDocument();
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
    expect(eintrag("Clara Berger")).toBeNull();
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
    expect(eintrag("Clara Berger")).toBeNull();
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
    expect(eintrag("Clara Berger")).toBeInTheDocument();
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

    await waitFor(() => expect(eintrag("Clara Berger")).toBeNull());
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
    expect(eintrag("Clara Berger")).toBeInTheDocument();
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

    expect(eintrag("Clari")).toBeInTheDocument();
  });

  it("zeigt bei der Bankverbindung den vollen Namen", () => {
    zeige([UWE, CLARI]);

    const mitBankverbindung = within(personenKarte())
      .getByText("AT611904300234573201")
      .closest("li") as HTMLElement;
    expect(mitBankverbindung).toHaveTextContent("Clara Berger");
  });

  it("zeigt den Namen, wo kein Nickname hinterlegt ist", () => {
    zeige([UWE, { ...CLARA, name: "Max Gast", iban: null, phone: null }]);

    expect(eintrag("Max Gast")).toBeInTheDocument();
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
    expect(eintrag("Clari")).toBeNull();
  });

  it("zeigt nach dem Entfernen des Nicknamens wieder den Namen", async () => {
    vi.stubGlobal("fetch", antwortet(200, { participant: CLARA }));
    zeige([UWE, CLARI]);

    await userEvent.click(
      within(zeile("Clara Berger")).getByRole("button", { name: /ändern/i }),
    );
    await fuelleFeld("Nickname", "");
    await userEvent.click(screen.getByRole("button", { name: "Speichern" }));

    await waitFor(() => expect(eintrag("Clari")).toBeNull());
    expect(eintrag("Clara Berger")).toBeInTheDocument();
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

    expect(await findeEintrag("Clari")).toBeInTheDocument();
    expect(eintrag("Clara Berger")).toBeInTheDocument();
  });
});

describe("Account-Admin (req-027)", () => {
  const ADMIN_KNOPF = "Teilnehmer hinzufügen";

  it("zeigt dem Account-Admin die Schaltfläche zum Anlegen", () => {
    zeige([UWE, CLARA]);

    expect(
      screen.getByRole("button", { name: ADMIN_KNOPF }),
    ).toBeInTheDocument();
  });

  it("zeigt sie einer Person ohne die Kennzeichnung nicht", () => {
    zeige([UWE, CLARA], false);

    expect(screen.queryByRole("button", { name: ADMIN_KNOPF })).toBeNull();
  });

  it("zeigt ihr die Personen des Accounts trotzdem", () => {
    zeige([UWE, CLARA], false);

    expect(eintrag("Uwe Kremmel")).toBeInTheDocument();
    expect(eintrag("Clara Berger")).toBeInTheDocument();
  });

  it("zeigt ihr keine Schaltflächen zum Ändern und Entfernen", () => {
    zeige([UWE, CLARA], false);

    const clara = within(zeile("Clara Berger"));
    expect(clara.queryByRole("button", { name: /ändern/i })).toBeNull();
    expect(clara.queryByRole("button", { name: /entfernen/i })).toBeNull();
  });

  it("zeigt ihr die Kennzeichnung nicht als umschaltbares Merkmal", () => {
    zeige([UWE, CLARA], false);

    expect(screen.queryByLabelText("Account-Admin: Uwe Kremmel")).toBeNull();
  });

  it("zeigt dem Account-Admin je Person die Kennzeichnung", () => {
    zeige([UWE, CLARA]);

    expect(screen.getByLabelText("Account-Admin: Uwe Kremmel")).toBeChecked();
    expect(
      screen.getByLabelText("Account-Admin: Clara Berger"),
    ).not.toBeChecked();
  });

  it("ernennt eine Person zum Account-Admin", async () => {
    vi.stubGlobal(
      "fetch",
      antwortet(200, { participant: { ...CLARA, accountAdmin: true } }),
    );
    zeige([UWE, CLARA]);

    await userEvent.click(screen.getByLabelText("Account-Admin: Clara Berger"));

    await waitFor(() =>
      expect(
        screen.getByLabelText("Account-Admin: Clara Berger"),
      ).toBeChecked(),
    );
  });

  it("entzieht ihr die Kennzeichnung wieder", async () => {
    vi.stubGlobal(
      "fetch",
      antwortet(200, { participant: { ...CLARA, accountAdmin: false } }),
    );
    zeige([UWE, { ...CLARA, accountAdmin: true }]);

    await userEvent.click(screen.getByLabelText("Account-Admin: Clara Berger"));

    await waitFor(() =>
      expect(
        screen.getByLabelText("Account-Admin: Clara Berger"),
      ).not.toBeChecked(),
    );
  });

  it("lässt dem letzten Account-Admin die Kennzeichnung und nennt den Grund", async () => {
    const fetchMock = antwortet(200, { participant: UWE });
    vi.stubGlobal("fetch", fetchMock);
    zeige([UWE, CLARA]);

    await userEvent.click(screen.getByLabelText("Account-Admin: Uwe Kremmel"));

    expect(await screen.findByTestId("account-admin-notice")).toHaveTextContent(
      ACCOUNT_ADMIN_ERRORS.lastAdmin,
    );
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Account-Admin: Uwe Kremmel")).toBeChecked();
  });

  it("weist hin, wenn die Schnittstelle den Entzug abweist", async () => {
    vi.stubGlobal("fetch", antwortet(409, { error: "lastAdmin" }));
    zeige([UWE, { ...CLARA, accountAdmin: true }]);

    await userEvent.click(screen.getByLabelText("Account-Admin: Clara Berger"));

    expect(await screen.findByTestId("account-admin-notice")).toHaveTextContent(
      ACCOUNT_ADMIN_ERRORS.lastAdmin,
    );
    expect(screen.getByLabelText("Account-Admin: Clara Berger")).toBeChecked();
  });

  it("lässt nach dem Entfernen des letzten Account-Admins jemanden nachrücken", async () => {
    vi.stubGlobal("fetch", antwortet(200, { status: "ok" }));
    // Clara traegt die Kennzeichnung als Einzige.
    zeige([
      { ...UWE, accountAdmin: false },
      { ...CLARA, accountAdmin: true },
    ]);

    await userEvent.click(
      within(zeile("Clara Berger")).getByRole("button", { name: /entfernen/i }),
    );
    await userEvent.click(
      within(screen.getByRole("alertdialog")).getByRole("button", {
        name: "Endgültig entfernen",
      }),
    );

    await waitFor(() => expect(eintrag("Clara Berger")).toBeNull());
    expect(screen.getByLabelText("Account-Admin: Uwe Kremmel")).toBeChecked();
  });
});

describe("AccountView, Karte Zugangsschlüssel (req-028)", () => {
  it("zeigt die Karte einem Account-Admin", () => {
    zeige([UWE], true);

    expect(
      screen.getByRole("region", { name: "Zugangsschlüssel" }),
    ).toBeInTheDocument();
  });

  it("zeigt die Karte niemandem sonst", () => {
    zeige([{ ...UWE, accountAdmin: false }], false);

    expect(
      screen.queryByRole("region", { name: "Zugangsschlüssel" }),
    ).not.toBeInTheDocument();
  });

  it("liegt unter der Personenkarte", () => {
    zeige([UWE], true);

    const karten = screen
      .getAllByRole("region")
      .map((bereich) => bereich.getAttribute("aria-label"));
    expect(karten).toEqual(["Account", "Reiseteilnehmer", "Zugangsschlüssel"]);
  });
});

/**
 * Was der Umzug in den Bereich "Account" (req-032) an den beiden Karten
 * aendern durfte: nichts ausser dem Ort. Der Bereich haengt an keiner Reise
 * -- er bekommt gar keine.
 */
describe("Bereich Account (req-032)", () => {
  it("traegt beide Karten", () => {
    zeige([UWE, CLARA], true);

    const bereich = screen.getByRole("region", { name: "Account" });
    expect(
      within(bereich).getByRole("region", { name: "Reiseteilnehmer" }),
    ).toBeInTheDocument();
    expect(
      within(bereich).getByRole("region", { name: "Zugangsschlüssel" }),
    ).toBeInTheDocument();
  });

  it('traegt die Karte "Wer fährt mit" nicht -- sie gehoert zur Reise', () => {
    zeige([UWE, CLARA], true);

    expect(
      screen.queryByRole("region", { name: "Wer fährt mit" }),
    ).not.toBeInTheDocument();
  });

  it("zeigt einer Person ohne die Kennzeichnung die Personen, aber keine Schlüssel", () => {
    zeige([{ ...UWE, accountAdmin: false }, CLARA], false);

    expect(eintrag("Uwe Kremmel")).toBeInTheDocument();
    expect(eintrag("Clara Berger")).toBeInTheDocument();
    expect(
      screen.queryByRole("region", { name: "Zugangsschlüssel" }),
    ).not.toBeInTheDocument();
  });
});
