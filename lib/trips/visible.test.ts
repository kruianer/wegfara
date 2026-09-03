// @vitest-environment node
import { describe, expect, it } from "vitest";
import { DEMO_TRIPS } from "@/tests/fixtures/demo-trips";
import {
  forVisibleTrips,
  selectionsForVisibleTrips,
  visibleTripIds,
} from "./visible";

const [SUEDITALIEN, WIEN] = DEMO_TRIPS;

describe("forVisibleTrips (req-023)", () => {
  it("behaelt nur, was zu einer sichtbaren Reise gehoert", () => {
    const sichtbar = visibleTripIds([SUEDITALIEN]);

    const items = forVisibleTrips(
      [
        { tripId: SUEDITALIEN.id, id: "a" },
        { tripId: WIEN.id, id: "b" },
      ],
      sichtbar,
    );

    expect(items.map((item) => item.id)).toEqual(["a"]);
  });

  it("liefert nichts, wenn keine Reise sichtbar ist", () => {
    expect(forVisibleTrips([{ tripId: WIEN.id }], visibleTripIds([]))).toEqual(
      [],
    );
  });
});

describe("selectionsForVisibleTrips (req-023)", () => {
  it("behaelt nur die Wahlen sichtbarer Reisen", () => {
    const selections = {
      [`${SUEDITALIEN.id}|2026-07-18T09:00|2026-07-18T11:00`]: "a",
      [`${WIEN.id}|2026-10-09T09:00|2026-10-09T11:00`]: "b",
    };

    const gefiltert = selectionsForVisibleTrips(
      selections,
      visibleTripIds([SUEDITALIEN]),
    );

    expect(Object.values(gefiltert)).toEqual(["a"]);
  });
});
