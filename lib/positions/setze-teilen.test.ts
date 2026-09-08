import { afterEach, describe, expect, it, vi } from "vitest";
import { setzePositionTeilen } from "./setze-teilen";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("setzePositionTeilen (req-050)", () => {
  it("schickt Reise und gewuenschten Zustand an den Server", async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await setzePositionTeilen("reise-1", true);

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/position-teilen",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ tripId: "reise-1", geteilt: true }),
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
      setzePositionTeilen("reise-1", false),
    ).resolves.toBeUndefined();
  });
});
