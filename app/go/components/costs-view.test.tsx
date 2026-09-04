import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Expense, ExpensePerson } from "@/lib/expenses/types";
import { equalShares } from "@/lib/expenses/split";
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

/** Eine Ausgabe, die nur den Zahler selbst betrifft -- alle Salden bleiben 0. */
const NUR_FUER_SICH: Expense = {
  ...ABENDESSEN,
  id: "1a2b3c4d-0000-4000-8000-000000000004",
  title: "Andenken",
  shares: [{ participantId: UWE.id, amountCents: 6000 }],
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

/**
 * Ein Server, der die geschickte Ausgabe so zurueckgibt, wie er sie ablegen
 * wuerde: die Anteile ergeben sich bei gleichmaessiger Aufteilung aus der
 * Teilung (siehe lib/expenses/build.ts).
 */
function serverErfasst(): ReturnType<typeof vi.fn> {
  let nummer = 0;
  return vi.fn(async (_url: string, init: { method: string; body: string }) => {
    if (init.method === "DELETE") {
      return { ok: true, status: 200, json: async () => ({ status: "ok" }) };
    }
    const draft = JSON.parse(init.body) as {
      tripId: string;
      title: string;
      originalAmountCents: number;
      payerId: string;
      shares: { participantId: string }[];
    };
    nummer += 1;
    const expense: Expense = {
      id: `1a2b3c4d-0000-4000-8000-90000000000${nummer}`,
      tripId: draft.tripId,
      title: draft.title,
      amountCents: draft.originalAmountCents,
      originalAmountCents: draft.originalAmountCents,
      currency: "EUR",
      exchangeRate: 1,
      payerId: draft.payerId,
      splitMode: "gleichmaessig",
      shares: equalShares(
        draft.originalAmountCents,
        draft.shares.map((share) => share.participantId),
        draft.payerId,
      ),
      createdAt: "2026-07-21T10:00:00.000Z",
    };
    return { ok: true, status: 200, json: async () => ({ expense }) };
  });
}

/**
 * Ein Server, der zusaetzlich die Bankverbindung des Empfaengers kennt
 * (req-031, siehe app/api/bankverbindung/route.ts).
 */
function serverMitBankverbindung(
  iban: string | null,
): ReturnType<typeof vi.fn> {
  const ausgaben = serverErfasst();
  return vi.fn(async (url: string, init?: { method: string; body: string }) => {
    if (url.startsWith("/api/bankverbindung")) {
      return { ok: true, status: 200, json: async () => ({ iban }) };
    }
    return ausgaben(url, init as { method: string; body: string });
  });
}

/** Der Bereich mit einer Liste, die auf Erfassen und Entfernen reagiert. */
function Bereich({
  start = [] as Expense[],
  people = ALLE,
}: {
  start?: Expense[];
  people?: ExpensePerson[];
}) {
  const [expenses, setExpenses] = useState(start);
  return (
    <CostsView
      tripId={TRIP_ID}
      people={people}
      tripPeople={people}
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

function zeige(expenses: Expense[] = [], people: ExpensePerson[] = ALLE) {
  render(<Bereich start={expenses} people={people} />);
}

/**
 * Der Umschalter steht zunaechst auf „Übersicht“ (req-030); die
 * Ausgabenliste liegt hinter „Alle Ausgaben“.
 */
async function zeigeAusgaben(
  user: ReturnType<typeof userEvent.setup>,
): Promise<HTMLElement> {
  await user.click(screen.getByRole("button", { name: /^Alle Ausgaben/ }));
  return screen.getByRole("region", { name: "Alle Ausgaben" });
}

async function zeigeUebersicht(
  user: ReturnType<typeof userEvent.setup>,
): Promise<HTMLElement> {
  await user.click(screen.getByRole("button", { name: "Übersicht" }));
  return screen.getByRole("region", { name: "Übersicht" });
}

/** Die Salden-Zeile einer Person. */
function saldoZeile(name: string): HTMLElement {
  return screen.getByText(name).closest("li") as HTMLElement;
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
  it("weist eine Reise ohne Ausgaben aus", async () => {
    const user = userEvent.setup();
    zeige();

    const liste = await zeigeAusgaben(user);

    expect(
      within(liste).getByText("Noch keine Ausgaben erfasst"),
    ).toBeInTheDocument();
  });

  it("zeigt eine erfasste Ausgabe in der Liste", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", antwortet(200, { expense: ABENDESSEN }));
    zeige();

    const blatt = await oeffneBlatt(user);
    await erfasse(user, blatt, "Abendessen", "60,00");
    await user.click(within(blatt).getByRole("button", { name: "Hinzufügen" }));

    const liste = await zeigeAusgaben(user);
    await waitFor(() =>
      expect(within(liste).getByText("Abendessen")).toBeInTheDocument(),
    );
    expect(within(liste).getByText("60,00 €")).toBeInTheDocument();
    expect(
      within(liste).queryByText("Noch keine Ausgaben erfasst"),
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

    const liste = await zeigeAusgaben(user);
    await user.click(within(liste).getByRole("button", { expanded: false }));

    expect(within(liste).getAllByText("20,00 €")).toHaveLength(3);
    expect(within(liste).getByText("Ben Berger")).toBeInTheDocument();
  });

  it("laesst auf den nicht beteiligten Zahler keinen Anteil entfallen", async () => {
    const user = userEvent.setup();
    zeige([AUSGELEGT]);

    const liste = await zeigeAusgaben(user);
    await user.click(within(liste).getByRole("button", { expanded: false }));

    const anteile = screen.getByRole("list", { name: "Anteile" });
    expect(within(anteile).getAllByRole("listitem")).toHaveLength(2);
    expect(within(anteile).getByText("Ben Berger")).toBeInTheDocument();
    expect(within(anteile).getByText("Clara Berger")).toBeInTheDocument();
    // Uwe hat gezahlt, aber nur ausgelegt -- auf ihn entfaellt kein Anteil.
    expect(within(anteile).queryByText("Uwe Kremmel")).not.toBeInTheDocument();
    expect(within(anteile).getAllByText("30,00 €")).toHaveLength(2);
  });

  it("zeigt zu einer Ausgabe in fremder Waehrung den Euro-Betrag und den urspruenglichen", async () => {
    const user = userEvent.setup();
    zeige([TANKEN_CHF]);

    const liste = await zeigeAusgaben(user);

    expect(within(liste).getByText("100,70 €")).toBeInTheDocument();
    expect(within(liste).getByText(/95,00 CHF/)).toBeInTheDocument();
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

    const liste = await zeigeAusgaben(user);
    await user.click(within(liste).getByRole("button", { expanded: false }));
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

    const liste = await zeigeAusgaben(user);
    await user.click(within(liste).getByRole("button", { expanded: false }));
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

    const liste = await zeigeAusgaben(user);
    await user.click(within(liste).getByRole("button", { expanded: false }));
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

    const liste = await zeigeAusgaben(user);
    await user.click(within(liste).getByRole("button", { expanded: false }));
    await user.click(screen.getByRole("button", { name: "Entfernen" }));
    await user.click(screen.getByRole("button", { name: "Abbrechen" }));

    expect(fetchMock).not.toHaveBeenCalled();
    expect(within(liste).getByText("Abendessen")).toBeInTheDocument();
  });
});

describe("Zusammenfassung (req-030)", () => {
  it("nennt die Zahl der Teilnehmer und die Zahl der Ausgaben", () => {
    zeige([ABENDESSEN]);

    expect(screen.getByText("Gruppenkasse · 3 Personen")).toBeInTheDocument();
    expect(screen.getByText("1 Ausgabe")).toBeInTheDocument();
  });

  it("nennt die Gesamtsumme aller Ausgaben", () => {
    zeige([ABENDESSEN]);

    expect(screen.getByTestId("costs-total")).toHaveTextContent("60,00 €");
  });

  it("nennt den eigenen Saldo", () => {
    zeige([ABENDESSEN]);

    expect(screen.getByTestId("costs-own-balance")).toHaveTextContent(
      "+40,00 €",
    );
  });
});

describe("Übersicht: Salden (req-030)", () => {
  it("gibt dem Zahler einer Ausgabe fuer drei einen Saldo von +40,00 €", () => {
    zeige([ABENDESSEN]);

    expect(saldoZeile("Uwe Kremmel")).toHaveTextContent("+40,00 €");
  });

  it("gibt den beiden anderen Personen einen Saldo von −20,00 €", () => {
    zeige([ABENDESSEN]);

    expect(saldoZeile("Ben Berger")).toHaveTextContent("−20,00 €");
    expect(saldoZeile("Clara Berger")).toHaveTextContent("−20,00 €");
  });

  it("weist je Person aus, was sie ausgelegt hat und was auf sie entfaellt", () => {
    zeige([ABENDESSEN]);

    expect(saldoZeile("Uwe Kremmel")).toHaveTextContent(
      "ausgelegt 60,00 € · entfällt 20,00 €",
    );
  });

  it("gibt ohne Ausgaben jedem Teilnehmer einen Saldo von 0,00 €", () => {
    zeige();

    const salden = screen.getByRole("list", { name: "Salden" });
    expect(within(salden).getAllByRole("listitem")).toHaveLength(3);
    expect(within(salden).getAllByText("0,00 €")).toHaveLength(3);
  });

  it("laesst die Salden-Liste stehen, wenn alles ausgeglichen ist", () => {
    zeige([NUR_FUER_SICH]);

    const salden = screen.getByRole("list", { name: "Salden" });
    expect(within(salden).getAllByText("0,00 €")).toHaveLength(3);
  });
});

describe("Übersicht: Ausgleich (req-030)", () => {
  it("schlaegt bei einer Ausgabe fuer drei genau zwei Zahlungen vor", () => {
    zeige([ABENDESSEN]);

    const ausgleich = screen.getByRole("list", { name: "Ausgleich" });
    expect(within(ausgleich).getAllByRole("listitem")).toHaveLength(2);
  });

  it("nennt je Zahlung, wer wem wie viel zahlt", () => {
    zeige([ABENDESSEN]);

    expect(
      screen.getByRole("button", {
        name: "Erledigt: Clara Berger zahlt Uwe Kremmel 20,00 €",
      }),
    ).toBeInTheDocument();
  });

  it("meldet ausgeglichene Salden statt einer Ausgleichsliste", () => {
    zeige([NUR_FUER_SICH]);

    expect(screen.getByText("Alle Salden ausgeglichen")).toBeInTheDocument();
    expect(
      screen.queryByRole("list", { name: "Ausgleich" }),
    ).not.toBeInTheDocument();
  });
});

describe("Zahlung abhaken (req-030)", () => {
  /** „Clara zahlt Uwe 20,00 €“ abhaken. */
  async function hakeAb(user: ReturnType<typeof userEvent.setup>) {
    await user.click(
      screen.getByRole("button", {
        name: "Erledigt: Clara Berger zahlt Uwe Kremmel 20,00 €",
      }),
    );
  }

  it("erfasst die Zahlung als Ausgabe des Zahlenden fuer den Empfaenger", async () => {
    const user = userEvent.setup();
    const fetchMock = serverErfasst();
    vi.stubGlobal("fetch", fetchMock);
    zeige([ABENDESSEN]);

    await hakeAb(user);

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body).toMatchObject({
      tripId: TRIP_ID,
      title: "Rückzahlung an Uwe Kremmel",
      originalAmountCents: 2000,
      currency: "EUR",
      payerId: CLARA.id,
    });
    expect(body.shares).toEqual([{ participantId: UWE.id, amountCents: 2000 }]);
  });

  it("laesst die Zahlung als Ausgabe in der Ausgabenliste erscheinen", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", serverErfasst());
    zeige([ABENDESSEN]);

    await hakeAb(user);
    const liste = await zeigeAusgaben(user);

    await waitFor(() =>
      expect(
        within(liste).getByText("Rückzahlung an Uwe Kremmel"),
      ).toBeInTheDocument(),
    );
  });

  it("nimmt die abgehakte Zahlung aus der Ausgleichsliste", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", serverErfasst());
    zeige([ABENDESSEN]);

    await hakeAb(user);

    await waitFor(() =>
      expect(
        screen.queryByRole("button", {
          name: "Erledigt: Clara Berger zahlt Uwe Kremmel 20,00 €",
        }),
      ).not.toBeInTheDocument(),
    );
    // Bens Schuld bleibt offen -- nur Claras Zahlung ist erledigt.
    expect(
      screen.getByRole("button", {
        name: "Erledigt: Ben Berger zahlt Uwe Kremmel 20,00 €",
      }),
    ).toBeInTheDocument();
  });

  it("laesst die Zahlung wieder erscheinen, wenn die Ausgabe entfernt wird", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", serverErfasst());
    zeige([ABENDESSEN]);

    await hakeAb(user);
    const liste = await zeigeAusgaben(user);
    const zeile = await waitFor(() =>
      within(liste).getByText("Rückzahlung an Uwe Kremmel"),
    );

    await user.click(zeile.closest("button") as HTMLElement);
    await user.click(within(liste).getByRole("button", { name: "Entfernen" }));
    const rueckfrage = screen.getByRole("alertdialog", {
      name: "Ausgabe entfernen",
    });
    await user.click(
      within(rueckfrage).getByRole("button", { name: "Entfernen" }),
    );

    await zeigeUebersicht(user);
    await waitFor(() =>
      expect(
        screen.getByRole("button", {
          name: "Erledigt: Clara Berger zahlt Uwe Kremmel 20,00 €",
        }),
      ).toBeInTheDocument(),
    );
  });

  it("nennt den Grund, wenn das Abhaken nicht gespeichert werden kann", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", antwortet(409, { error: "notInTrip" }));
    zeige([ABENDESSEN]);

    await hakeAb(user);

    await waitFor(() =>
      expect(screen.getByTestId("settle-error")).toHaveTextContent(
        EXPENSE_ERRORS.notInTrip,
      ),
    );
  });
});

