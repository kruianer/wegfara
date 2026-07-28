import type { DailyWeather, OpenMeteoForecast } from "./types";

const BASE_URL = "https://api.open-meteo.com/v1/forecast";
const FORECAST_DAYS = 16;

/** Ruft aktuelles Wetter und Tagesvorhersage fuer einen Ort von Open-Meteo ab. */
export async function fetchOpenMeteoForecast(
  lat: number,
  lng: number,
): Promise<OpenMeteoForecast | null> {
  const url =
    `${BASE_URL}?latitude=${lat}&longitude=${lng}` +
    `&current=temperature_2m,precipitation_probability` +
    `&daily=temperature_2m_max,precipitation_probability_max` +
    `&forecast_days=${FORECAST_DAYS}&timezone=auto`;

  let response: Response;
  try {
    response = await fetch(url);
  } catch {
    return null;
  }

  if (!response.ok) return null;

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return null;
  }

  return parseOpenMeteoResponse(body);
}

function parseOpenMeteoResponse(body: unknown): OpenMeteoForecast | null {
  const current = (body as Record<string, unknown> | null)?.current as
    | Record<string, unknown>
    | undefined;
  const daily = (body as Record<string, unknown> | null)?.daily as
    | Record<string, unknown>
    | undefined;

  const currentTemperature = current?.temperature_2m;
  const currentPrecipitation = current?.precipitation_probability;
  const dailyTime = daily?.time;
  const dailyMaxTemperature = daily?.temperature_2m_max;
  const dailyMaxPrecipitation = daily?.precipitation_probability_max;

  if (
    typeof currentTemperature !== "number" ||
    typeof currentPrecipitation !== "number" ||
    !Array.isArray(dailyTime) ||
    !Array.isArray(dailyMaxTemperature) ||
    !Array.isArray(dailyMaxPrecipitation)
  ) {
    return null;
  }

  const days: DailyWeather[] = dailyTime.map((date, i) => ({
    date,
    maxTemperatureC:
      typeof dailyMaxTemperature[i] === "number"
        ? dailyMaxTemperature[i]
        : null,
    maxPrecipitationProbabilityPercent:
      typeof dailyMaxPrecipitation[i] === "number"
        ? dailyMaxPrecipitation[i]
        : null,
  }));

  return {
    current: {
      temperatureC: currentTemperature,
      precipitationProbabilityPercent: currentPrecipitation,
    },
    daily: days,
  };
}
