import { describe, expect, it, beforeEach } from "vitest";
import {
  clearWeatherCache,
  getCachedForecast,
  placeKey,
  setCachedForecast,
} from "./cache";
import type { OpenMeteoForecast } from "./types";

const FORECAST: OpenMeteoForecast = {
  current: { temperatureC: 24, precipitationProbabilityPercent: 5 },
  daily: [],
};

beforeEach(() => {
  clearWeatherCache();
});

describe("weather cache", () => {
  it("liefert einen frisch gesetzten Eintrag zurueck", () => {
    const key = placeKey(40.634, 14.6027);
    setCachedForecast(key, FORECAST, 1_000);

    expect(getCachedForecast(key, 1_000 + 60_000)).toEqual(FORECAST);
  });

  it("liefert nichts, wenn das 15-Minuten-Fenster abgelaufen ist", () => {
    const key = placeKey(40.634, 14.6027);
    setCachedForecast(key, FORECAST, 1_000);

    expect(getCachedForecast(key, 1_000 + 15 * 60_000 + 1)).toBeUndefined();
  });

  it("liefert nichts fuer einen unbekannten Schluessel", () => {
    expect(getCachedForecast(placeKey(0, 0), 1_000)).toBeUndefined();
  });
});
