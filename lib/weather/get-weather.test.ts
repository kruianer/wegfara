import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { getWeatherForDay } from "./get-weather";
import { clearWeatherCache } from "./cache";
import { openMeteoResponse } from "@/tests/fixtures/open-meteo-response";
import type { MainPlace } from "@/lib/trips/types";

const AMALFI: MainPlace = { name: "Amalfi", lat: 40.634, lng: 14.6027 };

beforeEach(() => {
  clearWeatherCache();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("getWeatherForDay", () => {
  it("liefert die Wetterangabe fuer den gewaehlten Tag", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, json: async () => openMeteoResponse() })),
    );

    const reading = await getWeatherForDay(AMALFI, "2026-07-20", "2026-07-20");

    expect(reading).toEqual({
      temperatureC: 29,
      precipitationProbabilityPercent: 10,
    });
  });

  it("ruft die Wetterquelle innerhalb von 15 Minuten fuer denselben Ort nicht erneut ab", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => openMeteoResponse(),
    }));
    vi.stubGlobal("fetch", fetchMock);
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-20T10:00:00Z"));

    await getWeatherForDay(AMALFI, "2026-07-20", "2026-07-20");

    vi.setSystemTime(new Date("2026-07-20T10:10:00Z"));
    await getWeatherForDay(AMALFI, "2026-07-20", "2026-07-20");

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("ruft die Wetterquelle nach Ablauf von 15 Minuten erneut ab", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => openMeteoResponse(),
    }));
    vi.stubGlobal("fetch", fetchMock);
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-20T10:00:00Z"));

    await getWeatherForDay(AMALFI, "2026-07-20", "2026-07-20");

    vi.setSystemTime(new Date("2026-07-20T10:16:00Z"));
    await getWeatherForDay(AMALFI, "2026-07-20", "2026-07-20");

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("liefert null, wenn die Wetterquelle nicht erreichbar ist", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network down");
      }),
    );

    expect(
      await getWeatherForDay(AMALFI, "2026-07-20", "2026-07-20"),
    ).toBeNull();
  });
});
