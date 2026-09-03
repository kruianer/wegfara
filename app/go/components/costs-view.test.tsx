import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Expense, ExpensePerson } from "@/lib/expenses/types";
import { EXPENSE_ERRORS } from "@/lib/expenses/validate";
import { CostsView } from "./costs-view";

const TRIP_ID = "d5fda5ea-65e7-4b47-8096-62618599a288";

const UWE: ExpensePerson = {
  id: "5e0cd230-3765-425b-be49-6a95028ba0b8",
  name: "Uwe Kremmel",
  nickname: null,
};
const BEN: ExpensePerson = {
  id: "9b1c1e3a-6d0a-4f57-9a3f-2c2b7f5f1111",
  name: "Ben Berger",
  nickname: null,
};
const CLARA: ExpensePerson = {
  id: "9b1c1e3a-6d0a-4f57-9a3f-2c2b7f5f2222",
  name: "Clara Berger",
  nickname: null,
};
const ALLE = [UWE, BEN, CLARA];

const ABENDESSEN: Expense = {
  id: "1a2b3c4d-0000-4000-8000-000000000001",
  tripId: TRIP_ID,
  title: "Abendessen",
  amountCents: 6000,
  originalAmountCents: 6000,
  currency: "EUR",
  exchangeRate: 1,
  payerId: UWE.id,
  splitMode: "gleichmaessig",
  shares: [
    { participantId: UWE.id, amountCents: 2000 },
    { participantId: BEN.id, amountCents: 2000 },
    { participantId: CLARA.id, amountCents: 2000 },
  ],
  createdAt: "2026-07-20T18:00:00.000Z",
};

/** Eine Ausgabe in Schweizer Franken, wie sie der Server zurueckgibt. */
const TANKEN_CHF: Expense = {
  ...ABENDESSEN,
  id: "1a2b3c4d-0000-4000-8000-000000000002",
  title: "Tanken",
  amountCents: 10070,
  originalAmountCents: 9500,
  currency: "CHF",
  exchangeRate: 1.06,
  shares: [{ participantId: UWE.id, amountCents: 10070 }],
};

/** Eine Ausgabe, bei der der Zahler selbst nicht beteiligt ist. */
const AUSGELEGT: Expense = {
  ...ABENDESSEN,
  id: "1a2b3c4d-0000-4000-8000-000000000003",
  title: "Tickets",
  shares: [
    { participantId: BEN.id, amountCents: 3000 },
    { participantId: CLARA.id, amountCents: 3000 },
  ],
};

/**
 * Die Schnittstelle antwortet wie app/api/ausgaben/route.ts -- dort wird sie
 * gegen die echte Datenbank geprueft. Hier zaehlt, was der Bereich daraus
 * macht.
 */
function antwortet(status: number, payload: unknown): ReturnType<typeof vi.fn> {
  return vi.fn(async () => ({
    ok: status < 400,
    status,
    json: async () => payload,
  }));
}

/** Der Bereich mit einer Liste, die auf Erfassen und Entfernen reagiert. */
function Bereich({ start = [] as Expense[] }) {
  const [expenses, setExpenses] = useState(start);
  return (
    <CostsView
      tripId={TRIP_ID}
      people={ALLE}
      tripPeople={ALLE}
      expenses={expenses}
      selfParticipantId={UWE.id}
      onSaved={(expense) =>
        setExpenses((prev) => [
          expense,
          ...prev.filter((vorhanden) => vorhanden.id !== expense.id),
        ])
      }
      onRemoved={(expense) =>
        setExpenses((prev) =>
          prev.filter((vorhanden) => vorhanden.id !== expense.id),
        )
      }
    />
  );
}

function zeige(expenses: Expense[] = []) {
  render(<Bereich start={expenses} />);
}

async function oeffneBlatt(user: ReturnType<typeof userEvent.setup>) {
  await user.click(
    screen.getByRole("button", { name: "+ Neue Ausgabe erfassen" }),
  );
  return screen.getByRole("dialog", { name: "Neue Ausgabe" });
}

/** Titel und Betrag eintragen -- der Rest ist vorbelegt. */
async function erfasse(
  user: ReturnType<typeof userEvent.setup>,
  blatt: HTMLElement,
  titel: string,
  betrag: string,
) {
  await user.type(within(blatt).getByLabelText("Titel"), titel);
  await user.type(within(blatt).getByLabelText("Betrag"), betrag);
}

beforeEach(() => {
  vi.unstubAllGlobals();
});

