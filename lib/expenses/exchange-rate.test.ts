import { describe, expect, it, vi } from "vitest";
import { fetchEuroRate } from "./exchange-rate";

function antwortet(payload: unknown, ok = true) {
  return vi.fn(async () => ({ ok, json: async () => payload }));
}

describe("fetchEuroRate (req-029)", () => {
  it("holt den Kurs des Tages als Euro je Einheit der Waehrung", async () => {
    let gefragt = "";
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        gefragt = url;
        return { ok: true, json: async () => ({ rates: { EUR: 1.06 } }) };
      }),
    );

    await expect(fetchEuroRate("CHF")).resolves.toBe(1.06);
    expect(gefragt).toContain("base=CHF");
    expect(gefragt).toContain("frankfurter");
  });

  it("fragt fuer Euro gar nicht erst nach", async () => {
    const fetchMock = antwortet({});
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchEuroRate("EUR")).resolves.toBe(1);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("liefert null, wenn die Quelle nicht erreichbar ist", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("offline");
      }),
    );

    await expect(fetchEuroRate("USD")).resolves.toBeNull();
  });

  it("liefert null bei einer Fehlerantwort", async () => {
    vi.stubGlobal("fetch", antwortet({ rates: { EUR: 1.1 } }, false));

    await expect(fetchEuroRate("USD")).resolves.toBeNull();
  });

  it("liefert null, wenn die Antwort keinen brauchbaren Kurs enthaelt", async () => {
    vi.stubGlobal("fetch", antwortet({ rates: { EUR: "1,10" } }));
    await expect(fetchEuroRate("GBP")).resolves.toBeNull();

    vi.stubGlobal("fetch", antwortet({ rates: { EUR: 0 } }));
    await expect(fetchEuroRate("GBP")).resolves.toBeNull();
  });
});
