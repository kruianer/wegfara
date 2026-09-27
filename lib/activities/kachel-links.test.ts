import { describe, expect, it } from "vitest";
import { kachelLinks } from "./kachel-links";
import type { Activity } from "./types";
import type { Poi } from "../pois/types";

function activity(overrides: Partial<Activity> = {}): Activity {
  return {
    id: "a",
    tripId: "trip-1",
    type: "restaurant",
    title: "La Marinella",
    shortText: "Kurztext",
    longText: "Langtext",
    startAt: "2026-07-18T19:00",
    endAt: "2026-07-18T21:00",
    position: { lat: 40.6343, lng: 14.6027 },
    ...overrides,
  };
}

function poi(overrides: Partial<Poi> = {}): Poi {
  return {
    id: "poi-1",
    tripId: "trip-1",
    number: 1,
    name: "La Marinella",
    ort: "Amalfi",
    type: "restaurant",
    position: { lat: 40.6343, lng: 14.6027 },
    status: "gesetzt",
    ...overrides,
  };
}

function arten(links: ReturnType<typeof kachelLinks>) {
  return links.map((link) => link.art);
}

describe("kachelLinks (req-079)", () => {
  it("fuehrt die Navigation ueber maps-link, mit der Google-Kennung des Ortes", () => {
    const links = kachelLinks(activity(), poi({ googlePlaceId: "ChIJ-platz" }));

    const navigation = links.find((link) => link.art === "navigation");
    expect(navigation?.href).toBe(
      "https://www.google.com/maps/search/?api=1&query=40.6343%2C14.6027&query_place_id=ChIJ-platz",
    );
    expect(navigation?.name).toBe("Navigation zu La Marinella");
  });

  it("nimmt die Position des Ortes, wenn der Programmpunkt keine hat", () => {
    const links = kachelLinks(activity({ position: undefined }), poi());

    expect(arten(links)).toContain("navigation");
  });

  it("laesst die Navigation ohne jede Position weg", () => {
    const links = kachelLinks(activity({ position: undefined }));

    expect(arten(links)).not.toContain("navigation");
  });

  it("fuehrt die Webseite des Ortes", () => {
    const links = kachelLinks(
      activity(),
      poi({ web: "https://www.ristorantelamarinella.it" }),
    );

    const webseite = links.find((link) => link.art === "webseite");
    expect(webseite?.href).toBe("https://www.ristorantelamarinella.it");
    expect(webseite?.name).toBe("Webseite von La Marinella");
  });

  it("laesst die Webseite weg, wenn keine hinterlegt ist", () => {
    expect(arten(kachelLinks(activity(), poi()))).not.toContain("webseite");
    expect(arten(kachelLinks(activity(), poi({ web: "  " })))).not.toContain(
      "webseite",
    );
  });

  it("laesst ohne POI alles ausser der Navigation weg", () => {
    expect(arten(kachelLinks(activity()))).toEqual(["navigation"]);
  });

  it("fuehrt die Nummer des Ortes als Telefon-Link", () => {
    const links = kachelLinks(activity(), poi({ phone: "+39 089 871483" }));

    const telefon = links.find((link) => link.art === "telefon");
    expect(telefon?.href).toBe("tel:+39 089 871483");
    expect(telefon?.name).toBe("La Marinella anrufen");
  });

  it("nimmt die Nummer des Programmpunkts, wenn der Ort keine fuehrt", () => {
    const links = kachelLinks(
      activity({ bookingPhone: "+39 089 000000" }),
      poi(),
    );

    expect(links.find((link) => link.art === "telefon")?.href).toBe(
      "tel:+39 089 000000",
    );
  });

  it("fuehrt die E-Mail des Programmpunkts als mailto-Link", () => {
    const links = kachelLinks(activity({ bookingEmail: "info@example.com" }));

    const email = links.find((link) => link.art === "email");
    expect(email?.href).toBe("mailto:info@example.com");
    expect(email?.name).toBe("E-Mail an La Marinella");
  });

  it("haelt die Reihenfolge Navigation, Webseite, Telefon, E-Mail", () => {
    const links = kachelLinks(
      activity({ bookingEmail: "info@example.com" }),
      poi({ web: "https://example.com", phone: "+39 089 871483" }),
    );

    expect(arten(links)).toEqual([
      "navigation",
      "webseite",
      "telefon",
      "email",
    ]);
  });

  it("gibt ohne jeden hinterlegten Weg eine leere Liste", () => {
    // Ein Programmpunkt ohne Position und ohne POI: es gibt nichts zu zeigen,
    // und auf der Kachel steht dann auch nichts (req-079).
    expect(kachelLinks(activity({ position: undefined }))).toEqual([]);
  });
});
