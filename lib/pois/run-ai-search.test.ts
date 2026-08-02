import { describe, expect, it, vi } from "vitest";
import { runAiPoiSearch } from "./run-ai-search";

describe("runAiPoiSearch", () => {
  it("sendet Reise, Typfilter und Wunsch und liefert das Ergebnis", async () => {
    const apiResult = {
      addedCount: 2,
      discardedCount: 1,
      createdPois: [],
    };
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => apiResult,
    }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await runAiPoiSearch("trip-1", "restaurant", "mit Kindern");

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/poi-search",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          tripId: "trip-1",
          typeFilter: "restaurant",
          wish: "mit Kindern",
        }),
      }),
    );
    expect(result).toEqual(apiResult);
  });

  it("liefert null bei einem Netzwerkfehler", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network down");
      }),
    );

    expect(await runAiPoiSearch("trip-1", "alle", "")).toBeNull();
  });

  it("liefert null bei einer Fehler-Antwort", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, json: async () => ({}) })),
    );

    expect(await runAiPoiSearch("trip-1", "alle", "")).toBeNull();
  });
});
