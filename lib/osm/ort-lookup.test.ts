import { afterEach, describe, expect, it, vi } from "vitest";
import { nominatimOrtLookup } from "./ort-lookup";

/** Nominatim wird gemockt -- kein Test haengt im Netz (siehe stack.md). */
function nominatimAntwortet(body: unknown, ok = true) {
  const fetchMock = vi.fn(async () => ({ ok, json: async () => body }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

/** Die Adressbestandteile zu "Via Richard Wagner 5, 84010 Ravello SA, Italien". */
const RAVELLO_ADRESSE = {
  address: {
    road: "Via Richard Wagner",
    house_number: "5",
    town: "Ravello",
    county: "Salerno",
    state: "Kampanien",
    postcode: "84010",
    country: "Italien",
  },
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("nominatimOrtLookup.fromAddress (req-041)", () => {
  it("liefert die Ortschaft ohne Region und ohne Land", async () => {
    nominatimAntwortet([RAVELLO_ADRESSE]);

    expect(
      await nominatimOrtLookup.fromAddress(
        "Via Richard Wagner 5, 84010 Ravello SA, Italien",
      ),
    ).toBe("Ravello");
  });

  it("fragt Nominatim mit einem identifizierenden User-Agent", async () => {
    const fetchMock = nominatimAntwortet([RAVELLO_ADRESSE]);

    await nominatimOrtLookup.fromAddress("Piazza Duomo, Ravello");

    const [url, options] = fetchMock.mock.calls[0] as unknown as [
      string,
      { headers: Record<string, string> },
    ];
    expect(url).toContain("/search?");
    expect(url).toContain("q=Piazza%20Duomo%2C%20Ravello");
    expect(options.headers["User-Agent"]).toContain("wegfara");
  });

  it("liefert nichts, wenn nichts passt", async () => {
    nominatimAntwortet([]);

    expect(await nominatimOrtLookup.fromAddress("Irgendwo 1")).toBeNull();
  });

  it("liefert nichts, wenn der Treffer keine Ortschaft kennt", async () => {
    nominatimAntwortet([
      { address: { state: "Kampanien", country: "Italien" } },
    ]);

    expect(await nominatimOrtLookup.fromAddress("Kampanien")).toBeNull();
  });

  it("liefert nichts, wenn Nominatim mit einem Fehler antwortet", async () => {
    nominatimAntwortet([RAVELLO_ADRESSE], false);

    expect(await nominatimOrtLookup.fromAddress("Ravello")).toBeNull();
  });

  it("liefert nichts, wenn Nominatim nicht erreichbar ist", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("offline");
      }),
    );

    expect(await nominatimOrtLookup.fromAddress("Ravello")).toBeNull();
  });
});

describe("nominatimOrtLookup.fromPosition (req-041)", () => {
  it("liefert die Ortschaft, in der die Position liegt", async () => {
    const fetchMock = nominatimAntwortet(RAVELLO_ADRESSE);

    expect(
      await nominatimOrtLookup.fromPosition({ lat: 40.6491, lng: 14.6113 }),
    ).toBe("Ravello");
    const [url] = fetchMock.mock.calls[0] as unknown as [string];
    expect(url).toContain("/reverse?");
    expect(url).toContain("lat=40.6491");
    expect(url).toContain("lon=14.6113");
  });

  it("liefert nichts, wenn dort keine Ortschaft liegt", async () => {
    nominatimAntwortet({ address: { country: "Italien" } });

    expect(
      await nominatimOrtLookup.fromPosition({ lat: 40, lng: 14 }),
    ).toBeNull();
  });
});
