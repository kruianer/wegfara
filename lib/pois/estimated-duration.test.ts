import { describe, expect, it } from "vitest";
import {
  POI_ESTIMATED_DURATION_HOURS,
  formatEstimatedDuration,
} from "./estimated-duration";

describe("POI_ESTIMATED_DURATION_HOURS", () => {
  it("entspricht den Vorgaben je Typ aus der Vorlage", () => {
    expect(POI_ESTIMATED_DURATION_HOURS).toEqual({
      sehenswuerdigkeit: 2.5,
      stadt_dorf: 3,
      restaurant: 2,
      strand: 3,
      aktivitaet: 2,
      hotel: 1,
      weltkulturerbe: 2.5,
    });
  });
});

describe("formatEstimatedDuration", () => {
  it('formatiert eine halbe Stunde mit Komma ("2,5 h")', () => {
    expect(formatEstimatedDuration("sehenswuerdigkeit")).toBe("2,5 h");
  });

  it('formatiert eine ganze Stunde ohne Nachkommastelle ("3 h")', () => {
    expect(formatEstimatedDuration("stadt_dorf")).toBe("3 h");
  });

  it('formatiert eine einzelne Stunde ("1 h")', () => {
    expect(formatEstimatedDuration("hotel")).toBe("1 h");
  });
});
