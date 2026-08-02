import { describe, expect, it, vi } from "vitest";
import { findPlace } from "./overpass-client";

const BBOX = { minLat: 40.7, maxLat: 40.9, minLng: 17.1, maxLng: 17.3 };

function overpassResponse(elements: unknown[]) {
  return { ok: true, json: async () => ({ elements }) };
}

describe("findPlace", () => {
  it("liefert Name, Ort, Position und Typ eines gefundenen Knotens", async () => {
    const fetchMock = vi.fn(async () =>
      overpassResponse([
        {
          type: "node",
          lat: 40.78,
          lon: 17.24,
          tags: {
            name: "Trulli di Alberobello",
            amenity: "restaurant",
            "addr:city": "Alberobello",
          },
        },
      ]),
    );
    vi.stubGlobal("fetch", fetchMock);

    const place = await findPlace("Trulli di Alberobello", BBOX, null);

    expect(place).toEqual({
      name: "Trulli di Alberobello",
      ort: "Alberobello",
      position: { lat: 40.78, lng: 17.24 },
      type: "restaurant",
      web: undefined,
    });
  });

  it("nutzt den Center-Punkt fuer einen Way statt lat/lon", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        overpassResponse([
          {
            type: "way",
            center: { lat: 40.79, lon: 17.25 },
            tags: { name: "Rione Monti" },
          },
        ]),
      ),
    );

    const place = await findPlace("Rione Monti", BBOX, null);

    expect(place?.position).toEqual({ lat: 40.79, lng: 17.25 });
  });

  it("liefert die Website, wenn hinterlegt", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        overpassResponse([
          {
            lat: 40.78,
            lon: 17.24,
            tags: {
              name: "Museo del Territorio",
              website: "https://example.com",
            },
          },
        ]),
      ),
    );

    const place = await findPlace("Museo del Territorio", BBOX, null);

    expect(place?.web).toBe("https://example.com");
  });

  it("liefert null, wenn kein Element gefunden wird", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => overpassResponse([])),
    );

    expect(await findPlace("Unbekannter Ort", BBOX, null)).toBeNull();
  });

  it("ueberspringt Elemente ohne Namens-Tag und nimmt das naechste", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        overpassResponse([
          { lat: 40.78, lon: 17.24, tags: {} },
          { lat: 40.79, lon: 17.25, tags: { name: "Chiesa di Sant'Antonio" } },
        ]),
      ),
    );

    const place = await findPlace("Chiesa di Sant'Antonio", BBOX, null);

    expect(place?.name).toBe("Chiesa di Sant'Antonio");
  });

  it("schraenkt die Anfrage bei gesetztem Typfilter auf dessen OSM-Tags ein", async () => {
    const fetchMock = vi.fn<typeof fetch>(
      async () => overpassResponse([]) as unknown as Response,
    );
    vi.stubGlobal("fetch", fetchMock);

    await findPlace("Trattoria da Nennella", BBOX, ["restaurant"]);

    const body = fetchMock.mock.calls[0][1]?.body as string;
    expect(decodeURIComponent(body)).toContain('["amenity"="restaurant"]');
  });

  it("liefert null bei einem Netzwerkfehler", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network down");
      }),
    );

    expect(await findPlace("Irgendein Ort", BBOX, null)).toBeNull();
  });

  it("liefert null bei einer Fehler-Antwort", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, json: async () => ({}) })),
    );

    expect(await findPlace("Irgendein Ort", BBOX, null)).toBeNull();
  });
});
