import { describe, expect, it, vi } from "vitest";
import { saveOptionSelection } from "./save-option-selection";

describe("saveOptionSelection", () => {
  it("sendet Reise, Beginn, Ende und gewaehlten Programmpunkt an den Server", async () => {
    const fetchMock = vi.fn(async () => ({ ok: true }));
    vi.stubGlobal("fetch", fetchMock);

    await saveOptionSelection(
      "trip-1",
      "2026-07-21T13:30",
      "2026-07-21T15:00",
      "activity-2",
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/activity-option-selection",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          tripId: "trip-1",
          startAt: "2026-07-21T13:30",
          endAt: "2026-07-21T15:00",
          activityId: "activity-2",
        }),
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

    await expect(
      saveOptionSelection(
        "trip-1",
        "2026-07-21T13:30",
        "2026-07-21T15:00",
        "activity-2",
      ),
    ).resolves.toBeUndefined();
  });
});
