import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Timeline } from "./timeline";
import type { Activity } from "@/lib/activities/types";

function activity(overrides: Partial<Activity> & { id: string }): Activity {
  return {
    tripId: "trip-1",
    type: "sehenswuerdigkeit",
    title: "Dom von Amalfi",
    shortText: "Kurztext",
    longText: "Der ausfuehrliche Text zum Programmpunkt.",
    startAt: "2026-07-18T10:00",
    endAt: "2026-07-18T12:30",
    position: { lat: 40.6343, lng: 14.6027 },
    ...overrides,
  };
}

describe("Timeline", () => {
  it("zeigt genau so viele Programmpunkte wie uebergeben", () => {
    render(
      <Timeline
        activities={[
          activity({ id: "a", title: "Erster" }),
          activity({ id: "b", title: "Zweiter" }),
          activity({ id: "c", title: "Dritter" }),
          activity({ id: "d", title: "Vierter" }),
        ]}
      />,
    );

    expect(screen.getAllByRole("listitem")).toHaveLength(4);
  });

  it("nummeriert den ersten Programmpunkt mit 1", () => {
    render(
      <Timeline
        activities={[
          activity({ id: "a", title: "Erster" }),
          activity({ id: "b", title: "Zweiter" }),
        ]}
      />,
    );

    const items = screen.getAllByRole("listitem");
    expect(within(items[0]).getByText("1")).toBeInTheDocument();
    expect(within(items[1]).getByText("2")).toBeInTheDocument();
  });

  it("beginnt die Nummerierung fuer jeden uebergebenen Tag wieder bei 1", () => {
    const { rerender } = render(
      <Timeline activities={[activity({ id: "day1-a" })]} />,
    );
    expect(
      within(screen.getAllByRole("listitem")[0]).getByText("1"),
    ).toBeInTheDocument();

    rerender(
      <Timeline
        activities={[activity({ id: "day2-a", title: "Anderer Tag" })]}
      />,
    );
    expect(
      within(screen.getAllByRole("listitem")[0]).getByText("1"),
    ).toBeInTheDocument();
  });

  it("zeigt den Typ-Chip eines Restaurants in der Farbe #e0603e", () => {
    render(
      <Timeline activities={[activity({ id: "a", type: "restaurant" })]} />,
    );

    expect(screen.getByText("Restaurant")).toHaveStyle({
      backgroundColor: "#e0603e",
    });
  });

  it('zeigt Beginn- und Endzeit als "10:00 – 12:30"', () => {
    render(
      <Timeline
        activities={[
          activity({
            id: "a",
            startAt: "2026-07-18T10:00",
            endAt: "2026-07-18T12:30",
          }),
        ]}
      />,
    );

    expect(screen.getByText("10:00 – 12:30")).toBeInTheDocument();
  });

  it('zeigt den ausfuehrlichen Text erst nach Klick auf "Mehr lesen"', async () => {
    const user = userEvent.setup();
    render(<Timeline activities={[activity({ id: "a" })]} />);

    expect(
      screen.queryByText("Der ausfuehrliche Text zum Programmpunkt."),
    ).not.toBeInTheDocument();

    await user.click(screen.getByText("Mehr lesen"));

    expect(
      screen.getByText("Der ausfuehrliche Text zum Programmpunkt."),
    ).toBeInTheDocument();
  });

  it('verbirgt den ausfuehrlichen Text wieder nach Klick auf "Weniger anzeigen"', async () => {
    const user = userEvent.setup();
    render(<Timeline activities={[activity({ id: "a" })]} />);

    await user.click(screen.getByText("Mehr lesen"));
    await user.click(screen.getByText("Weniger anzeigen"));

    expect(
      screen.queryByText("Der ausfuehrliche Text zum Programmpunkt."),
    ).not.toBeInTheDocument();
  });

  it('zeigt "Noch nichts geplant", wenn keine Programmpunkte vorhanden sind', () => {
    render(<Timeline activities={[]} />);
    expect(screen.getByText("Noch nichts geplant")).toBeInTheDocument();
  });

  it("zeigt kein Foto zu einem Programmpunkt", () => {
    render(<Timeline activities={[activity({ id: "a" })]} />);
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });
});
