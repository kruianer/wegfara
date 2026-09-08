import { afterEach, describe, expect, it, vi } from "vitest";
import { ladePositionen } from "./lade-positionen";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ladePositionen (req-050)", () => {
  it("liest die Positionen aus der Antwort", async () => {
    const positionen = [
      {
        tripId: "reise-1",
        participantId: "person-1",
        name: "Uwe",
        lat: 40.6114,
        lng: 14.6896,
        ort: null,
        recordedAt: "2026-07-20T14:09:00.000Z",
      },
    ];
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ positionen }))),
    );

    expect(await ladePositionen("reise-1")).toEqual(positionen);
  });

  it("gibt eine leere Liste, wenn die Anfrage fehlschlaegt", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("offline");
      }),
    );

    expect(await ladePositionen("reise-1")).toEqual([]);
  });

  it("gibt eine leere Liste bei einer Fehlerantwort", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, { status: 500 })),
    );

    expect(await ladePositionen("reise-1")).toEqual([]);
  });

  it("gibt eine leere Liste bei einer unlesbaren Antwort", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("kein json")),
    );

    expect(await ladePositionen("reise-1")).toEqual([]);
  });
});