describe("Bereich Kosten (req-029)", () => {
  it("weist eine Reise ohne Ausgaben aus", () => {
    zeige();

    expect(screen.getByText("Noch keine Ausgaben erfasst")).toBeInTheDocument();
  });

  it("zeigt eine erfasste Ausgabe in der Liste", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", antwortet(200, { expense: ABENDESSEN }));
    zeige();

    const blatt = await oeffneBlatt(user);
    await erfasse(user, blatt, "Abendessen", "60,00");
    await user.click(within(blatt).getByRole("button", { name: "Hinzufügen" }));

    await waitFor(() =>
      expect(screen.getByText("Abendessen")).toBeInTheDocument(),
    );
    expect(screen.getByText("60,00 €")).toBeInTheDocument();
    expect(
      screen.queryByText("Noch keine Ausgaben erfasst"),
    ).not.toBeInTheDocument();
  });

  it("schickt die Beteiligten und die Art der Aufteilung mit", async () => {
    const user = userEvent.setup();
    const fetchMock = antwortet(200, { expense: ABENDESSEN });
    vi.stubGlobal("fetch", fetchMock);
    zeige();

    const blatt = await oeffneBlatt(user);
    await erfasse(user, blatt, "Abendessen", "60,00");
    await user.click(within(blatt).getByRole("button", { name: "Hinzufügen" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body).toMatchObject({
      tripId: TRIP_ID,
      title: "Abendessen",
      originalAmountCents: 6000,
      currency: "EUR",
      payerId: UWE.id,
      splitMode: "gleichmaessig",
    });
    expect(
      body.shares.map(
        (share: { participantId: string }) => share.participantId,
      ),
    ).toEqual([UWE.id, BEN.id, CLARA.id]);
  });

  it("zeigt aufgeklappt den Anteil je Person", async () => {
    const user = userEvent.setup();
    zeige([ABENDESSEN]);

    await user.click(screen.getByRole("button", { expanded: false }));

    expect(screen.getAllByText("20,00 €")).toHaveLength(3);
    expect(screen.getByText("Ben Berger")).toBeInTheDocument();
  });

  it("laesst auf den nicht beteiligten Zahler keinen Anteil entfallen", async () => {
    const user = userEvent.setup();
    zeige([AUSGELEGT]);

    await user.click(screen.getByRole("button", { expanded: false }));

    const anteile = screen.getByRole("list", { name: "Anteile" });
    expect(within(anteile).getAllByRole("listitem")).toHaveLength(2);
    expect(within(anteile).getByText("Ben Berger")).toBeInTheDocument();
    expect(within(anteile).getByText("Clara Berger")).toBeInTheDocument();
    // Uwe hat gezahlt, aber nur ausgelegt -- auf ihn entfaellt kein Anteil.
    expect(within(anteile).queryByText("Uwe Kremmel")).not.toBeInTheDocument();
    expect(within(anteile).getAllByText("30,00 €")).toHaveLength(2);
  });

  it("zeigt zu einer Ausgabe in fremder Waehrung den Euro-Betrag und den urspruenglichen", () => {
    zeige([TANKEN_CHF]);

    expect(screen.getByText("100,70 €")).toBeInTheDocument();
    expect(screen.getByText(/95,00 CHF/)).toBeInTheDocument();
  });
});

describe("Blatt „Neue Ausgabe“ (req-029)", () => {
  it("speichert ohne Titel nicht", async () => {
    const user = userEvent.setup();
    const fetchMock = antwortet(200, { expense: ABENDESSEN });
    vi.stubGlobal("fetch", fetchMock);
    zeige();

    const blatt = await oeffneBlatt(user);
    await user.type(within(blatt).getByLabelText("Betrag"), "60,00");
    await user.click(within(blatt).getByRole("button", { name: "Hinzufügen" }));

    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByTestId("expense-error")).toHaveTextContent(
      EXPENSE_ERRORS.titleMissing,
    );
  });

  it("speichert ohne beteiligte Person nicht", async () => {
    const user = userEvent.setup();
    const fetchMock = antwortet(200, { expense: ABENDESSEN });
    vi.stubGlobal("fetch", fetchMock);
    zeige();

    const blatt = await oeffneBlatt(user);
    await erfasse(user, blatt, "Abendessen", "60,00");
    for (const person of ALLE) {
      await user.click(
        within(blatt).getByRole("button", { name: person.name }),
      );
    }
    await user.click(within(blatt).getByRole("button", { name: "Hinzufügen" }));

    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByTestId("expense-error")).toHaveTextContent(
      EXPENSE_ERRORS.noParticipants,
    );
  });

  it("hat den Zahler zunaechst als beteiligt vorausgewaehlt", async () => {
    const user = userEvent.setup();
    zeige();

    const blatt = await oeffneBlatt(user);

    expect(
      within(blatt).getByRole("button", { name: UWE.name }),
    ).toHaveAttribute("aria-pressed", "true");
  });

  it("nennt bei individueller Aufteilung die Abweichung zum Gesamtbetrag", async () => {
    const user = userEvent.setup();
    const fetchMock = antwortet(200, { expense: ABENDESSEN });
    vi.stubGlobal("fetch", fetchMock);
    zeige();

    const blatt = await oeffneBlatt(user);
    await erfasse(user, blatt, "Abendessen", "60,00");
    await user.click(
      within(blatt).getByRole("button", { name: "Individuell" }),
    );
    await user.type(
      within(blatt).getByLabelText(`Anteil: ${UWE.name}`),
      "20,00",
    );
    await user.type(
      within(blatt).getByLabelText(`Anteil: ${BEN.name}`),
      "20,00",
    );
    await user.type(
      within(blatt).getByLabelText(`Anteil: ${CLARA.name}`),
      "15,00",
    );

    expect(screen.getByTestId("expense-difference")).toHaveTextContent(
      "Es fehlen noch 5,00 €.",
    );

    await user.click(within(blatt).getByRole("button", { name: "Hinzufügen" }));

    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByTestId("expense-error")).toHaveTextContent("5,00 €");
  });

  it("nennt den Grund, wenn der Wechselkurs nicht abrufbar ist", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", antwortet(503, { error: "rateUnavailable" }));
    zeige();

    const blatt = await oeffneBlatt(user);
    await erfasse(user, blatt, "Tanken", "95,00");
    await user.selectOptions(within(blatt).getByLabelText("Währung"), "CHF");
    await user.click(within(blatt).getByRole("button", { name: "Hinzufügen" }));

    await waitFor(() =>
      expect(screen.getByTestId("expense-error")).toHaveTextContent(
        EXPENSE_ERRORS.rateUnavailable,
      ),
    );
  });

  it("aendert eine erfasste Ausgabe mit ihren Werten vorbelegt", async () => {
    const user = userEvent.setup();
    const fetchMock = antwortet(200, {
      expense: { ...ABENDESSEN, title: "Mittagessen" },
    });
    vi.stubGlobal("fetch", fetchMock);
    zeige([ABENDESSEN]);

    await user.click(screen.getByRole("button", { expanded: false }));
    await user.click(screen.getByRole("button", { name: "Ändern" }));

    const blatt = screen.getByRole("dialog", { name: "Ausgabe ändern" });
    expect(within(blatt).getByLabelText("Titel")).toHaveValue("Abendessen");
    expect(within(blatt).getByLabelText("Betrag")).toHaveValue("60,00");

    await user.clear(within(blatt).getByLabelText("Titel"));
    await user.type(within(blatt).getByLabelText("Titel"), "Mittagessen");
    await user.click(within(blatt).getByRole("button", { name: "Speichern" }));

    await waitFor(() =>
      expect(screen.getByText("Mittagessen")).toBeInTheDocument(),
    );
    expect(fetchMock.mock.calls[0][1].method).toBe("PUT");
  });
});

