import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { AccountOverview } from "@/lib/accounts/types";
import { ACCOUNT_ERRORS } from "@/lib/accounts/validate";
import {
  ACCOUNTS_API,
  ACCOUNT_INVITATION_API,
  ACCOUNT_SWITCH_API,
  PLANNER_PATH,
} from "@/lib/accounts/paths";
import { qrCodeFor } from "@/lib/qr/qr-code";
import { AccountsView } from "./accounts-view";

const EIGENER: AccountOverview = {
  id: "eb873b95-257b-49c6-b08f-1709d6ad3b94",
  name: "Uwe Kremmel",
  personCount: 1,
  firstPerson: {
    id: "5e0cd230-3765-425b-be49-6a95028ba0b8",
    name: "Uwe Kremmel",
    access: "eingeloest",
  },
};

const HUBER: AccountOverview = {
  id: "1f2e3d4c-5b6a-4798-8899-aabbccddeeff",
  name: "Familie Huber",
  personCount: 1,
  firstPerson: {
    id: "9b1c1e3a-6d0a-4f57-9a3f-2c2b7f5f1111",
    name: "Anna Huber",
    access: "offen",
  },
};

/**
 * Die Schnittstellen antworten wie app/api/accounts/* -- dort werden sie
 * gegen die echte Datenbank geprueft. Hier zaehlt, was die Oberflaeche
 * daraus macht.
 */
function antwortet(status: number, payload: unknown): ReturnType<typeof vi.fn> {
  return vi.fn(async () => ({
    ok: status < 400,
    status,
    json: async () => payload,
  }));
}

function zeige(
  accounts: AccountOverview[] = [EIGENER, HUBER],
  navigate = vi.fn(),
) {
  render(
    <AccountsView
      accounts={accounts}
      ownAccountId={EIGENER.id}
      currentAccountId={EIGENER.id}
      navigate={navigate}
    />,
  );
  return navigate;
}

