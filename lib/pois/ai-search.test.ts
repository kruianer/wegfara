import { describe, expect, it, vi } from "vitest";
import {
  extractRequestedCount,
  parseSuggestedNames,
  searchPoisWithAi,
  type AiSearchDeps,
  type LookedUpPlace,
} from "./ai-search";

const SQUARE = [
  { lat: 0, lng: 0 },
  { lat: 0, lng: 2 },
  { lat: 2, lng: 2 },
  { lat: 2, lng: 0 },
];

const INSIDE = { lat: 1, lng: 1 };
const OUTSIDE = { lat: 9, lng: 9 };

function place(overrides: Partial<LookedUpPlace> = {}): LookedUpPlace {
  return {
    name: "Trulli di Alberobello",
    ort: "Alberobello",
    position: INSIDE,
    type: "sehenswuerdigkeit",
    ...overrides,
  };
}

function deps(overrides: Partial<AiSearchDeps> = {}): AiSearchDeps {
  return {
    describeRegion: vi.fn(async () => "Bari, Apulien"),
    suggestNames: vi.fn(async () => JSON.stringify({ names: ["Ort A"] })),
    lookupPlace: vi.fn(async () => place()),
    ...overrides,
  };
}

describe("extractRequestedCount", () => {
  it("liefert null ohne Zahl im Text", () => {
    expect(extractRequestedCount("ruhige Strände")).toBeNull();
  });

  it("liefert die erste im Text genannte Zahl", () => {
    expect(extractRequestedCount("höchstens 20 Treffer")).toBe(20);
  });

  it("liefert null bei einer Null", () => {
    expect(extractRequestedCount("0 Treffer")).toBeNull();
  });
});

describe("parseSuggestedNames", () => {
  it("liest die Namen aus einer gueltigen JSON-Antwort", () => {
    expect(
      parseSuggestedNames('{"names": ["Alberobello", "Locorotondo"]}'),
    ).toEqual(["Alberobello", "Locorotondo"]);
  });

  it("entfernt Markdown-Codefences um die Antwort", () => {
    expect(
      parseSuggestedNames('```json\n{"names": ["Alberobello"]}\n```'),
    ).toEqual(["Alberobello"]);
  });

  it("liefert eine leere Liste bei unparsebarem Text", () => {
    expect(parseSuggestedNames("das ist kein JSON")).toEqual([]);
  });

  it("liefert eine leere Liste ohne names-Feld", () => {
    expect(parseSuggestedNames('{"foo": "bar"}')).toEqual([]);
  });

  it("filtert nicht-string Eintraege heraus", () => {
    expect(parseSuggestedNames('{"names": ["A", 3, null, "B"]}')).toEqual([
      "A",
      "B",
    ]);
  });
});

