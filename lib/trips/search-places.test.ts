import { afterEach, describe, expect, it, vi } from "vitest";
import { searchPlaceSuggestions } from "./search-places";

/**
 * Die Ortssuche liefert immer eine Liste -- auch wenn die Antwort keine
 * hergibt. Fehlte das Feld `places`, kam `undefined` zurueck, obwohl die
 * Signatur ein Array verspricht; der Aufrufer liest darauf `.length`
 * (poi-anlegezeile.tsx:265) und warf einen TypeError, der den ganzen
 * Testlauf abbrach und den Prod-Deploy blockierte (Lauf 40929729596).
 */
describe("searchPlaceSuggestions", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function antwortet(body: unknown, ok = true) {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok, json: async () => body })),
    );
  }

  it("gibt die genannten Orte zurueck", async () => {
    antwortet({
      places: [{ name: "Bilbao", lat: 43.26, lng: -2.93 }],
    });

    const orte = await searchPlaceSuggestions("Bilbao");
    expect(orte).toHaveLength(1);
    expect(orte[0]?.name).toBe("Bilbao");
  });

  it("gibt die leere Liste zurueck, wenn die Antwort keine Orte nennt", async () => {
    antwortet({});

    await expect(searchPlaceSuggestions("Bilbao")).resolves.toEqual([]);
  });

  it("gibt die leere Liste zurueck, wenn places null ist", async () => {
    antwortet({ places: null });

    await expect(searchPlaceSuggestions("Bilbao")).resolves.toEqual([]);
  });

  it("gibt die leere Liste zurueck, wenn die Antwort nicht in Ordnung ist", async () => {
    antwortet({ places: [{ name: "Bilbao" }] }, false);

    await expect(searchPlaceSuggestions("Bilbao")).resolves.toEqual([]);
  });

  it("gibt die leere Liste zurueck, wenn die Antwort kein JSON ist", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => {
          throw new Error("kein JSON");
        },
      })),
    );

    await expect(searchPlaceSuggestions("Bilbao")).resolves.toEqual([]);
  });

  it("gibt die leere Liste zurueck, wenn die Anfrage scheitert", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("Netz weg");
      }),
    );

    await expect(searchPlaceSuggestions("Bilbao")).resolves.toEqual([]);
  });
});
