import { afterEach, describe, expect, it, vi } from "vitest";
import { sendePosition } from "./sende-position";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("sendePosition (req-050)", () => {
  it("schickt Reise und Koordinaten an den Server", async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await sendePosition("reise-1", 40.6114, 14.6896);

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/positionen",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ tripId: "reise-1", lat: 40.6114, lng: 14.6896 }),
      }),
    );
  });

  it("wirft nicht weiter, wenn die Anfrage fehlschlaegt", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("offline");
      }),
    );

    await expect(
      sendePosition("reise-1", 40.6114, 14.6896),
    ).resolves.toBeUndefined();
  });
});
