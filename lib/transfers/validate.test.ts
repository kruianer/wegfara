import { describe, expect, it } from "vitest";
import {
  emptyTransferInput,
  transferToInput,
  validateTransferInput,
  withStreckenangaben,
  type TransferInput,
} from "./validate";
import type { Transfer } from "./types";

const TRANSFER: Transfer = {
  id: "transfer-1",
  tripId: "trip-1",
  fromActivityId: "activity-1",
  toActivityId: "activity-2",
  mode: "auto",
  title: "Fahrt zum Aussichtspunkt",
  durationMin: 12,
  distanceKm: 4.2,
};

function input(overrides: Partial<TransferInput> = {}): TransferInput {
  return {
    mode: "auto",
    title: "Nach Villa Rufolo",
    durationMin: "12",
    distanceKm: "4,2",
    ...overrides,
  };
}

describe("validateTransferInput (req-052)", () => {
  it("nimmt Verkehrsmittel, Titel, Dauer und Strecke an", () => {
    expect(validateTransferInput(input()).values).toEqual({
      mode: "auto",
      title: "Nach Villa Rufolo",
      durationMin: 12,
      distanceKm: 4.2,
    });
  });

  it("nimmt eine Strecke mit Punkt ebenso wie mit Komma", () => {
    expect(validateTransferInput(input({ distanceKm: "4.2" })).values).toEqual(
      expect.objectContaining({ distanceKm: 4.2 }),
    );
  });

  it("verlangt eine Dauer", () => {
    const { values, errors } = validateTransferInput(
      input({ durationMin: "" }),
    );

    expect(values).toBeNull();
    expect(errors.durationMin).toBeTruthy();
  });

  it("verlangt eine Strecke groesser als null", () => {
    const { values, errors } = validateTransferInput(
      input({ distanceKm: "0" }),
    );

    expect(values).toBeNull();
    expect(errors.distanceKm).toBeTruthy();
  });

  it("weist eine Dauer unter einer Minute zurueck", () => {
    expect(
      validateTransferInput(input({ durationMin: "0" })).values,
    ).toBeNull();
  });

  it("nimmt den Namen des Verkehrsmittels, wenn der Titel leer bleibt", () => {
    expect(validateTransferInput(input({ title: "  " })).values?.title).toBe(
      "Auto",
    );
  });

  it("rundet eine winzige Strecke nicht auf null", () => {
    // Die Ablage laesst keine Strecke von null zu (migrations/0008).
    expect(
      validateTransferInput(input({ distanceKm: "0,02" })).values?.distanceKm,
    ).toBe(0.1);
  });
});

describe("Formularstand eines Transfers (req-052)", () => {
  it("uebernimmt die Angaben eines vorhandenen Transfers", () => {
    expect(transferToInput(TRANSFER)).toEqual({
      mode: "auto",
      title: "Fahrt zum Aussichtspunkt",
      durationMin: "12",
      distanceKm: "4,2",
    });
  });

  it("schlaegt beim Anlegen einen Titel aus dem Ziel vor", () => {
    expect(emptyTransferInput("Villa Rufolo").title).toBe("Nach Villa Rufolo");
  });

  it("uebernimmt Dauer und Strecke eines Vorschlags", () => {
    expect(
      withStreckenangaben(input(), { durationMin: 45, distanceKm: 30.5 }),
    ).toEqual(
      expect.objectContaining({ durationMin: "45", distanceKm: "30,5" }),
    );
  });
});
