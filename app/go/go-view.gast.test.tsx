import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { GoView } from "./go-view";
import { DEMO_TRIPS } from "@/tests/fixtures/demo-trips";
import { DEMO_ACTIVITIES } from "@/tests/fixtures/demo-activities";
import { DEMO_TRANSFERS } from "@/tests/fixtures/demo-transfers";
import { clearWeatherCache } from "@/lib/weather/cache";
import { openMeteoResponse } from "@/tests/fixtures/open-meteo-response";

vi.mock("maplibre-gl", () => import("@/tests/mocks/maplibre-gl"));

const TODAY = "2026-07-20";
const SUEDITALIEN = DEMO_TRIPS[0];

function mockWeatherSource() {
  clearWeatherCache();
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: true,
      json: async () =>
        openMeteoResponse({
          currentTemperature: 24,
          currentPrecipitation: 5,
          dailyDates: ["2026-07-20", "2026-07-21", "2026-07-22", "2026-07-23"],
          dailyMaxTemperatures: [29, 30, 26, 28],
          dailyMaxPrecipitations: [10, 15, 33, 5],
        }),
    })),
  );
}

/**
 * Der Begleiter, wie ihn ein Gast sieht (req-038): genau eine Reise, nur
 * lesend. Weder Ausgaben noch Dokumente kommen ueberhaupt bei ihm an -- die
 * Seite laedt sie fuer ihn gar nicht erst (siehe lib/guests/guest-trip.ts).
 */
function zeigeAlsGast() {
  mockWeatherSource();
  render(
    <GoView
      trips={[SUEDITALIEN]}
      activities={DEMO_ACTIVITIES.filter(
        (activity) => activity.tripId === SUEDITALIEN.id,
      )}
      transfers={DEMO_TRANSFERS.filter(
        (transfer) => transfer.tripId === SUEDITALIEN.id,
      )}
      guest
      today={TODAY}
    />,
  );
}

afterEach(() => {
  clearWeatherCache();
});

describe("Begleiter für Gäste (req-038)", () => {
  it("zeigt Plan und Karte der freigegebenen Reise", () => {
    zeigeAlsGast();

    const nav = screen.getByRole("navigation", { name: "Bereiche" });
    expect(within(nav).getByRole("button", { name: "Plan" })).toBeVisible();
    expect(within(nav).getByRole("button", { name: "Karte" })).toBeVisible();
  });

  it("zeigt weder Kosten noch Dokumente", () => {
    zeigeAlsGast();

    const nav = screen.getByRole("navigation", { name: "Bereiche" });
    expect(within(nav).queryByRole("button", { name: "Kosten" })).toBeNull();
    expect(within(nav).queryByRole("button", { name: "Dokumente" })).toBeNull();
  });

  it("zeigt kein Konto und kein Abmelden, sondern kennzeichnet den Gast", () => {
    zeigeAlsGast();

    expect(screen.getByText("Gast")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Konto" })).toBeNull();
    expect(screen.queryByRole("button", { name: /Abmelden/ })).toBeNull();
  });

  it("bietet keinen Reisewechsel an -- der Zugang gilt für genau eine Reise", async () => {
    const user = userEvent.setup();
    zeigeAlsGast();

    const wechsler = screen.getByRole("button", {
      name: new RegExp(SUEDITALIEN.title),
    });
    expect(wechsler).toBeDisabled();
    await user.click(wechsler).catch(() => {});
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
