import { describe, expect, it, vi } from "vitest";
import {
  MAX_PLACE_SUGGESTIONS,
  MIN_PLACE_QUERY_LENGTH,
  searchPlaces,
} from "./place-search";

function nominatimAntwortet(entries: unknown[]) {
  const fetchMock = vi.fn(async () => ({
    ok: true,
    json: async () => entries,
  }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

const FLORENZ = {
  name: "Florenz",
  display_name: "Florenz, Toskana, Italien",
  lat: "43.7698712",
  lon: "11.2555757",
  address: { state: "Toskana", country: "Italien" },
};

describe("searchPlaces (req-017)", () => {
  it("liefert Name, einordnende Angabe und Position", async () => {
    nominatimAntwortet([FLORENZ]);

    expect(await searchPlaces("Floren")).toEqual([
      {
        name: "Florenz",
        context: "Toskana, Italien",
        lat: 43.7698712,
        lng: 11.2555757,
        ort: "",
        address: "",
      },
    ]);
  });

  it("fragt Nominatim mit einem identifizierenden User-Agent", async () => {
    const fetchMock = nominatimAntwortet([FLORENZ]);

    await searchPlaces("Floren");

    const [url, options] = fetchMock.mock.calls[0] as unknown as [
      string,
      { headers: Record<string, string> },
    ];
    expect(url).toContain("q=Floren");
    expect(options.headers["User-Agent"]).toContain("wegfara");
  });

  it(`liefert hoechstens ${MAX_PLACE_SUGGESTIONS} Vorschlaege`, async () => {
    nominatimAntwortet(
      Array.from({ length: 12 }, (_, i) => ({ ...FLORENZ, name: `Ort ${i}` })),
    );

    expect(await searchPlaces("Ort")).toHaveLength(MAX_PLACE_SUGGESTIONS);
  });

  it("sucht bei zu kurzer Eingabe gar nicht erst", async () => {
    const fetchMock = nominatimAntwortet([FLORENZ]);

    expect(await searchPlaces("F".repeat(MIN_PLACE_QUERY_LENGTH - 1))).toEqual(
      [],
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("faellt auf den Anfang des Anzeigenamens zurueck, wenn kein Name geliefert wird", async () => {
    nominatimAntwortet([{ ...FLORENZ, name: undefined }]);

    expect((await searchPlaces("Floren"))[0].name).toBe("Florenz");
  });

  it("laesst Eintraege ohne Position weg", async () => {
    nominatimAntwortet([{ ...FLORENZ, lat: undefined, lon: undefined }]);

    expect(await searchPlaces("Floren")).toEqual([]);
  });

  it("liefert eine leere Liste bei einem Netzwerkfehler", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network down");
      }),
    );

    expect(await searchPlaces("Floren")).toEqual([]);
  });

  it("liefert eine leere Liste bei einer Fehler-Antwort", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, json: async () => [] })),
    );

    expect(await searchPlaces("Floren")).toEqual([]);
  });
});
