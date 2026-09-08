import { afterEach, describe, expect, it, vi } from "vitest";
import { holeStandort } from "./geolocation";

const PERMISSION_DENIED = 1;
const POSITION_UNAVAILABLE = 2;

function stubGeolocation(
  implementation: (
    success: (position: GeolocationPosition) => void,
    error: (error: GeolocationPositionError) => void,
  ) => void,
) {
  vi.stubGlobal("navigator", {
    geolocation: { getCurrentPosition: vi.fn(implementation) },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("holeStandort (req-050)", () => {
  it("liefert die Koordinaten bei erteilter Freigabe", async () => {
    stubGeolocation((success) => {
      success({
        coords: { latitude: 40.6114, longitude: 14.6896 },
      } as GeolocationPosition);
    });

    expect(await holeStandort()).toEqual({
      ok: true,
      lat: 40.6114,
      lng: 14.6896,
    });
  });

  it("meldet eine abgelehnte Standortfreigabe", async () => {
    stubGeolocation((_success, error) => {
      error({
        code: PERMISSION_DENIED,
        PERMISSION_DENIED,
      } as GeolocationPositionError);
    });

    expect(await holeStandort()).toEqual({ ok: false, grund: "abgelehnt" });
  });

  it("meldet jeden anderen Fehler als nicht verfuegbar", async () => {
    stubGeolocation((_success, error) => {
      error({
        code: POSITION_UNAVAILABLE,
        PERMISSION_DENIED,
      } as GeolocationPositionError);
    });

    expect(await holeStandort()).toEqual({
      ok: false,
      grund: "nicht_verfuegbar",
    });
  });

  it("meldet nicht verfuegbar, wenn der Browser keine Standortabfrage kennt", async () => {
    vi.stubGlobal("navigator", {});

    expect(await holeStandort()).toEqual({
      ok: false,
      grund: "nicht_verfuegbar",
    });
  });
});
