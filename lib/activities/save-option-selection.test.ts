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

  it("schickt die Wahl so, dass ein Neuladen sie nicht abbricht (bug-072)", async () => {
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
      expect.objectContaining({ keepalive: true }),
    );
  });

  it("meldet null, statt zu werfen, wenn die Verbindung fehlschlaegt (bug-060)", async () => {
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
    ).resolves.toBeNull();
  });

  it("meldet die Uhrzeit, zu der der Server die Wahl gespeichert hat (bug-073)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ status: "ok", gespeichertUm: 1_790_000_000_000 }),
      })),
    );

    await expect(
      saveOptionSelection(
        "trip-1",
        "2026-07-21T13:30",
        "2026-07-21T15:00",
        "activity-2",
      ),
    ).resolves.toEqual({ gespeichertUm: 1_790_000_000_000 });
  });

  it("meldet eine bestaetigte Wahl auch ohne Uhrzeit des Servers", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true })),
    );

    await expect(
      saveOptionSelection(
        "trip-1",
        "2026-07-21T13:30",
        "2026-07-21T15:00",
        "activity-2",
      ),
    ).resolves.toEqual({ gespeichertUm: null });
  });

  it("meldet null, wenn der Server die Wahl ablehnt (bug-060)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false })),
    );

    await expect(
      saveOptionSelection(
        "trip-1",
        "2026-07-21T13:30",
        "2026-07-21T15:00",
        "activity-2",
      ),
    ).resolves.toBeNull();
  });
});
