import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ActivityCard } from "./activity-card";
import type { Activity } from "@/lib/activities/types";

function activity(overrides: Partial<Activity> = {}): Activity {
  return {
    id: "a",
    tripId: "trip-1",
    type: "sehenswuerdigkeit",
    title: "Dom von Amalfi",
    shortText: "Kurztext",
    longText: "Langtext",
    startAt: "2026-07-18T10:00",
    endAt: "2026-07-18T12:30",
    position: { lat: 40.6343, lng: 14.6027 },
    ...overrides,
  };
}

describe("ActivityCard – Buchungsstatus", () => {
  it('zeigt an einem gebuchten Programmpunkt die Schaltflaeche "Unterlagen" in --good', () => {
    render(<ActivityCard activity={activity({ booked: true })} />);

    const button = screen.getByText("Unterlagen");
    expect(button).toHaveStyle({ color: "var(--good)" });
  });

  it("zeigt an einem gebuchten Programmpunkt keine Schaltflaeche Buchen", () => {
    render(
      <ActivityCard
        activity={activity({
          booked: true,
          bookingUrl: "https://example.com/reservieren",
        })}
      />,
    );

    expect(screen.queryByText("Buchen")).not.toBeInTheDocument();
    expect(screen.getByText("Unterlagen")).toBeInTheDocument();
  });

  it('zeigt bei hinterlegter Webadresse "Buchen" als Link zur Webseite in einem neuen Fenster', () => {
    render(
      <ActivityCard
        activity={activity({
          bookingUrl: "https://example.com/reservieren",
        })}
      />,
    );

    const link = screen.getByRole("link", { name: /Buchen/ });
    expect(link).toHaveAttribute("href", "https://example.com/reservieren");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    expect(link).toHaveStyle({ color: "var(--acc)" });
  });

  it('zeigt bei ausschliesslich hinterlegter E-Mail-Adresse "Anfragen" als mailto-Link', () => {
    render(
      <ActivityCard
        activity={activity({ bookingEmail: "kontakt@example.com" })}
      />,
    );

    const link = screen.getByRole("link", { name: /Anfragen/ });
    expect(link).toHaveAttribute("href", "mailto:kontakt@example.com");
  });

  it('zeigt bei ausschliesslich hinterlegter Telefonnummer "Anrufen" als tel-Link', () => {
    render(
      <ActivityCard activity={activity({ bookingPhone: "+39 089 871483" })} />,
    );

    const link = screen.getByRole("link", { name: /Anrufen/ });
    expect(link).toHaveAttribute("href", "tel:+39 089 871483");
  });

  it('zeigt bei Webadresse UND Telefonnummer "Buchen"', () => {
    render(
      <ActivityCard
        activity={activity({
          bookingUrl: "https://example.com/reservieren",
          bookingPhone: "+39 089 871483",
        })}
      />,
    );

    expect(screen.getByRole("link", { name: /Buchen/ })).toBeInTheDocument();
    expect(screen.queryByText("Anrufen")).not.toBeInTheDocument();
  });

  it("zeigt ohne Buchung und ohne hinterlegten Kontaktweg keine Buchungs-Schaltflaeche", () => {
    render(<ActivityCard activity={activity()} />);

    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.queryByText("Buchen")).not.toBeInTheDocument();
    expect(screen.queryByText("Anfragen")).not.toBeInTheDocument();
    expect(screen.queryByText("Anrufen")).not.toBeInTheDocument();
    expect(screen.queryByText("Unterlagen")).not.toBeInTheDocument();
  });
});
