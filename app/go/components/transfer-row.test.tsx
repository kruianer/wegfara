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

function fromActivity(overrides: Partial<Activity> = {}): Activity {
  return {
    id: "a",
    tripId: "trip-1",
    type: "sehenswuerdigkeit",
    title: "Startpunkt",
    shortText: "Kurztext",
    longText: "Langtext",
    startAt: "2026-07-18T13:00",
    endAt: "2026-07-18T14:30",
    position: { lat: 40.6, lng: 14.5 },
    ...overrides,
  };
}

function toActivity(overrides: Partial<Activity> = {}): Activity {
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
    render(
      <TransferRow
        transfer={transfer()}
        fromActivity={fromActivity()}
        toActivity={toActivity()}
      />,
    );
    expect(screen.getByText("12 Min · 4,2 km")).toBeInTheDocument();
  });

  it("zeigt fuer das Verkehrsmittel Boot ein Boot-Symbol", () => {
    render(
      <TransferRow
        transfer={transfer({ mode: "boot" })}
        fromActivity={fromActivity()}
        toActivity={toActivity()}
      />,
    );
    expect(screen.getByRole("img", { name: "Boot" })).toBeInTheDocument();
  });

  it("zeigt fuer das Verkehrsmittel Flug ein Flugzeug-Symbol (req-018)", () => {
    render(
      <TransferRow
        transfer={transfer({ mode: "flug" })}
        fromActivity={fromActivity()}
        toActivity={toActivity()}
      />,
    );
    expect(screen.getByRole("img", { name: "Flug" })).toBeInTheDocument();
  });

  it("zeigt fuer das Verkehrsmittel Bahn ein Zug-Symbol (req-018)", () => {
    render(
      <TransferRow
        transfer={transfer({ mode: "bahn" })}
        fromActivity={fromActivity()}
        toActivity={toActivity()}
      />,
    );
    expect(screen.getByRole("img", { name: "Bahn" })).toBeInTheDocument();
  });

  it("zeigt fuer das Verkehrsmittel Fähre ein Fähren-Symbol (req-018)", () => {
    render(
      <TransferRow
        transfer={transfer({ mode: "faehre" })}
        fromActivity={fromActivity()}
        toActivity={toActivity()}
      />,
    );
    expect(screen.getByRole("img", { name: "Fähre" })).toBeInTheDocument();
  });

  it("stellt einen Transfer per Auto unveraendert dar (req-018)", () => {
    render(
      <TransferRow
        transfer={transfer({ mode: "auto" })}
        fromActivity={fromActivity()}
        toActivity={toActivity()}
      />,
    );

    expect(screen.getByRole("img", { name: "Auto" })).toBeInTheDocument();
    expect(screen.getByText("Fahrt zum Aussichtspunkt")).toBeInTheDocument();
    expect(screen.getByText("12 Min · 4,2 km")).toBeInTheDocument();
  });

  // bug-062: nicht am Reisetag ist der aktuelle Standort fuer die Fahrt
  // bedeutungslos -- der einzige Knopf zeigt die Route von Start zu Ziel.
  describe("nicht am Reisetag (Standard)", () => {
    it("zeigt genau einen Knopf mit der Route von Start zu Ziel", () => {
      render(
        <TransferRow
          transfer={transfer({ mode: "auto" })}
          fromActivity={fromActivity()}
          toActivity={toActivity()}
        />,
      );

      expect(screen.getByRole("link", { name: "Route" })).toHaveAttribute(
        "href",
        "https://www.google.com/maps/dir/?api=1&origin=40.6,14.5&destination=40.627,14.597&travelmode=driving",
      );
      expect(
        screen.queryByRole("link", { name: "Ab hier" }),
      ).not.toBeInTheDocument();
    });

    it('nutzt fuer einen Flug den OEPNV-Modus der Navigation, da Google Maps kein Verkehrsmittel "Flug" kennt', () => {
      render(
        <TransferRow
          transfer={transfer({ mode: "flug" })}
          fromActivity={fromActivity()}
          toActivity={toActivity()}
        />,
      );

      expect(screen.getByRole("link", { name: "Route" })).toHaveAttribute(
        "href",
        "https://www.google.com/maps/dir/?api=1&origin=40.6,14.5&destination=40.627,14.597&travelmode=transit",
      );
    });

    it('oeffnet "Route" als Link zur Navigation in einem neuen Fenster', () => {
      render(
        <TransferRow
          transfer={transfer({ mode: "auto" })}
          fromActivity={fromActivity()}
          toActivity={toActivity()}
        />,
      );

      const link = screen.getByRole("link", { name: "Route" });
      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute("rel", "noopener noreferrer");
    });

    it("setzt bei fehlender Position den Namen des Endes in den Link, statt den Knopf zu verstecken", () => {
      render(
        <TransferRow
          transfer={transfer()}
          fromActivity={fromActivity({ position: undefined })}
          toActivity={toActivity({ position: undefined })}
        />,
      );

      expect(screen.getByRole("link", { name: "Route" })).toHaveAttribute(
        "href",
        "https://www.google.com/maps/dir/?api=1&origin=Startpunkt&destination=Zielpunkt&travelmode=driving",
      );
    });
  });

  // bug-062: am Reisetag selbst ist "ab hier" der Regelfall -- unterwegs
  // zaehlt der aktuelle Standort, nicht der Ausgangspunkt des Transfers.
  describe("am Reisetag", () => {
    it('zeigt "Ab hier" und daneben die Route von Start zu Ziel', () => {
      render(
        <TransferRow
          transfer={transfer({ mode: "auto" })}
          fromActivity={fromActivity()}
          toActivity={toActivity()}
          isToday
        />,
      );

      expect(screen.getByRole("link", { name: "Ab hier" })).toHaveAttribute(
        "href",
        "https://www.google.com/maps/dir/?api=1&destination=40.627,14.597&travelmode=driving",
      );
      expect(screen.getByRole("link", { name: "Route" })).toHaveAttribute(
        "href",
        "https://www.google.com/maps/dir/?api=1&origin=40.6,14.5&destination=40.627,14.597&travelmode=driving",
      );
    });

    it("zeigt NUR die Route von Start zu Ziel, wenn der Zielpunkt keine Position hat", () => {
      render(
        <TransferRow
          transfer={transfer()}
          fromActivity={fromActivity()}
          toActivity={toActivity({ position: undefined })}
          isToday
        />,
      );

      expect(
        screen.queryByRole("link", { name: "Ab hier" }),
      ).not.toBeInTheDocument();
      expect(screen.getByRole("link", { name: "Route" })).toBeInTheDocument();
    });
  });
});
