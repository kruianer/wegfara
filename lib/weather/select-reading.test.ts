import { describe, expect, it } from "vitest";
import { isWithinForecastWindow, selectWeatherReading } from "./select-reading";
import type { OpenMeteoForecast } from "./types";

const FORECAST: OpenMeteoForecast = {
  current: { temperatureC: 24, precipitationProbabilityPercent: 5 },
  daily: [
    {
      date: "2026-07-20",
      maxTemperatureC: 29,
      maxPrecipitationProbabilityPercent: 10,
    },
    {
      date: "2026-07-21",
      maxTemperatureC: 27,
      maxPrecipitationProbabilityPercent: 40,
    },
    {
      date: "2026-07-22",
      maxTemperatureC: null,
      maxPrecipitationProbabilityPercent: null,
    },
  ],
};

describe("isWithinForecastWindow", () => {
  it("ist wahr fuer heute", () => {
    expect(isWithinForecastWindow("2026-07-20", "2026-07-20")).toBe(true);
  });

  it("ist wahr fuer den 15. Tag in der Zukunft", () => {
    expect(isWithinForecastWindow("2026-08-04", "2026-07-20")).toBe(true);
  });

  it("ist falsch fuer den 16. Tag in der Zukunft", () => {
    expect(isWithinForecastWindow("2026-08-05", "2026-07-20")).toBe(false);
  });

  it("ist falsch fuer einen Tag in der Vergangenheit", () => {
    expect(isWithinForecastWindow("2026-07-19", "2026-07-20")).toBe(false);
  });
});

describe("selectWeatherReading", () => {
  it("liefert die Tagesvorhersage fuer einen Tag innerhalb des Fensters", () => {
    expect(selectWeatherReading(FORECAST, "2026-07-21", "2026-07-20")).toEqual({
      temperatureC: 27,
      precipitationProbabilityPercent: 40,
    });
  });

  it("liefert das aktuelle Wetter fuer einen Tag in der Vergangenheit", () => {
    expect(selectWeatherReading(FORECAST, "2026-07-19", "2026-07-20")).toEqual({
      temperatureC: 24,
      precipitationProbabilityPercent: 5,
    });
  });

  it("liefert das aktuelle Wetter, wenn fuer den Tag keine Vorhersage vorliegt", () => {
    expect(selectWeatherReading(FORECAST, "2026-07-25", "2026-07-20")).toEqual({
      temperatureC: 24,
      precipitationProbabilityPercent: 5,
    });
  });

  it("liefert das aktuelle Wetter, wenn die Vorhersage fuer den Tag null-Werte enthaelt", () => {
    expect(selectWeatherReading(FORECAST, "2026-07-22", "2026-07-20")).toEqual({
      temperatureC: 24,
      precipitationProbabilityPercent: 5,
    });
  });
});
