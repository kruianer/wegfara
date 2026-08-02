import { describe, expect, it, vi } from "vitest";
import { reverseGeocodeRegion } from "./reverse-geocode";

describe("reverseGeocodeRegion", () => {
  it("liefert den Landkreis, wenn vorhanden", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          address: { county: "Bari", state: "Apulien" },
          display_name: "Alberobello, Bari, Apulien, Italien",
        }),
      })),
    );

    expect(await reverseGeocodeRegion(40.78, 17.24)).toBe("Bari");
  });

  it("faellt auf das Bundesland zurueck, wenn kein Landkreis vorhanden ist", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          address: { state: "Apulien" },
          display_name: "Alberobello, Apulien, Italien",
        }),
      })),
    );

    expect(await reverseGeocodeRegion(40.78, 17.24)).toBe("Apulien");
  });

  it("faellt auf den vollen Anzeigenamen zurueck, wenn keine Adressfelder vorhanden sind", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          address: {},
          display_name: "Alberobello, Italien",
        }),
      })),
    );

    expect(await reverseGeocodeRegion(40.78, 17.24)).toBe(
      "Alberobello, Italien",
    );
  });

  it("liefert null bei einem Netzwerkfehler", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network down");
      }),
    );

    expect(await reverseGeocodeRegion(40.78, 17.24)).toBeNull();
  });

  it("liefert null bei einer Fehler-Antwort", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, json: async () => ({}) })),
    );

    expect(await reverseGeocodeRegion(40.78, 17.24)).toBeNull();
  });

  it("liefert null ohne jede brauchbare Adressangabe", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, json: async () => ({ address: {} }) })),
    );

    expect(await reverseGeocodeRegion(40.78, 17.24)).toBeNull();
  });
});
