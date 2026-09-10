import { describe, expect, it } from "vitest";
import { buildRouteUrl, buildTransferRouteUrl } from "./navigation";

const DOM = { title: "Dom von Amalfi", position: { lat: 40.634, lng: 14.602 } };
const HAFEN = {
  title: "Hafen Positano",
  position: { lat: 40.628, lng: 14.484 },
};

describe("buildRouteUrl", () => {
  it("baut eine Google-Maps-Directions-URL zur Zielposition", () => {
    const url = buildRouteUrl({ lat: 40.627, lng: 14.597 }, "auto");
    expect(url).toBe(
      "https://www.google.com/maps/dir/?api=1&destination=40.627,14.597&travelmode=driving",
    );
  });

  it("uebernimmt zu Fuss als travelmode walking", () => {
    const url = buildRouteUrl({ lat: 1, lng: 2 }, "fuss");
    expect(url).toContain("travelmode=walking");
  });

  it("uebernimmt Bus als travelmode transit", () => {
    const url = buildRouteUrl({ lat: 1, lng: 2 }, "bus");
    expect(url).toContain("travelmode=transit");
  });

  it("baut fuer Boot ebenfalls eine gueltige Navigations-URL", () => {
    const url = buildRouteUrl({ lat: 1, lng: 2 }, "boot");
    expect(url).toContain(
      "https://www.google.com/maps/dir/?api=1&destination=1,2",
    );
  });
});

describe("buildTransferRouteUrl (req-059)", () => {
  it("nimmt Start, Ziel und Verkehrsmittel des Transfers auf", () => {
    expect(buildTransferRouteUrl(DOM, HAFEN, "auto")).toBe(
      "https://www.google.com/maps/dir/?api=1" +
        "&origin=40.634,14.602&destination=40.628,14.484&travelmode=driving",
    );
  });

  it("uebernimmt das Fahrrad als travelmode bicycling", () => {
    expect(buildTransferRouteUrl(DOM, HAFEN, "rad")).toContain(
      "travelmode=bicycling",
    );
  });

  it("baut auch fuer die Bahn eine Navigations-URL", () => {
    // Gerade dort ist sie der Weg zur Verbindung (req-059).
    expect(buildTransferRouteUrl(DOM, HAFEN, "bahn")).toContain(
      "&origin=40.634,14.602&destination=40.628,14.484&travelmode=transit",
    );
  });

  it("nennt den Namen, wo eine Position fehlt", () => {
    const url = buildTransferRouteUrl(
      DOM,
      { title: "Stadtbummel in Positano" },
      "fuss",
    );

    expect(url).toContain("destination=Stadtbummel%20in%20Positano");
  });
});
