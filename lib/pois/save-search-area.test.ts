import { describe, expect, it, vi } from "vitest";
import { removeSearchArea, saveSearchArea } from "./save-search-area";

const POINTS = [
  { lat: 40.8, lng: 14.2 },
  { lat: 40.8, lng: 14.4 },
  { lat: 41.0, lng: 14.4 },
];

describe("saveSearchArea", () => {
  it("sendet Reise und Eckpunkte an den Server", async () => {
    const fetchMock = vi.fn(async () => ({ ok: true }));
    vi.stubGlobal("fetch", fetchMock);

    await saveSearchArea("trip-1", POINTS);

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/search-area",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ tripId: "trip-1", points: POINTS }),
      }),
    );
  });

  it("wirft nicht, wenn die Verbindung fehlschlaegt", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network down");
      }),
    );

    await expect(saveSearchArea("trip-1", POINTS)).resolves.toBeUndefined();
  });
});

describe("removeSearchArea", () => {
  it("sendet die Reise als DELETE an den Server", async () => {
    const fetchMock = vi.fn(async () => ({ ok: true }));
    vi.stubGlobal("fetch", fetchMock);

    await removeSearchArea("trip-1");

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/search-area",
      expect.objectContaining({
        method: "DELETE",
        body: JSON.stringify({ tripId: "trip-1" }),
      }),
    );
  });

  it("wirft nicht, wenn die Verbindung fehlschlaegt", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network down");
      }),
    );

    await expect(removeSearchArea("trip-1")).resolves.toBeUndefined();
  });
});