describe("searchPoisWithAi", () => {
  it("liefert null, wenn die Regionsbeschreibung fehlschlaegt", async () => {
    const result = await searchPoisWithAi(
      { searchArea: SQUARE, typeFilter: "alle", wish: "", existingNames: [] },
      deps({ describeRegion: vi.fn(async () => null) }),
    );

    expect(result).toBeNull();
  });

  it("liefert null, wenn die KI nicht erreichbar ist", async () => {
    const result = await searchPoisWithAi(
      { searchArea: SQUARE, typeFilter: "alle", wish: "", existingNames: [] },
      deps({ suggestNames: vi.fn(async () => null) }),
    );

    expect(result).toBeNull();
  });

  it("legt einen gefundenen, innerhalb liegenden Vorschlag als Entwurf an", async () => {
    const result = await searchPoisWithAi(
      { searchArea: SQUARE, typeFilter: "alle", wish: "", existingNames: [] },
      deps(),
    );

    expect(result?.drafts).toEqual([
      {
        name: "Trulli di Alberobello",
        ort: "Alberobello",
        type: "sehenswuerdigkeit",
        position: INSIDE,
        web: undefined,
      },
    ]);
    expect(result?.discardedCount).toBe(0);
  });

  it("verwirft einen Vorschlag, der in den Kartendaten nicht gefunden wird", async () => {
    const result = await searchPoisWithAi(
      { searchArea: SQUARE, typeFilter: "alle", wish: "", existingNames: [] },
      deps({ lookupPlace: vi.fn(async () => null) }),
    );

    expect(result?.drafts).toEqual([]);
    expect(result?.discardedCount).toBe(1);
  });

  it("verwirft einen gefundenen Ort ausserhalb des Suchgebiets", async () => {
    const result = await searchPoisWithAi(
      { searchArea: SQUARE, typeFilter: "alle", wish: "", existingNames: [] },
      deps({ lookupPlace: vi.fn(async () => place({ position: OUTSIDE })) }),
    );

    expect(result?.drafts).toEqual([]);
    expect(result?.discardedCount).toBe(1);
  });

  it("verwendet bei gesetztem Typfilter dessen Typ, unabhaengig vom OSM-Tag", async () => {
    const result = await searchPoisWithAi(
      {
        searchArea: SQUARE,
        typeFilter: "restaurant",
        wish: "",
        existingNames: [],
      },
      deps({
        lookupPlace: vi.fn(async () => place({ type: "hotel" })),
      }),
    );

    expect(result?.drafts[0].type).toBe("restaurant");
  });

  it("schraenkt die Kartensuche auf die erlaubten Typen ein", async () => {
    const lookupPlace = vi.fn(async () => place());
    await searchPoisWithAi(
      {
        searchArea: SQUARE,
        typeFilter: "restaurant",
        wish: "",
        existingNames: [],
      },
      deps({ lookupPlace }),
    );

    expect(lookupPlace).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(Object),
      ["restaurant"],
    );
  });

  it("schlaegt eine bereits vorhandene POI nicht erneut nach", async () => {
    const lookupPlace = vi.fn(async () => place());
    const result = await searchPoisWithAi(
      {
        searchArea: SQUARE,
        typeFilter: "alle",
        wish: "",
        existingNames: ["Ort A"],
      },
      deps({
        suggestNames: vi.fn(async () => JSON.stringify({ names: ["ort a"] })),
        lookupPlace,
      }),
    );

    expect(lookupPlace).not.toHaveBeenCalled();
    expect(result?.drafts).toEqual([]);
    expect(result?.discardedCount).toBe(1);
  });

  it("nennt der KI die bereits vorhandenen POIs, damit sie andere vorschlaegt", async () => {
    const suggestNames = vi.fn(async () => JSON.stringify({ names: [] }));
    await searchPoisWithAi(
      {
        searchArea: SQUARE,
        typeFilter: "alle",
        wish: "",
        existingNames: ["Villa Rufolo", "Trattoria da Nennella"],
      },
      deps({ suggestNames }),
    );

    expect(suggestNames).toHaveBeenCalledWith(
      expect.stringContaining("Villa Rufolo, Trattoria da Nennella"),
    );
  });

  it("begrenzt die Vorschlaege ohne Textwunsch auf zehn", async () => {
    const names = Array.from({ length: 15 }, (_, i) => `Ort ${i}`);
    const lookupPlace = vi.fn(async () => place());
    const result = await searchPoisWithAi(
      { searchArea: SQUARE, typeFilter: "alle", wish: "", existingNames: [] },
      deps({
        suggestNames: vi.fn(async () => JSON.stringify({ names })),
        lookupPlace,
      }),
    );

    expect(lookupPlace).toHaveBeenCalledTimes(10);
    expect(result?.drafts).toHaveLength(10);
  });

  it("verwendet die im Wunsch genannte Anzahl als Obergrenze", async () => {
    const names = Array.from({ length: 15 }, (_, i) => `Ort ${i}`);
    const lookupPlace = vi.fn(async () => place());
    const result = await searchPoisWithAi(
      {
        searchArea: SQUARE,
        typeFilter: "alle",
        wish: "höchstens 12 Treffer",
        existingNames: [],
      },
      deps({
        suggestNames: vi.fn(async () => JSON.stringify({ names })),
        lookupPlace,
      }),
    );

    expect(lookupPlace).toHaveBeenCalledTimes(12);
    expect(result?.drafts).toHaveLength(12);
  });
});
