/** Spiegelt eine reale Open-Meteo-Antwort, ohne vom Netz abzuhaengen. */
export function openMeteoResponse({
  currentTemperature = 24,
  currentPrecipitation = 5,
  dailyDates = ["2026-07-20", "2026-07-21", "2026-07-22"],
  dailyMaxTemperatures = [29, 27, 26],
  dailyMaxPrecipitations = [10, 40, 20],
}: {
  currentTemperature?: number;
  currentPrecipitation?: number;
  dailyDates?: string[];
  dailyMaxTemperatures?: (number | null)[];
  dailyMaxPrecipitations?: (number | null)[];
} = {}) {
  return {
    current: {
      temperature_2m: currentTemperature,
      precipitation_probability: currentPrecipitation,
    },
    daily: {
      time: dailyDates,
      temperature_2m_max: dailyMaxTemperatures,
      precipitation_probability_max: dailyMaxPrecipitations,
    },
  };
}