describe("Überweisungscode zu einer Zahlung (req-031)", () => {
  const IBAN = "DE89370400440532013000";

  /** Uwe wird als „Uwi“ angesprochen -- die Zahlung nennt trotzdem den Namen. */
  const UWE_MIT_NICKNAME: ExpensePerson = { ...UWE, nickname: "Uwi" };

  /** „Clara zahlt Uwe 20,00 €“ -- dazu den Code anfordern. */
  async function fordereCodeAn(user: ReturnType<typeof userEvent.setup>) {
    await user.click(
      screen.getByRole("button", {
        name: "Überweisungscode: Clara Berger zahlt Uwe Kremmel 20,00 €",
      }),
    );
    return screen.getByRole("region", {
      name: "Überweisungscode für Uwe Kremmel",
    });
  }

  it("zeigt die Ausgleichsliste ohne Anforderung ohne Code", () => {
    zeige([ABENDESSEN]);

    expect(
      screen.queryByRole("img", { name: /Überweisungscode/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("region", { name: /Überweisungscode/ }),
    ).not.toBeInTheDocument();
  });

  it("zeigt auf Anforderung einen Code", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", serverMitBankverbindung(IBAN));
    zeige([ABENDESSEN]);

    await fordereCodeAn(user);

    await waitFor(() =>
      expect(
        screen.getByRole("img", { name: "Überweisungscode für Uwe Kremmel" }),
      ).toBeInTheDocument(),
    );
  });

  it("nennt in der Fläche Betrag und Bankverbindung", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", serverMitBankverbindung(IBAN));
    zeige([ABENDESSEN]);

    const flaeche = await fordereCodeAn(user);

    await waitFor(() =>
      expect(flaeche).toHaveTextContent("DE89 3704 0044 0532 0130 00"),
    );
    expect(flaeche).toHaveTextContent("20,00 €");
  });

  it("nennt den vollen Namen des Empfaengers, nicht seinen Nickname", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", serverMitBankverbindung(IBAN));
    zeige([ABENDESSEN], [UWE_MIT_NICKNAME, BEN, CLARA]);

    const flaeche = await fordereCodeAn(user);

    await waitFor(() => expect(flaeche).toHaveTextContent("Uwe Kremmel"));
    expect(flaeche).not.toHaveTextContent("Uwi");
    // In der Salden-Liste steht dagegen der Nickname (req-020).
    expect(saldoZeile("Uwi")).toBeInTheDocument();
  });

  it("nennt ohne hinterlegte Bankverbindung den Grund statt eines Codes", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", serverMitBankverbindung(null));
    zeige([ABENDESSEN]);

    const flaeche = await fordereCodeAn(user);

    await waitFor(() =>
      expect(flaeche).toHaveTextContent(
        "Für Uwe Kremmel ist keine Bankverbindung hinterlegt.",
      ),
    );
    expect(
      screen.queryByRole("img", { name: /Überweisungscode/ }),
    ).not.toBeInTheDocument();
  });

  it("laesst die Zahlung ohne Bankverbindung weiterhin abhaken", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", serverMitBankverbindung(null));
    zeige([ABENDESSEN]);

    const flaeche = await fordereCodeAn(user);
    await waitFor(() =>
      expect(flaeche).toHaveTextContent("keine Bankverbindung hinterlegt"),
    );
    await user.click(
      screen.getByRole("button", {
        name: "Erledigt: Clara Berger zahlt Uwe Kremmel 20,00 €",
      }),
    );

    await waitFor(() =>
      expect(
        screen.queryByRole("button", {
          name: "Erledigt: Clara Berger zahlt Uwe Kremmel 20,00 €",
        }),
      ).not.toBeInTheDocument(),
    );
  });

  it("nimmt den Code wieder weg, wenn die Fläche geschlossen wird", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", serverMitBankverbindung(IBAN));
    zeige([ABENDESSEN]);

    const flaeche = await fordereCodeAn(user);
    await waitFor(() =>
      expect(
        screen.getByRole("img", { name: "Überweisungscode für Uwe Kremmel" }),
      ).toBeInTheDocument(),
    );
    await user.click(
      within(flaeche).getByRole("button", { name: "Schließen" }),
    );

    expect(
      screen.queryByRole("region", { name: /Überweisungscode/ }),
    ).not.toBeInTheDocument();
  });
});