describe("AccountsView (req-025)", () => {
  it("listet die Bereiche mit Personenzahl und Zugangsstatus", async () => {
    zeige();

    const liste = screen.getByRole("region", { name: "Bereiche" });
    expect(within(liste).getByText("Familie Huber")).toBeInTheDocument();
    expect(
      within(liste).getByText(/1 Person · Anna Huber/),
    ).toBeInTheDocument();
    expect(within(liste).getByText("Nicht eingeladen")).toBeInTheDocument();
  });

  it("legt einen Bereich samt erster Person an und zeigt ihn in der Liste", async () => {
    const user = userEvent.setup();
    const angelegt: AccountOverview = {
      ...HUBER,
      id: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
    };
    const fetchMock = antwortet(201, { account: angelegt });
    vi.stubGlobal("fetch", fetchMock);
    zeige([EIGENER]);

    await user.click(screen.getByRole("button", { name: "Neuer Bereich" }));
    const formular = screen.getByRole("form", { name: "Neuer Bereich" });
    await user.type(
      within(formular).getByLabelText("Name des Bereichs"),
      "Familie Huber",
    );
    await user.type(
      within(formular).getByLabelText("Erste Person"),
      "Anna Huber",
    );
    await user.type(
      within(formular).getByLabelText("E-Mail-Adresse"),
      "anna@huber.de",
    );
    await user.click(
      within(formular).getByRole("button", { name: "Bereich anlegen" }),
    );

    await waitFor(() =>
      expect(screen.getByText("Familie Huber")).toBeInTheDocument(),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      ACCOUNTS_API,
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("benennt die Stelle, wenn eine Angabe fehlt, und schickt nichts ab", async () => {
    const user = userEvent.setup();
    const fetchMock = antwortet(201, {});
    vi.stubGlobal("fetch", fetchMock);
    zeige([EIGENER]);

    await user.click(screen.getByRole("button", { name: "Neuer Bereich" }));
    const formular = screen.getByRole("form", { name: "Neuer Bereich" });
    await user.click(
      within(formular).getByRole("button", { name: "Bereich anlegen" }),
    );

    expect(
      within(formular).getByText(ACCOUNT_ERRORS.nameRequired),
    ).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("wechselt in einen fremden Bereich und oeffnet den Planer", async () => {
    const user = userEvent.setup();
    const fetchMock = antwortet(200, { status: "ok" });
    vi.stubGlobal("fetch", fetchMock);
    const navigate = zeige();

    await user.click(
      screen.getByRole("button", {
        name: "In den Bereich wechseln: Familie Huber",
      }),
    );

    expect(fetchMock).toHaveBeenCalledWith(
      ACCOUNT_SWITCH_API,
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ accountId: HUBER.id }),
      }),
    );
    await waitFor(() => expect(navigate).toHaveBeenCalledWith(PLANNER_PATH));
  });

  it("bietet den gerade geoeffneten Bereich nicht zum Wechseln an", () => {
    zeige();

    expect(
      screen.getByRole("button", {
        name: "In den Bereich wechseln: Uwe Kremmel",
      }),
    ).toBeDisabled();
  });

  it("zeigt den Zugangslink der ersten Person", async () => {
    const user = userEvent.setup();
    const url = "https://dev.wegfara.com/einladung?token=abc";
    const fetchMock = antwortet(201, {
      invitation: {
        participantId: HUBER.firstPerson!.id,
        url,
        qr: qrCodeFor(url),
        expiresAt: "2026-09-10T12:00:00.000Z",
      },
    });
    vi.stubGlobal("fetch", fetchMock);
    zeige();

    await user.click(
      screen.getByRole("button", { name: "Einladen: Anna Huber" }),
    );

    await waitFor(() =>
      expect(screen.getByTestId("invitation-link")).toHaveTextContent(url),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      ACCOUNT_INVITATION_API,
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ accountId: HUBER.id }),
      }),
    );
    // Erzeugt heisst noch nicht eingeloest -- Zugang hat die Person erst
    // danach (req-023).
    expect(screen.getByText("Eingeladen")).toBeInTheDocument();
  });

  it("weist hin, wenn sich keine Einladung erzeugen liess", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", antwortet(500, {}));
    zeige();

    await user.click(
      screen.getByRole("button", { name: "Einladen: Anna Huber" }),
    );

    await waitFor(() =>
      expect(screen.getByTestId("account-notice")).toBeInTheDocument(),
    );
  });
});

/**
 * Die Seite heisst seit req-036 "Verwaltung", und was sie verwaltet, heisst
 * "Bereich" -- das Wort "Account" steht nirgends mehr in der Oberflaeche.
 * Adressen, Datenmodell und Bezeichner im Quelltext bleiben unveraendert.
 */
describe("AccountsView -- Verwaltung statt Account (req-036)", () => {
  it('ueberschreibt die Seite mit "Verwaltung"', () => {
    zeige();

    expect(
      screen.getByRole("heading", { level: 1, name: "Verwaltung" }),
    ).toBeInTheDocument();
  });

  it('nennt bei jedem Eintrag "In den Bereich wechseln"', () => {
    zeige();

    for (const name of ["Uwe Kremmel", "Familie Huber"]) {
      expect(
        screen.getByRole("button", {
          name: `In den Bereich wechseln: ${name}`,
        }),
      ).toBeInTheDocument();
    }
  });

  it('kennzeichnet den eigenen Eintrag als "Mein Bereich"', () => {
    zeige();

    expect(screen.getByText("Mein Bereich")).toBeInTheDocument();
  });

  it('nennt die Schaltflaeche zum Anlegen "Neuer Bereich"', async () => {
    const user = userEvent.setup();
    zeige([EIGENER]);

    await user.click(screen.getByRole("button", { name: "Neuer Bereich" }));

    const formular = screen.getByRole("form", { name: "Neuer Bereich" });
    expect(
      within(formular).getByLabelText("Name des Bereichs"),
    ).toBeInTheDocument();
  });

  it('zeigt das Wort "Account" nirgends', async () => {
    const user = userEvent.setup();
    zeige([EIGENER]);

    await user.click(screen.getByRole("button", { name: "Neuer Bereich" }));

    expect(document.body).not.toHaveTextContent("Account");
  });
});
