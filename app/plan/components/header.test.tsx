import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { Trip } from "@/lib/trips/types";
import { ACCOUNTS_PATH } from "@/lib/accounts/paths";
import { Header } from "./header";

const SUEDITALIEN: Trip = {
  id: "d5fda5ea-65e7-4b47-8096-62618599a288",
  title: "Süditalien Rundreise",
  startDate: "2026-07-18",
  endDate: "2026-07-23",
  mainPlace: { name: "Amalfi", lat: 40.634, lng: 14.6027 },
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
      onEditTrip={vi.fn()}
      onDeleteTrip={vi.fn()}
      onTripStateChanged={vi.fn()}
    />,
  );
}

describe("Kopfbereich des Planers -- Account-Verwaltung (req-025)", () => {
  it("zeigt dem Gesamt-Admin den Bereich Account-Verwaltung", () => {
    zeige(true);

    const bereich = screen.getByRole("link", { name: "Account-Verwaltung" });
    expect(bereich).toHaveAttribute("href", ACCOUNTS_PATH);
  });

  it("zeigt ihn einer gewoehnlichen Person nicht", () => {
    zeige(false);

    expect(
      screen.queryByRole("link", { name: "Account-Verwaltung" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Account-Verwaltung")).not.toBeInTheDocument();
  });

  it("laesst die uebrigen Bereiche unveraendert", () => {
    zeige(false);

    const nav = screen.getByRole("navigation", { name: "Planer-Bereiche" });
    expect(screen.getByRole("button", { name: "POIs" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Einstellungen" }),
    ).toBeInTheDocument();
    expect(nav).toBeInTheDocument();
  });
});

describe("Kopfbereich des Planers -- Bereich Account (req-032)", () => {
  it("zeigt ihn jeder angemeldeten Person", () => {
    zeige(false);

    expect(screen.getByRole("button", { name: "Account" })).toBeInTheDocument();
  });

  it("stellt ihn vor die Account-Verwaltung des Gesamt-Admins", () => {
    zeige(true);

    const nav = screen.getByRole("navigation", { name: "Planer-Bereiche" });
    const beschriftungen = Array.from(nav.children).map(
      (element) => element.textContent,
    );
    expect(beschriftungen.slice(-2)).toEqual(["Account", "Account-Verwaltung"]);
  });
});
