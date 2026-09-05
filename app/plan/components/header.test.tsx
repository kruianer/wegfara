import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Trip } from "@/lib/trips/types";
import { ACCOUNTS_PATH } from "@/lib/accounts/paths";
import { MEIN_BEREICH_PATH } from "@/lib/auth/paths";
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

/**
 * Das Aufklappmenue ist ein Dialog ueber der Ansicht -- und muss deshalb
 * auch daneben wieder wegzubekommen sein (bug-018). Blieb es stehen,
 * verdeckte es die Reisedetails, in die "Neue Reise" fuehrt (req-033).
 */
describe("Kopfbereich des Planers -- Aufklappmenü schließen (bug-018)", () => {
  async function oeffneReiseliste() {
    const user = userEvent.setup();
    zeige(false);
    await user.click(
      screen.getByRole("button", { name: /^Süditalien Rundreise/ }),
    );
    expect(
      screen.getByRole("dialog", { name: "Reise wählen" }),
    ).toBeInTheDocument();
    return user;
  }

  it("schließt es beim Tippen daneben", async () => {
    const user = await oeffneReiseliste();

    await user.click(screen.getByRole("button", { name: "POIs" }));

    expect(screen.queryAllByRole("dialog")).toHaveLength(0);
  });

  it("schließt es mit der Escape-Taste", async () => {
    const user = await oeffneReiseliste();

    await user.keyboard("{Escape}");

    expect(screen.queryAllByRole("dialog")).toHaveLength(0);
  });

  it("lässt es beim Tippen darin offen", async () => {
    const user = await oeffneReiseliste();

    await user.click(screen.getByLabelText("Zustand: Süditalien Rundreise"));

    expect(
      screen.getByRole("dialog", { name: "Reise wählen" }),
    ).toBeInTheDocument();
  });

  it("reicht das Tippen daneben an die Ansicht darunter weiter", async () => {
    const onSelectArea = vi.fn();
    const user = userEvent.setup();
    render(
      <Header
        trips={[SUEDITALIEN]}
        selectedTrip={SUEDITALIEN}
        today={HEUTE}
        activeArea="pois"
        onSelectTrip={vi.fn()}
        onSelectArea={onSelectArea}
        onCreateTrip={vi.fn()}
        onOpenTripDetails={vi.fn()}
      />,
    );
    await user.click(
      screen.getByRole("button", { name: /^Süditalien Rundreise/ }),
    );

    await user.click(screen.getByRole("button", { name: "Reisedetails" }));

    expect(onSelectArea).toHaveBeenCalledWith("reisedetails");
    expect(screen.queryAllByRole("dialog")).toHaveLength(0);
  });
});

/**
 * "Mein Bereich" (req-043) steht neben den Bereichen der Reise, ist aber
 * keiner von ihnen: er liegt auf einer eigenen Seite und ist von dort auch
 * aus dem Begleiter erreichbar. Im Kopfbereich erscheint er deshalb -- wie
 * die "Verwaltung" (req-025) -- als Verweis.
 */
describe('Kopfbereich des Planers -- "Mein Bereich" (req-043)', () => {
  it("zeigt ihn jeder angemeldeten Person als Verweis", () => {
    zeige(false);

    expect(screen.getByRole("link", { name: "Mein Bereich" })).toHaveAttribute(
      "href",
      MEIN_BEREICH_PATH,
    );
  });

  it('stellt ihn vor die "Verwaltung" des Gesamt-Admins', () => {
    zeige(true);

    const nav = screen.getByRole("navigation", { name: "Planer-Bereiche" });
    const beschriftungen = Array.from(nav.children).map(
      (element) => element.textContent,
    );
    expect(beschriftungen.slice(-2)).toEqual(["Mein Bereich", "Verwaltung"]);
  });

  it('kennt die Bereiche "Konto" und "Nutzer" nicht mehr', () => {
    zeige(true);

    const nav = screen.getByRole("navigation", { name: "Planer-Bereiche" });
    expect(nav).not.toHaveTextContent("Konto");
    expect(nav).not.toHaveTextContent("Nutzer");
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
