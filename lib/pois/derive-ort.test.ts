import { describe, expect, it, vi } from "vitest";
import { deriveOrt, type OrtLookup } from "./derive-ort";

const RAVELLO = { lat: 40.6491, lng: 14.6113 };

function ortssuche(overrides: Partial<OrtLookup> = {}): OrtLookup {
  return {
    fromAddress: vi.fn(async () => null),
    fromPosition: vi.fn(async () => null),
    ...overrides,
  };
}

describe("deriveOrt (req-041)", () => {
  it("nimmt den Ort aus der Adresse", async () => {
    const lookup = ortssuche({ fromAddress: vi.fn(async () => "Ravello") });

    const ort = await deriveOrt(
      {
        address: "Via Richard Wagner 5, 84010 Ravello SA, Italien",
        position: RAVELLO,
      },
      lookup,
    );

    expect(ort).toBe("Ravello");
    expect(lookup.fromAddress).toHaveBeenCalledWith(
      "Via Richard Wagner 5, 84010 Ravello SA, Italien",
    );
    // Die Position wird gar nicht erst gefragt: die Adresse hat gewonnen.
    expect(lookup.fromPosition).not.toHaveBeenCalled();
  });

  it("nimmt ohne Adresse den Ort aus der Position", async () => {
    const lookup = ortssuche({ fromPosition: vi.fn(async () => "Ravello") });

    expect(await deriveOrt({ address: null, position: RAVELLO }, lookup)).toBe(
      "Ravello",
    );
    expect(lookup.fromPosition).toHaveBeenCalledWith(RAVELLO);
  });

  it("laesst die Adresse gewinnen, wenn sie der Position widerspricht", async () => {
    const lookup = ortssuche({
      fromAddress: vi.fn(async () => "Ravello"),
      fromPosition: vi.fn(async () => "Amalfi"),
    });

    const ort = await deriveOrt(
      { address: "Piazza Duomo, Ravello, Italien", position: RAVELLO },
      lookup,
    );

    expect(ort).toBe("Ravello");
  });

  it("fragt die Position, wenn die Adresse nichts hergibt", async () => {
    const lookup = ortssuche({
      fromAddress: vi.fn(async () => null),
      fromPosition: vi.fn(async () => "Ravello"),
    });

    expect(
      await deriveOrt({ address: "Irgendwo 1", position: RAVELLO }, lookup),
    ).toBe("Ravello");
  });

  it("uebergeht eine leere Adresse", async () => {
    const lookup = ortssuche({ fromPosition: vi.fn(async () => "Ravello") });

    await deriveOrt({ address: "   ", position: RAVELLO }, lookup);

    expect(lookup.fromAddress).not.toHaveBeenCalled();
  });

  it("liefert nichts, wenn die Ortssuche nichts kennt", async () => {
    expect(
      await deriveOrt(
        { address: "Irgendwo 1", position: RAVELLO },
        ortssuche(),
      ),
    ).toBeNull();
  });

  it("liefert nichts, wenn die Ortssuche nicht erreichbar ist", async () => {
    const lookup = ortssuche({
      fromAddress: vi.fn(async () => {
        throw new Error("Nominatim offline");
      }),
    });

    expect(
      await deriveOrt({ address: "Irgendwo 1", position: RAVELLO }, lookup),
    ).toBeNull();
  });

  it("wertet einen Ort aus lauter Leerzeichen als keinen", async () => {
    const lookup = ortssuche({ fromPosition: vi.fn(async () => "   ") });

    expect(await deriveOrt({ address: null, position: RAVELLO }, lookup)).toBe(
      null,
    );
  });
});
