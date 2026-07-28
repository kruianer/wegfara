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
          activity({
            id: "a",
            title: "Erster",
            startAt: "2026-07-18T09:00",
            endAt: "2026-07-18T10:00",
          }),
          activity({
            id: "b",
            title: "Zweiter",
            startAt: "2026-07-18T10:30",
            endAt: "2026-07-18T11:30",
          }),
          activity({
            id: "c",
            title: "Dritter",
            startAt: "2026-07-18T12:00",
            endAt: "2026-07-18T13:00",
          }),
          activity({
            id: "d",
            title: "Vierter",
            startAt: "2026-07-18T13:30",
            endAt: "2026-07-18T14:30",
          }),
        ]}
      />,
    );

    expect(screen.getAllByRole("listitem")).toHaveLength(4);
  });

  it("nummeriert den ersten Programmpunkt mit 1", () => {
    render(
      <Timeline
        activities={[
          activity({
            id: "a",
            title: "Erster",
            startAt: "2026-07-18T09:00",
            endAt: "2026-07-18T10:00",
          }),
          activity({
            id: "b",
            title: "Zweiter",
            startAt: "2026-07-18T10:30",
            endAt: "2026-07-18T11:30",
          }),
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

  it("fasst drei zeitgleiche Programmpunkte zu einer Gruppe an einer Stelle zusammen", () => {
    render(
      <Timeline
        activities={[
          activity({
            id: "a",
            startAt: "2026-07-18T13:30",
            endAt: "2026-07-18T15:00",
          }),
          activity({
            id: "b",
            startAt: "2026-07-18T13:30",
            endAt: "2026-07-18T15:00",
          }),
          activity({
            id: "c",
            startAt: "2026-07-18T13:30",
            endAt: "2026-07-18T15:00",
          }),
        ]}
      />,
    );

    expect(screen.getAllByRole("listitem")).toHaveLength(1);
    expect(screen.getByText("3 OPTIONEN · 13:30 – 15:00")).toBeInTheDocument();
  });

  it("kennzeichnet die erste Alternative als gewaehlt, solange nie gewaehlt wurde", () => {
    render(
      <Timeline
        activities={[
          activity({
            id: "a",
            title: "Erste Option",
            startAt: "2026-07-18T13:30",
            endAt: "2026-07-18T15:00",
          }),
          activity({
            id: "b",
            title: "Zweite Option",
            startAt: "2026-07-18T13:30",
            endAt: "2026-07-18T15:00",
          }),
        ]}
      />,
    );

    expect(screen.getAllByText("✓ Gewählt")).toHaveLength(1);
    expect(screen.getByText("Erste Option")).toBeInTheDocument();
  });

  it("uebernimmt eine gespeicherte Wahl fuer die Gruppe", () => {
    render(
      <Timeline
        activities={[
          activity({
            id: "a",
            title: "Erste Option",
            startAt: "2026-07-18T13:30",
            endAt: "2026-07-18T15:00",
          }),
          activity({
            id: "b",
            title: "Zweite Option",
            startAt: "2026-07-18T13:30",
            endAt: "2026-07-18T15:00",
          }),
        ]}
        optionSelections={{ "trip-1|2026-07-18T13:30|2026-07-18T15:00": "b" }}
      />,
    );

    const secondCard = screen
      .getByText("Zweite Option")
      .closest("div")?.parentElement;
    expect(secondCard).not.toBeNull();
    expect(
      within(secondCard as HTMLElement).queryByText("✓ Gewählt"),
    ).toBeInTheDocument();
  });

  it("gruppiert Programmpunkte NICHT, wenn nur der Beginn uebereinstimmt, aber nicht das Ende", () => {
    render(
      <Timeline
        activities={[
          activity({
            id: "a",
            startAt: "2026-07-18T18:00",
            endAt: "2026-07-18T18:30",
          }),
          activity({
            id: "b",
            startAt: "2026-07-18T18:00",
            endAt: "2026-07-18T20:00",
          }),
        ]}
      />,
    );

    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(screen.queryByText(/OPTIONEN/)).not.toBeInTheDocument();
  });

  it("zaehlt eine Gruppe als einen Programmpunkt des Tages und nummeriert sie durch", () => {
    render(
      <Timeline
        activities={[
          activity({
            id: "vorher",
            startAt: "2026-07-18T09:00",
            endAt: "2026-07-18T10:00",
          }),
          activity({
            id: "a",
            startAt: "2026-07-18T13:30",
            endAt: "2026-07-18T15:00",
          }),
          activity({
            id: "b",
            startAt: "2026-07-18T13:30",
            endAt: "2026-07-18T15:00",
          }),
          activity({
            id: "c",
            startAt: "2026-07-18T13:30",
            endAt: "2026-07-18T15:00",
          }),
        ]}
      />,
    );

    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(within(items[0]).getByText("1")).toBeInTheDocument();
    expect(within(items[1]).getByText("2")).toBeInTheDocument();
  });
});
