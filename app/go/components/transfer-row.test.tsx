import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { TransferRow } from "./transfer-row";
import type { Transfer } from "@/lib/transfers/types";
import type { Activity } from "@/lib/activities/types";

function transfer(overrides: Partial<Transfer> = {}): Transfer {
  return {
    id: "t1",
    tripId: "trip-1",
    fromActivityId: "a",
    toActivityId: "b",
    mode: "auto",
    title: "Fahrt zum Aussichtspunkt",
    durationMin: 12,
    distanceKm: 4.2,
    ...overrides,
  };
}

function activity(overrides: Partial<Activity> = {}): Activity {
  return {
    id: "b",
    tripId: "trip-1",
    type: "sehenswuerdigkeit",
    title: "Zielpunkt",
    shortText: "Kurztext",
    longText: "Langtext",
    startAt: "2026-07-18T15:00",
    endAt: "2026-07-18T16:30",
    position: { lat: 40.627, lng: 14.597 },
    ...overrides,
  };
}

describe("TransferRow", () => {
  it('zeigt Dauer und Distanz als "12 Min · 4,2 km"', () => {
    render(<TransferRow transfer={transfer()} toActivity={activity()} />);
    expect(screen.getByText("12 Min · 4,2 km")).toBeInTheDocument();
  });

  it("zeigt fuer das Verkehrsmittel Boot ein Boot-Symbol", () => {
    render(
      <TransferRow
        transfer={transfer({ mode: "boot" })}
        toActivity={activity()}
      />,
    );
    expect(screen.getByRole("img", { name: "Boot" })).toBeInTheDocument();
  });

  it("zeigt fuer das Verkehrsmittel Flug ein Flugzeug-Symbol (req-018)", () => {
    render(
      <TransferRow
        transfer={transfer({ mode: "flug" })}
        toActivity={activity()}
      />,
    );
    expect(screen.getByRole("img", { name: "Flug" })).toBeInTheDocument();
  });

  it("zeigt fuer das Verkehrsmittel Bahn ein Zug-Symbol (req-018)", () => {
    render(
      <TransferRow
        transfer={transfer({ mode: "bahn" })}
        toActivity={activity()}
      />,
    );
    expect(screen.getByRole("img", { name: "Bahn" })).toBeInTheDocument();
  });

  it("zeigt fuer das Verkehrsmittel Fähre ein Fähren-Symbol (req-018)", () => {
    render(
      <TransferRow
        transfer={transfer({ mode: "faehre" })}
        toActivity={activity()}
      />,
    );
    expect(screen.getByRole("img", { name: "Fähre" })).toBeInTheDocument();
  });

  it("stellt einen Transfer per Auto unveraendert dar (req-018)", () => {
    render(
      <TransferRow
        transfer={transfer({ mode: "auto" })}
        toActivity={activity()}
      />,
    );

    expect(screen.getByRole("img", { name: "Auto" })).toBeInTheDocument();
    expect(screen.getByText("Fahrt zum Aussichtspunkt")).toBeInTheDocument();
    expect(screen.getByText("12 Min · 4,2 km")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Route" })).toHaveAttribute(
      "href",
      "https://www.google.com/maps/dir/?api=1&destination=40.627,14.597&travelmode=driving",
    );
  });

  it('nutzt fuer einen Flug den OEPNV-Modus der Navigation, da Google Maps kein Verkehrsmittel "Flug" kennt', () => {
    render(
      <TransferRow
        transfer={transfer({ mode: "flug" })}
        toActivity={activity()}
      />,
    );

    expect(screen.getByRole("link", { name: "Route" })).toHaveAttribute(
      "href",
      "https://www.google.com/maps/dir/?api=1&destination=40.627,14.597&travelmode=transit",
    );
  });

  it('oeffnet "Route" als Link zur Navigation in einem neuen Fenster, wenn der Zielpunkt eine Position hat', () => {
    render(
      <TransferRow
        transfer={transfer({ mode: "auto" })}
        toActivity={activity({ position: { lat: 40.627, lng: 14.597 } })}
      />,
    );

    const link = screen.getByRole("link", { name: "Route" });
    expect(link).toHaveAttribute(
      "href",
      "https://www.google.com/maps/dir/?api=1&destination=40.627,14.597&travelmode=driving",
    );
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it('zeigt KEINE Schaltflaeche "Route", wenn der Zielpunkt keine Position hat', () => {
    render(
      <TransferRow
        transfer={transfer()}
        toActivity={activity({ position: undefined })}
      />,
    );

    expect(
      screen.queryByRole("link", { name: "Route" }),
    ).not.toBeInTheDocument();
  });
});
