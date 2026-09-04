import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { GastPlanView } from "./gast-plan-view";
import { DEMO_TRIPS } from "@/tests/fixtures/demo-trips";
import { DEMO_POIS } from "@/tests/fixtures/demo-pois";
import { DEMO_ACTIVITIES } from "@/tests/fixtures/demo-activities";
import { DEMO_TRANSFERS } from "@/tests/fixtures/demo-transfers";

vi.mock("maplibre-gl", () => import("@/tests/mocks/maplibre-gl"));

const TODAY = "2026-07-20";
const SUEDITALIEN = DEMO_TRIPS[0];

function setWindowWidth(width: number) {
  Object.defineProperty(window, "innerWidth", {
    writable: true,
    configurable: true,
    value: width,
  });
}

function zeige() {
  render(
    <GastPlanView
      trip={SUEDITALIEN}
      pois={DEMO_POIS.filter((poi) => poi.tripId === SUEDITALIEN.id)}
      activities={DEMO_ACTIVITIES.filter(
        (activity) => activity.tripId === SUEDITALIEN.id,
      )}
      transfers={DEMO_TRANSFERS.filter(
        (transfer) => transfer.tripId === SUEDITALIEN.id,
      )}
      today={TODAY}
    />,
  );
}

beforeEach(() => {
  setWindowWidth(1440);
});

describe("Planer für Gäste (req-038)", () => {
  it("zeigt die freigegebene Reise und weist auf den Gastzugang hin", () => {
    zeige();

    expect(screen.getByText(SUEDITALIEN.title)).toBeInTheDocument();
    expect(screen.getByText("Gastzugang · nur lesen")).toBeInTheDocument();
  });

  it("zeigt Plan, Programmpunkte und POIs", () => {
    zeige();

    const poiKarte = screen.getByRole("region", { name: "POIs" });
    expect(poiKarte).toHaveTextContent(
      DEMO_POIS.filter((poi) => poi.tripId === SUEDITALIEN.id)[0].name,
    );
    // Der Zeitstrahl des Reisetages -- die Programmpunkte.
    expect(screen.getByText("Noch unverplant")).toBeInTheDocument();
  });

  it("zeigt keinen Kopfbereich mit Bereichen und keinen Reisewechsel", () => {
    zeige();

    expect(
      screen.queryByRole("navigation", { name: "Planer-Bereiche" }),
    ).toBeNull();
    expect(screen.queryByRole("button", { name: "Nutzer" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Gastzugänge" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Mein Bereich" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Verwaltung" })).toBeNull();
  });

  it("bietet nichts zum Ändern an", () => {
    zeige();

    // Kein Anlegen, kein Löschen, kein Abmelden, kein Konto.
    expect(screen.queryByRole("button", { name: /Neue Reise/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /hinzufügen/ })).toBeNull();
    expect(screen.queryByRole("link", { name: "Konto" })).toBeNull();
    expect(screen.queryByRole("button", { name: /Abmelden/ })).toBeNull();
  });
});
