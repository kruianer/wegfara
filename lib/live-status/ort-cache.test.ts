import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearOrtCache, ORT_CACHE_TTL_MS, ortZurPosition } from "./ort-cache";

const PRAIANO = { lat: 40.6114, lng: 14.6896 };
const NOW = new Date(2026, 6, 20, 14, 10).getTime();

beforeEach(() => {
  clearOrtCache();
});

describe("ortZurPosition (req-051)", () => {
  it("schlaegt die Ortschaft zur Position nach", async () => {
    const lookup = { fromPosition: vi.fn(async () => "Praiano") };

    expect(await ortZurPosition(PRAIANO, lookup, NOW)).toBe("Praiano");
  });

  it("fragt innerhalb des Fensters nicht erneut nach", async () => {
    const lookup = { fromPosition: vi.fn(async () => "Praiano") };

    await ortZurPosition(PRAIANO, lookup, NOW);
    await ortZurPosition({ lat: 40.6114, lng: 14.6897 }, lookup, NOW + 60_000);

    expect(lookup.fromPosition).toHaveBeenCalledTimes(1);
  });

  it("fragt nach Ablauf des Fensters wieder nach", async () => {
    const lookup = { fromPosition: vi.fn(async () => "Praiano") };

    await ortZurPosition(PRAIANO, lookup, NOW);
    await ortZurPosition(PRAIANO, lookup, NOW + ORT_CACHE_TTL_MS + 1);

    expect(lookup.fromPosition).toHaveBeenCalledTimes(2);
  });

  it("fragt fuer eine andere Gegend erneut nach", async () => {
    const lookup = { fromPosition: vi.fn(async () => "Positano") };

    await ortZurPosition(PRAIANO, lookup, NOW);
    await ortZurPosition({ lat: 40.6281, lng: 14.4842 }, lookup, NOW);

    expect(lookup.fromPosition).toHaveBeenCalledTimes(2);
  });
});
