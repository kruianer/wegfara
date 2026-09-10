import { describe, expect, it, vi } from "vitest";
import { runAiPoiSearch } from "./run-ai-search";

describe("runAiPoiSearch", () => {
  it("sendet Reise, Typfilter und Wunsch und liefert das Ergebnis", async () => {
    const apiResult = {
      addedCount: 2,
      discardedCount: 1,
      createdPois: [],
      // Seit bug-027 sagt die Antwort auch, ob die Bilder ankamen.
      fotoProblem: null,
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
    expect(result).toEqual({ ...apiResult, fehler: null });
  });

  it("nennt einen Netzwerkfehler als Grund", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network down");
      }),
    );

    const result = await runAiPoiSearch("trip-1", "alle", "");

    expect(result.fehler).toEqual({ art: "netz", detail: "" });
    expect(result.createdPois).toEqual([]);
  });

  /**
   * Der Grund kommt aus der Antwort der Schnittstelle und geht unveraendert
   * weiter (bug-032) -- die Oberflaeche sagt damit, was fehlt.
   */
  it("uebernimmt den Grund aus der Fehler-Antwort", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        json: async () => ({
          error: "search failed",
          fehler: {
            art: "modell",
            detail: "you must provide a model parameter",
          },
        }),
      })),
    );

    expect((await runAiPoiSearch("trip-1", "alle", "")).fehler).toEqual({
      art: "modell",
      detail: "you must provide a model parameter",
    });
  });

  it("faellt auf einen unbekannten Grund zurueck, wenn die Antwort keinen nennt", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, json: async () => ({}) })),
    );

    expect((await runAiPoiSearch("trip-1", "alle", "")).fehler).toEqual({
      art: "netz",
      detail: "",
    });
  });
});
