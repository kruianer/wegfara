import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ActivityCard } from "./activity-card";
import type { Activity } from "@/lib/activities/types";
import { ACTIVITY_TYPE_COLOR } from "@/lib/activities/type-meta";
import type { Poi, PoiPhoto } from "@/lib/pois/types";

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

function poi(overrides: Partial<Poi> = {}): Poi {
  return {
    id: "poi-1",
    tripId: "trip-1",
    number: 3,
    name: "Dom von Amalfi",
    ort: "Amalfi",
    type: "sehenswuerdigkeit",
    position: { lat: 40.6343, lng: 14.6027 },
    status: "gesetzt",
    ...overrides,
  };
}

/** Fotos in ihrer Reihenfolge, wie sie aus der Ablage kommen (req-026). */
function fotos(anzahl: number, source?: PoiPhoto["source"]): PoiPhoto[] {
  return Array.from({ length: anzahl }, (_, index) => ({
    id: `foto-${index + 1}`,
    position: index + 1,
    source,
  }));
}

describe("ActivityCard – das Foto auf der Kachel (req-079)", () => {
  it("zeigt im oberen Teil das erste Foto des POI", () => {
    render(
      <ActivityCard
        activity={activity({ poiId: "poi-1" })}
        poi={poi({ photos: fotos(3) })}
      />,
    );

    const bild = screen.getByAltText("Foto von Dom von Amalfi");
    expect(bild).toHaveAttribute("src", "/api/poi-fotos/foto-1");
  });

  it("laesst ohne POI die farbige Flaeche stehen", () => {
    render(<ActivityCard activity={activity()} />);

    expect(
      screen.queryByAltText("Foto von Dom von Amalfi"),
    ).not.toBeInTheDocument();
    expect(screen.getByTestId("kachel-kopf-a")).toHaveStyle({
      backgroundColor: ACTIVITY_TYPE_COLOR.sehenswuerdigkeit,
    });
  });

  it("laesst bei einem POI ohne Fotos die farbige Flaeche stehen", () => {
    render(
      <ActivityCard activity={activity({ poiId: "poi-1" })} poi={poi()} />,
    );

    expect(
      screen.queryByAltText("Foto von Dom von Amalfi"),
    ).not.toBeInTheDocument();
    expect(screen.getByTestId("kachel-kopf-a")).toHaveStyle({
      backgroundColor: ACTIVITY_TYPE_COLOR.sehenswuerdigkeit,
    });
  });

  it("nennt ein fehlendes Foto nicht als Fehler (vgl. bug-021)", () => {
    render(
      <ActivityCard
        activity={activity({ poiId: "poi-1" })}
        poi={poi({ photos: [] })}
      />,
    );

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByText(/kein Foto/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/fehlgeschlagen/i)).not.toBeInTheDocument();
  });

  it("laesst Art, Uhrzeit und „Gewählt“ auch ueber dem Foto stehen", () => {
    render(
      <ActivityCard
        activity={activity({ poiId: "poi-1" })}
        poi={poi({ photos: fotos(1) })}
        selected
      />,
    );

    const kopf = screen.getByTestId("kachel-kopf-a");
    expect(kopf).toContainElement(screen.getByText("Sehenswürdigkeit"));
    expect(kopf).toContainElement(screen.getByText("10:00 – 12:30"));
    expect(kopf).toContainElement(screen.getByText("✓ Gewählt"));
  });

  it("kennzeichnet ein erzeugtes erstes Foto als KI-Bild (req-072)", () => {
    render(
      <ActivityCard
        activity={activity({ poiId: "poi-1" })}
        poi={poi({ photos: fotos(2, "ki") })}
      />,
    );

    expect(
      screen.getByRole("img", { name: "Mit KI erzeugt" }),
    ).toBeInTheDocument();
  });

  it("kennzeichnet ein Foto aus Google nicht als KI-Bild", () => {
    render(
      <ActivityCard
        activity={activity({ poiId: "poi-1" })}
        poi={poi({ photos: fotos(2, "google") })}
      />,
    );

    expect(
      screen.queryByRole("img", { name: "Mit KI erzeugt" }),
    ).not.toBeInTheDocument();
  });
});

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