describe("Ausgabe entfernen (req-029)", () => {
  it("fragt vor dem Entfernen mit Titel und Betrag zurueck", async () => {
    const user = userEvent.setup();
    zeige([ABENDESSEN]);

    await user.click(screen.getByRole("button", { expanded: false }));
    await user.click(screen.getByRole("button", { name: "Entfernen" }));

    const rueckfrage = screen.getByRole("alertdialog", {
      name: "Ausgabe entfernen",
    });
    expect(rueckfrage).toHaveTextContent("Abendessen");
    expect(rueckfrage).toHaveTextContent("60,00 €");
  });

  it("entfernt die Ausgabe erst nach der Bestaetigung", async () => {
    const user = userEvent.setup();
    const fetchMock = antwortet(200, { status: "ok" });
    vi.stubGlobal("fetch", fetchMock);
    zeige([ABENDESSEN]);

    await user.click(screen.getByRole("button", { expanded: false }));
    await user.click(screen.getByRole("button", { name: "Entfernen" }));
    const rueckfrage = screen.getByRole("alertdialog", {
      name: "Ausgabe entfernen",
    });
    await user.click(
      within(rueckfrage).getByRole("button", { name: "Entfernen" }),
    );

    await waitFor(() =>
      expect(
        screen.getByText("Noch keine Ausgaben erfasst"),
      ).toBeInTheDocument(),
    );
    expect(fetchMock.mock.calls[0][1].method).toBe("DELETE");
  });

  it("laesst die Ausgabe stehen, wenn die Rueckfrage abgebrochen wird", async () => {
    const user = userEvent.setup();
    const fetchMock = antwortet(200, { status: "ok" });
    vi.stubGlobal("fetch", fetchMock);
    zeige([ABENDESSEN]);

    await user.click(screen.getByRole("button", { expanded: false }));
    await user.click(screen.getByRole("button", { name: "Entfernen" }));
    await user.click(screen.getByRole("button", { name: "Abbrechen" }));

    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByText("Abendessen")).toBeInTheDocument();
  });
});
