import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

describe("ActivityCard – „Mehr lesen“ (req-079)", () => {
  it("ersetzt den Kurztext durch den Langtext", async () => {
    const nutzer = userEvent.setup();
    render(
      <ActivityCard
        activity={activity({
          shortText: "Die kurze Fassung",
          longText: "Die ausfuehrliche Fassung",
        })}
      />,
    );

    await nutzer.click(screen.getByRole("button", { name: "Mehr lesen" }));

    expect(screen.getByText("Die ausfuehrliche Fassung")).toBeInTheDocument();
    expect(screen.queryByText("Die kurze Fassung")).not.toBeInTheDocument();
  });

  it("stellt beim Zuklappen den Kurztext wieder her", async () => {
    const nutzer = userEvent.setup();
    render(
      <ActivityCard
        activity={activity({
          shortText: "Die kurze Fassung",
          longText: "Die ausfuehrliche Fassung",
        })}
      />,
    );

    await nutzer.click(screen.getByRole("button", { name: "Mehr lesen" }));
    await nutzer.click(
      screen.getByRole("button", { name: "Weniger anzeigen" }),
    );

    expect(screen.getByText("Die kurze Fassung")).toBeInTheDocument();
    expect(
      screen.queryByText("Die ausfuehrliche Fassung"),
    ).not.toBeInTheDocument();
  });

  it("zeigt aufgeklappt die weiteren Fotos untereinander, in ihrer Reihenfolge", async () => {
    const nutzer = userEvent.setup();
    render(
      <ActivityCard
        activity={activity({ poiId: "poi-1" })}
        poi={poi({ photos: fotos(4) })}
      />,
    );

    await nutzer.click(screen.getByRole("button", { name: "Mehr lesen" }));

    const weitere = screen.getByTestId("kachel-weitere-fotos-a");
    const bilder = Array.from(weitere.querySelectorAll("img"));
    expect(bilder.map((bild) => bild.getAttribute("src"))).toEqual([
      "/api/poi-fotos/foto-2",
      "/api/poi-fotos/foto-3",
      "/api/poi-fotos/foto-4",
    ]);
  });

  it("stellt die weiteren Fotos unter den Langtext", async () => {
    const nutzer = userEvent.setup();
    render(
      <ActivityCard
        activity={activity({ poiId: "poi-1", longText: "Die lange Fassung" })}
        poi={poi({ photos: fotos(2) })}
      />,
    );

    await nutzer.click(screen.getByRole("button", { name: "Mehr lesen" }));

    const langtext = screen.getByText("Die lange Fassung");
    const weitere = screen.getByTestId("kachel-weitere-fotos-a");
    expect(
      langtext.compareDocumentPosition(weitere) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("wiederholt bei einem einzigen Foto nicht das erste", async () => {
    const nutzer = userEvent.setup();
    render(
      <ActivityCard
        activity={activity({ poiId: "poi-1" })}
        poi={poi({ photos: fotos(1) })}
      />,
    );

    await nutzer.click(screen.getByRole("button", { name: "Mehr lesen" }));

    expect(screen.queryByTestId("kachel-weitere-fotos-a")).toBeNull();
    expect(document.querySelectorAll("img")).toHaveLength(1);
  });

  it("nimmt die weiteren Fotos beim Zuklappen wieder fort", async () => {
    const nutzer = userEvent.setup();
    render(
      <ActivityCard
        activity={activity({ poiId: "poi-1" })}
        poi={poi({ photos: fotos(3) })}
      />,
    );

    await nutzer.click(screen.getByRole("button", { name: "Mehr lesen" }));
    await nutzer.click(
      screen.getByRole("button", { name: "Weniger anzeigen" }),
    );

    expect(screen.queryByTestId("kachel-weitere-fotos-a")).toBeNull();
  });

  it("laedt die weiteren Fotos erst beim Aufklappen (Constraints)", () => {
    render(
      <ActivityCard
        activity={activity({ poiId: "poi-1" })}
        poi={poi({ photos: fotos(4) })}
      />,
    );

    // Zugeklappt steht allein das erste Foto im Dokument -- die uebrigen
    // fordert der Browser damit auch nicht an.
    expect(document.querySelectorAll("img")).toHaveLength(1);
  });

  it("kennzeichnet ein erzeugtes weiteres Foto als KI-Bild (req-072)", async () => {
    const nutzer = userEvent.setup();
    render(
      <ActivityCard
        activity={activity({ poiId: "poi-1" })}
        poi={poi({
          photos: [
            { id: "foto-1", position: 1, source: "google" },
            { id: "foto-2", position: 2, source: "ki" },
          ],
        })}
      />,
    );

    await nutzer.click(screen.getByRole("button", { name: "Mehr lesen" }));

    const weitere = screen.getByTestId("kachel-weitere-fotos-a");
    expect(
      within(weitere).getByRole("img", { name: "Mit KI erzeugt" }),
    ).toBeInTheDocument();
  });
});

describe("ActivityCard – die Links auf der Kachel (req-079)", () => {
  it("startet von der Kachel aus die Navigation zum Ort", () => {
    render(
      <ActivityCard
        activity={activity({ poiId: "poi-1" })}
        poi={poi({ googlePlaceId: "ChIJ-dom" })}
      />,
    );

    const link = screen.getByRole("link", {
      name: "Navigation zu Dom von Amalfi",
    });
    expect(link).toHaveAttribute(
      "href",
      "https://www.google.com/maps/search/?api=1&query=40.6343%2C14.6027&query_place_id=ChIJ-dom",
    );
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("fuehrt zur hinterlegten Webseite des Ortes", () => {
    render(
      <ActivityCard
        activity={activity({ poiId: "poi-1" })}
        poi={poi({ web: "https://www.duomodiamalfi.it" })}
      />,
    );

    expect(
      screen.getByRole("link", { name: "Webseite von Dom von Amalfi" }),
    ).toHaveAttribute("href", "https://www.duomodiamalfi.it");
  });

  it("stellt ohne hinterlegte Webseite weder toten Link noch Platzhalter dar", () => {
    render(
      <ActivityCard activity={activity({ poiId: "poi-1" })} poi={poi()} />,
    );

    const leiste = screen.getByTestId("kachel-links-a");
    const ziele = Array.from(leiste.querySelectorAll("a")).map((link) =>
      link.getAttribute("aria-label"),
    );
    expect(ziele).toEqual(["Navigation zu Dom von Amalfi"]);
    expect(screen.queryByText("Webseite")).not.toBeInTheDocument();
  });

  it("fuehrt die weiteren Kontaktwege des Ortes", () => {
    render(
      <ActivityCard
        activity={activity({
          poiId: "poi-1",
          bookingEmail: "info@duomodiamalfi.it",
        })}
        poi={poi({ phone: "+39 089 871059" })}
      />,
    );

    expect(
      screen.getByRole("link", { name: "Dom von Amalfi anrufen" }),
    ).toHaveAttribute("href", "tel:+39 089 871059");
    expect(
      screen.getByRole("link", { name: "E-Mail an Dom von Amalfi" }),
    ).toHaveAttribute("href", "mailto:info@duomodiamalfi.it");
  });

  it("gibt jedem Symbol einen Namen fuer Vorleseprogramme und als Tooltip", () => {
    render(
      <ActivityCard
        activity={activity({ poiId: "poi-1" })}
        poi={poi({ web: "https://www.duomodiamalfi.it" })}
      />,
    );

    for (const link of Array.from(
      screen.getByTestId("kachel-links-a").querySelectorAll("a"),
    )) {
      const name = link.getAttribute("aria-label");
      expect(name).toBeTruthy();
      expect(link).toHaveAttribute("title", name!);
      // Die Symbole selbst sagen Vorleseprogrammen nichts -- der Name steht
      // am Link.
      expect(link.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
    }
  });

  it("laesst die Leiste ganz weg, wenn es keinen Weg zu zeigen gibt", () => {
    render(<ActivityCard activity={activity({ position: undefined })} />);

    expect(screen.queryByTestId("kachel-links-a")).toBeNull();
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

    // Die Wege zum Ort (req-079) stehen weiterhin da -- eine
    // Buchungs-Schaltflaeche ist keiner von ihnen.
    expect(
      screen.queryByRole("link", { name: /Buchen|Anfragen|Anrufen/ }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Buchen")).not.toBeInTheDocument();
    expect(screen.queryByText("Anfragen")).not.toBeInTheDocument();
    expect(screen.queryByText("Anrufen")).not.toBeInTheDocument();
    expect(screen.queryByText("Unterlagen")).not.toBeInTheDocument();
  });
});
