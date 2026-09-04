// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  GUEST_ACCESS_ERRORS,
  GUEST_PURPOSE_MAX_LENGTH,
  validateGuestAccessDraft,
} from "./validate";

const TRIP_ID = "d5fda5ea-65e7-4b47-8096-62618599a288";

describe("validateGuestAccessDraft (req-038)", () => {
  it("laesst Zweck und Reise durch", () => {
    expect(
      validateGuestAccessDraft({ tripId: TRIP_ID, purpose: "Nachbarin Eva" }),
    ).toEqual({});
  });

  it("verlangt einen Zweck -- sonst waere spaeter nicht erkennbar, wem der Link gehoert", () => {
    expect(
      validateGuestAccessDraft({ tripId: TRIP_ID, purpose: "   " }).purpose,
    ).toBe(GUEST_ACCESS_ERRORS.purposeRequired);
  });

  it("begrenzt die Laenge des Zwecks", () => {
    expect(
      validateGuestAccessDraft({
        tripId: TRIP_ID,
        purpose: "x".repeat(GUEST_PURPOSE_MAX_LENGTH + 1),
      }).purpose,
    ).toBe(GUEST_ACCESS_ERRORS.purposeTooLong);
  });

  it("verlangt eine Reise -- ein Gastzugang gilt fuer genau eine", () => {
    expect(
      validateGuestAccessDraft({ tripId: "", purpose: "Nachbarin Eva" }).tripId,
    ).toBe(GUEST_ACCESS_ERRORS.tripRequired);
  });
});
