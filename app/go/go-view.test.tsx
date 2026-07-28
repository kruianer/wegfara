import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { GoView } from "./go-view";
import { DEMO_TRIPS } from "@/tests/fixtures/demo-trips";

const TODAY = "2026-07-20";

describe("GoView", () => {
  it("zeigt die aktuell aktive Reise im Kopfbereich", () => {
    render(<GoView trips={DEMO_TRIPS} today={TODAY} />);
    expect(screen.getByText("Süditalien Rundreise")).toBeInTheDocument();
  });

  it("zeigt den Zeitraum der geoeffneten Reise im Kopfbereich", () => {
    render(<GoView trips={DEMO_TRIPS} today={TODAY} />);
    expect(screen.getByText("18. – 23. Juli 2026")).toBeInTheDocument();
  });

  it("oeffnet beim Klick auf den Reisetitel eine Liste mit genau drei Reisen", async () => {
    const user = userEvent.setup();
    render(<GoView trips={DEMO_TRIPS} today={TODAY} />);

    await user.click(screen.getByText("Süditalien Rundreise"));

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getAllByRole("button")).toHaveLength(3);
  });

  it('kennzeichnet eine noch nicht begonnene Reise als "Geplant"', async () => {
    const user = userEvent.setup();
    render(<GoView trips={DEMO_TRIPS} today={TODAY} />);

    await user.click(screen.getByText("Süditalien Rundreise"));

    const dialog = screen.getByRole("dialog");
    const wienItem = within(dialog)
      .getByText("Wien Städtereise")
      .closest("button");
    expect(wienItem).not.toBeNull();
    expect(
      within(wienItem as HTMLElement).getByText("Geplant"),
    ).toBeInTheDocument();
  });

  it("oeffnet die gewaehlte Reise nach Auswahl in der Liste", async () => {
    const user = userEvent.setup();
    render(<GoView trips={DEMO_TRIPS} today={TODAY} />);

    await user.click(screen.getByText("Süditalien Rundreise"));
    const dialog = screen.getByRole("dialog");
    await user.click(within(dialog).getByText("Wien Städtereise"));

    expect(screen.getByRole("banner")).toHaveTextContent("Wien Städtereise");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("zeigt fuer die dreitaegige Wien-Reise genau drei Eintraege in der Tagesauswahl", async () => {
    const user = userEvent.setup();
    render(<GoView trips={DEMO_TRIPS} today={TODAY} />);

    await user.click(screen.getByText("Süditalien Rundreise"));
    await user.click(screen.getByText("Wien Städtereise"));

    expect(screen.getAllByRole("tab")).toHaveLength(3);
  });

  it("markiert den heutigen Tag in der Tagesauswahl als gewaehlt", () => {
    render(<GoView trips={DEMO_TRIPS} today={TODAY} />);

    const selectedTab = screen.getByRole("tab", { selected: true });
    expect(selectedTab).toHaveTextContent("20.07.");
  });

  it("markiert einen angeklickten Tag als gewaehlt", async () => {
    const user = userEvent.setup();
    render(<GoView trips={DEMO_TRIPS} today={TODAY} />);

    const targetTab = screen.getByText("22.07.").closest("button")!;
    await user.click(targetTab);

    expect(targetTab).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { selected: true })).toBe(targetTab);
  });

  it("zeigt in der Tagesauswahl keine Ortsangabe", () => {
    render(<GoView trips={DEMO_TRIPS} today={TODAY} />);
    expect(screen.queryByText("Amalfi")).not.toBeInTheDocument();
  });

  it("zeigt im Kopfbereich keinen Hauptort", () => {
    render(<GoView trips={DEMO_TRIPS} today={TODAY} />);
    expect(screen.queryByText("Amalfi")).not.toBeInTheDocument();
  });

  it('wechselt die Ansicht nicht, wenn "Karte" angeklickt wird', async () => {
    const user = userEvent.setup();
    render(<GoView trips={DEMO_TRIPS} today={TODAY} />);

    const karteButton = screen.getByRole("button", { name: "Karte" });
    expect(karteButton).toBeDisabled();
    await user.click(karteButton);

    expect(screen.getByText("Süditalien Rundreise")).toBeInTheDocument();
  });
});
