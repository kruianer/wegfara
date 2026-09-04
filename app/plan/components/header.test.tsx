import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Trip } from "@/lib/trips/types";
import { ACCOUNTS_PATH } from "@/lib/accounts/paths";
import { Header } from "./header";

const SUEDITALIEN: Trip = {
  id: "d5fda5ea-65e7-4b47-8096-62618599a288",
  title: "Süditalien Rundreise",
  startDate: "2026-07-18",
  endDate: "2026-07-23",
  mainPlace: { name: "Amalfi", lat: 40.634, lng: 14.6027 },
  description: "",
  state: "in_planung",
};

const HEUTE = new Date(2026, 6, 1);

function zeige(superAdmin: boolean) {
  render(
    <Header
      trips={[SUEDITALIEN]}
      selectedTrip={SUEDITALIEN}
      today={HEUTE}
      activeArea="pois"
      superAdmin={superAdmin}
      onSelectTrip={vi.fn()}
      onSelectArea={vi.fn()}
      onCreateTrip={vi.fn()}
      onOpenTripDetails={vi.fn()}
    />,
  );
}

describe("Kopfbereich des Planers -- Verwaltung (req-025, req-036)", () => {
  it('zeigt dem Gesamt-Admin den Bereich "Verwaltung"', () => {
    zeige(true);

    const bereich = screen.getByRole("link", { name: "Verwaltung" });
    expect(bereich).toHaveAttribute("href", ACCOUNTS_PATH);
  });

  it("zeigt ihn einer gewoehnlichen Person nicht", () => {
    zeige(false);

    expect(
      screen.queryByRole("link", { name: "Verwaltung" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Verwaltung")).not.toBeInTheDocument();
  });

  it("laesst die uebrigen Bereiche unveraendert", () => {
    zeige(false);

    const nav = screen.getByRole("navigation", { name: "Planer-Bereiche" });
    expect(screen.getByRole("button", { name: "POIs" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Reisedetails" }),
    ).toBeInTheDocument();
    expect(nav).toBeInTheDocument();
  });
});

/**
 * Der Zustand steht weiterhin im Aufklappmenue am Reisenamen -- seit
 * req-033 aber nur noch zum Ansehen. Gesetzt wird er in den Reisedetails.
 */
describe("Kopfbereich des Planers -- Aufklappmenü (req-033)", () => {
  async function oeffneReiseliste() {
    const user = userEvent.setup();
    zeige(false);
    await user.click(
      screen.getByRole("button", { name: /^Süditalien Rundreise/ }),
    );
    return screen.getByRole("dialog", { name: "Reise wählen" });
  }

  it("zeigt den Zustand jeder Reise", async () => {
    const menue = await oeffneReiseliste();

    expect(
      within(menue).getByLabelText("Zustand: Süditalien Rundreise"),
    ).toHaveTextContent("In Planung");
  });

  it("lässt ihn dort NICHT ändern", async () => {
    const menue = await oeffneReiseliste();

    expect(within(menue).queryAllByRole("combobox")).toHaveLength(0);
  });

  it("führt statt zum Formular in die Reisedetails", async () => {
    const menue = await oeffneReiseliste();

    expect(
      within(menue).getByRole("button", {
        name: "Reisedetails: Süditalien Rundreise",
      }),
    ).toBeInTheDocument();
    expect(
      within(menue).queryByRole("button", {
        name: "Reise ändern: Süditalien Rundreise",
      }),
    ).toBeNull();
  });

  it("bietet dort kein Löschen mehr an -- das steht in den Reisedetails", async () => {
    const menue = await oeffneReiseliste();

    expect(
      within(menue).queryByRole("button", {
        name: "Reise löschen: Süditalien Rundreise",
      }),
    ).toBeNull();
  });
});

describe('Kopfbereich des Planers -- Bereich "Mein Bereich" (req-032, req-036)', () => {
  it("zeigt ihn jeder angemeldeten Person", () => {
    zeige(false);

    expect(
      screen.getByRole("button", { name: "Mein Bereich" }),
    ).toBeInTheDocument();
  });

  it('stellt ihn vor die "Verwaltung" des Gesamt-Admins', () => {
    zeige(true);

    const nav = screen.getByRole("navigation", { name: "Planer-Bereiche" });
    const beschriftungen = Array.from(nav.children).map(
      (element) => element.textContent,
    );
    expect(beschriftungen.slice(-2)).toEqual(["Mein Bereich", "Verwaltung"]);
  });
});

/**
 * Das Wort "Account" verschwindet mit req-036 aus dem Kopfbereich -- beide
 * Bereiche hiessen zuvor so und waren beim Lesen nicht zu unterscheiden.
 */
describe("Kopfbereich des Planers -- kein „Account“ mehr (req-036)", () => {
  it("nennt beim Gesamt-Admin nirgends „Account“", () => {
    zeige(true);

    expect(
      screen.getByRole("navigation", { name: "Planer-Bereiche" }),
    ).not.toHaveTextContent("Account");
  });

  it("nennt bei einer gewoehnlichen Person nirgends „Account“", () => {
    zeige(false);

    expect(
      screen.getByRole("navigation", { name: "Planer-Bereiche" }),
    ).not.toHaveTextContent("Account");
  });
});
