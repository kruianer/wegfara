import { describe, expect, it, vi, afterEach } from "vitest";
import { fetchOpenMeteoForecast } from "./open-meteo-client";
import { openMeteoResponse } from "@/tests/fixtures/open-meteo-response";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchOpenMeteoForecast", () => {
  it("parst aktuelles Wetter und Tagesvorhersage aus einer gueltigen Antwort", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => openMeteoResponse(),
      })),
    );

    const forecast = await fetchOpenMeteoForecast(40.634, 14.6027);

    expect(forecast).toEqual({
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
          maxTemperatureC: 26,
          maxPrecipitationProbabilityPercent: 20,
        },
      ],
    });
  });

  it("gibt fehlende Tageswerte als null weiter", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () =>
          openMeteoResponse({
            dailyDates: ["2026-08-10"],
            dailyMaxTemperatures: [null],
            dailyMaxPrecipitations: [null],
          }),
      })),
    );

    const forecast = await fetchOpenMeteoForecast(40.634, 14.6027);

    expect(forecast?.daily).toEqual([
      {
        date: "2026-08-10",
        maxTemperatureC: null,
        maxPrecipitationProbabilityPercent: null,
      },
    ]);
  });

  it("liefert null bei einem Netzwerkfehler", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network down");
      }),
    );

    expect(await fetchOpenMeteoForecast(40.634, 14.6027)).toBeNull();
  });

  it("liefert null bei einer Fehler-Antwort", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, json: async () => ({}) })),
    );

    expect(await fetchOpenMeteoForecast(40.634, 14.6027)).toBeNull();
  });

  it("liefert null bei einer unerwartet geformten Antwort", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, json: async () => ({ foo: "bar" }) })),
    );

    expect(await fetchOpenMeteoForecast(40.634, 14.6027)).toBeNull();
  });
});
