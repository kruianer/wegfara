import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ActivityOptionGroup } from "./activity-option-group";
import type { Activity } from "@/lib/activities/types";

function activity(overrides: Partial<Activity> & { id: string }): Activity {
  return {
    tripId: "trip-1",
    type: "aktivitaet",
    title: "Programmpunkt",
    shortText: "Kurztext",
    longText: "Langtext",
    startAt: "2026-07-21T13:30",
    endAt: "2026-07-21T15:00",
    position: { lat: 0, lng: 0 },
    ...overrides,
  };
}

const OPTIONS = [
  activity({ id: "a", title: "Erste Option" }),
  activity({ id: "b", title: "Zweite Option" }),
  activity({ id: "c", title: "Dritte Option" }),
];

describe("ActivityOptionGroup", () => {
  it('zeigt die Kopfzeile "3 OPTIONEN · 13:30 – 15:00"', () => {
    render(
      <ActivityOptionGroup
        activities={OPTIONS}
        selectedId="a"
        onSelect={() => {}}
      />,
    );

    expect(screen.getByText("3 OPTIONEN · 13:30 – 15:00")).toBeInTheDocument();
  });

  it("zeigt den Hinweis, dass durch Wischen gewaehlt wird", () => {
    render(
      <ActivityOptionGroup
        activities={OPTIONS}
        selectedId="a"
        onSelect={() => {}}
      />,
    );

    expect(screen.getByText("Zum Wählen wischen")).toBeInTheDocument();
  });

  it("kennzeichnet die uebergebene Auswahl als gewaehlt", () => {
    render(
      <ActivityOptionGroup
        activities={OPTIONS}
        selectedId="a"
        onSelect={() => {}}
      />,
    );

    expect(screen.getAllByText("✓ Gewählt")).toHaveLength(1);
  });

  it("zeigt fuer drei Alternativen genau drei Punkte im Indikator", () => {
    render(
      <ActivityOptionGroup
        activities={OPTIONS}
        selectedId="a"
        onSelect={() => {}}
      />,
    );

    expect(
      screen.getByRole("group", { name: "3 Optionen" }).children,
    ).toHaveLength(3);
  });

  it("meldet die zweite Alternative als Auswahl, wenn ihre Karte einrastet (Wischen)", () => {
    const onSelect = vi.fn();
    render(
      <ActivityOptionGroup
        activities={OPTIONS}
        selectedId="a"
        onSelect={onSelect}
      />,
    );

    const track = screen.getByRole("group", { name: "Optionen zum Wischen" });

    Object.defineProperty(track, "clientWidth", {
      value: 300,
      configurable: true,
    });
    Object.defineProperty(track, "scrollLeft", {
      value: 300,
      configurable: true,
    });
    track.dispatchEvent(new Event("scroll", { bubbles: true }));

    expect(onSelect).toHaveBeenCalledWith("b");
  });

  it("meldet die zweite Alternative als Auswahl, wenn ihr Punkt angeklickt wird", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(
      <ActivityOptionGroup
        activities={OPTIONS}
        selectedId="a"
        onSelect={onSelect}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Option 2 von 3" }));

    expect(onSelect).toHaveBeenCalledWith("b");
  });
});
