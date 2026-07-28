import type { OpenMeteoForecast } from "./types";

/** Verhindert wiederholte Abrufe bei der Wetterquelle innerhalb dieses Fensters. */
export const CACHE_TTL_MS = 15 * 60 * 1000;

interface CacheEntry {
  forecast: OpenMeteoForecast;
  fetchedAt: number;
}

const cache = new Map<string, CacheEntry>();

export function placeKey(lat: number, lng: number): string {
  return `${lat},${lng}`;
}

export function getCachedForecast(
  key: string,
  now: number,
): OpenMeteoForecast | undefined {
  const entry = cache.get(key);
  if (!entry) return undefined;
  if (now - entry.fetchedAt > CACHE_TTL_MS) return undefined;
  return entry.forecast;
}

export function setCachedForecast(
  key: string,
  forecast: OpenMeteoForecast,
  now: number,
): void {
  cache.set(key, { forecast, fetchedAt: now });
}

export function clearWeatherCache(): void {
  cache.clear();
}
