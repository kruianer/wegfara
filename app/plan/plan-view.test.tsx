import { beforeEach, describe, expect, it } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PlanView } from "./plan-view";
import { DEMO_TRIPS } from "@/tests/fixtures/demo-trips";

const TODAY = "2026-07-20";

function setWindowWidth(width: number) {
  Object.defineProperty(window, "innerWidth", {
    writable: true,
    configurable: true,
    value: width,
  });
}

describe("PlanView", () => {
  beforeEach(() => {
    setWindowWidth(1440);
  });

  it('zeigt die Wortmarke "Wegfara" im Kopfbereich', () => {
    render(<PlanView trips={DEMO_TRIPS} today={TODAY} />);

    expect(
      within(screen.getByRole("banner")).getByText("Wegfara"),
    ).toBeInTheDocument();
  });

  it("zeigt genau sechs Bereichsschaltflächen", () => {
    render(<PlanView trips={DEMO_TRIPS} today={TODAY} />);

    const nav = screen.getByRole("navigation", { name: "Planer-Bereiche" });
    expect(within(nav).getAllByRole("button")).toHaveLength(6);
  });

  it('hebt "POIs" als aktiven Bereich hervor', () => {
    render(<PlanView trips={DEMO_TRIPS} today={TODAY} />);

    expect(screen.getByRole("button", { name: "POIs" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("zeigt die laufende Reise im Kopfbereich", () => {
    render(<PlanView trips={DEMO_TRIPS} today="2026-10-10" />);

    expect(screen.getByRole("banner")).toHaveTextContent("Wien Städtereise");
  });

  it("öffnet beim Klick auf den Reisenamen eine Liste mit genau drei Reisen", async () => {
    const user = userEvent.setup();
    render(<PlanView trips={DEMO_TRIPS} today={TODAY} />);

    await user.click(screen.getByText("Süditalien Rundreise"));

    const dialog = screen.getByRole("dialog", { name: "Reise wählen" });
    expect(within(dialog).getAllByRole("button")).toHaveLength(3);
  });

  it('zeigt "Süditalien Rundreise" im Kopfbereich nach Auswahl in der Reiseliste', async () => {
    const user = userEvent.setup();
    render(<PlanView trips={DEMO_TRIPS} today="2026-10-10" />);

    await user.click(screen.getByText("Wien Städtereise"));
    const dialog = screen.getByRole("dialog", { name: "Reise wählen" });
    await user.click(within(dialog).getByText("Süditalien Rundreise"));

    expect(screen.getByRole("banner")).toHaveTextContent(
      "Süditalien Rundreise",
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("verbreitert die linke Fläche beim Ziehen des Trenners um 200 Pixel", () => {
    render(<PlanView trips={DEMO_TRIPS} today={TODAY} />);

    const leftPane = screen.getByTestId("split-pane-left");
    const initialWidth = parseFloat(leftPane.style.width);
    const separator = screen.getByRole("separator", {
      name: "Spaltenbreite anpassen",
    });

    fireEvent.mouseDown(separator, { clientX: 0 });
    fireEvent.mouseMove(window, { clientX: 200 });
    fireEvent.mouseUp(window);

    expect(parseFloat(leftPane.style.width)).toBe(initialWidth + 200);
  });

  it("zeigt bei einem 800 Pixel breiten Fenster einen Hinweis auf die benötigte Bildschirmbreite", () => {
    setWindowWidth(800);
    render(<PlanView trips={DEMO_TRIPS} today={TODAY} />);

    expect(screen.getByText(/breiteren Bildschirm/i)).toBeInTheDocument();
    expect(screen.getByText("Begleiter")).toBeInTheDocument();
    expect(screen.queryByRole("banner")).not.toBeInTheDocument();
  });

  it('wechselt beim Klick auf "Kosten" die Ansicht nicht', async () => {
    const user = userEvent.setup();
    render(<PlanView trips={DEMO_TRIPS} today={TODAY} />);

    await user.click(screen.getByRole("button", { name: "Kosten" }));

    expect(screen.getByRole("button", { name: "POIs" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByTestId("split-pane-left")).toBeInTheDocument();
  });

  it("zeigt im Kopfbereich keine Teilnehmer-Avatare", () => {
    render(<PlanView trips={DEMO_TRIPS} today={TODAY} />);

    expect(
      within(screen.getByRole("banner")).queryAllByRole("img"),
    ).toHaveLength(0);
  });
});
