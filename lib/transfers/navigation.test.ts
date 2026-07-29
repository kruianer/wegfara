import { describe, expect, it } from "vitest";
import { buildRouteUrl } from "./navigation";

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
