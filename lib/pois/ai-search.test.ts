import { describe, expect, it, vi } from "vitest";
import {
  extractRequestedCount,
  parseSuggestedPlaces,
  searchPoisWithAi,
  MAX_SUGGESTIONS,
  type AiSearchDeps,
} from "./ai-search";
import type { GooglePlace } from "@/lib/google/types";
import type { AiAntwort } from "@/lib/ai/client";
import {
  LEERE_PRAEFERENZEN,
  type ReisePraeferenzen,
} from "@/lib/trips/praeferenzen";

const SQUARE = [
  { lat: 0, lng: 0 },
  { lat: 0, lng: 2 },
  { lat: 2, lng: 2 },
  { lat: 2, lng: 0 },
];

const INSIDE = { lat: 1, lng: 1 };
const OUTSIDE = { lat: 9, lng: 9 };

function place(overrides: Partial<GooglePlace> = {}): GooglePlace {
  return {
    placeId: "place-a",
    name: "Trulli di Alberobello",
    ort: "Alberobello",
    position: INSIDE,
    types: ["tourist_attraction"],
    photoNames: ["places/place-a/photos/foto-1"],
    rating: 4.6,
    ratingCount: 1240,
    ...overrides,
  };
}

/** Eine geglueckte Antwort der KI mit diesen Orten (siehe lib/ai/client.ts). */
function antwort(
  namen: string[],
  grund = "Passt zu Natur & Wandern.",
): AiAntwort {
  return {
    ok: true,
    text: JSON.stringify({ orte: namen.map((name) => ({ name, grund })) }),
  };
}

function deps(overrides: Partial<AiSearchDeps> = {}): AiSearchDeps {
  return {
    describeRegion: vi.fn(async () => "Bari, Apulien"),
    suggestPlaces: vi.fn(async () => antwort(["Ort A"])),
    lookupPlace: vi.fn(async () => place()),
    ...overrides,
  };
}

function params(
  overrides: Partial<Parameters<typeof searchPoisWithAi>[0]> = {},
) {
  return {
    searchArea: SQUARE,
    typeFilter: "alle" as const,
    wish: "",
    existingNames: [],
    praeferenzen: LEERE_PRAEFERENZEN,
    ...overrides,
  };
}

function praeferenzen(
  overrides: Partial<ReisePraeferenzen> = {},
): ReisePraeferenzen {
  return { ...LEERE_PRAEFERENZEN, ...overrides };
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

describe("parseSuggestedPlaces (req-057)", () => {
  it("liest Namen und Begruendung aus einer gueltigen JSON-Antwort", () => {
    expect(
      parseSuggestedPlaces(
        '{"orte": [{"name": "Alberobello", "grund": "Viel Geschichte."}]}',
      ),
    ).toEqual([{ name: "Alberobello", grund: "Viel Geschichte." }]);
  });

  it("entfernt Markdown-Codefences um die Antwort", () => {
    expect(
      parseSuggestedPlaces(
        '```json\n{"orte": [{"name": "Alberobello", "grund": "Schön."}]}\n```',
      ),
    ).toEqual([{ name: "Alberobello", grund: "Schön." }]);
  });

  it("liefert eine leere Liste bei unparsebarem Text", () => {
    expect(parseSuggestedPlaces("das ist kein JSON")).toEqual([]);
  });

  it("liefert eine leere Liste ohne orte-Feld", () => {
    expect(parseSuggestedPlaces('{"foo": "bar"}')).toEqual([]);
  });

  it("uebergeht Eintraege ohne Namen", () => {
    expect(
      parseSuggestedPlaces(
        '{"orte": [{"grund": "Ohne Namen"}, {"name": "B"}]}',
      ),
    ).toEqual([{ name: "B", grund: "" }]);
  });

  it("nimmt einen Ort auch ohne Begruendung an", () => {
    expect(parseSuggestedPlaces('{"orte": [{"name": "A"}]}')).toEqual([
      { name: "A", grund: "" },
    ]);
  });
});

describe("searchPoisWithAi", () => {
  /**
   * Ein Fehlschlag traegt seinen Grund bei sich (bug-032) -- ohne ihn stand
   * am Ende nur "Fehler", und der Nutzer suchte bei seinem Zugangsschluessel.
   */
  it("nennt die Region als Grund, wenn ihre Beschreibung fehlschlaegt", async () => {
    const result = await searchPoisWithAi(
      params(),
      deps({ describeRegion: vi.fn(async () => null) }),
    );

    expect(result.fehler).toEqual({ art: "region", detail: "" });
    expect(result.treffer).toEqual([]);
  });

  it("reicht den Grund der KI weiter, wenn sie nicht antwortet", async () => {
    const result = await searchPoisWithAi(
      params(),
      deps({
        suggestPlaces: vi.fn(async () => ({
          ok: false as const,
          fehler: {
            art: "modell" as const,
            detail: "you must provide a model parameter",
          },
        })),
      }),
    );

    expect(result.fehler).toEqual({
      art: "modell",
      detail: "you must provide a model parameter",
    });
    expect(result.treffer).toEqual([]);
  });

  it("traegt bei einem geglueckten Lauf keinen Grund", async () => {
    expect((await searchPoisWithAi(params(), deps())).fehler).toBeNull();
  });

  it("uebernimmt Foto, Bewertung, Beschreibung und Begruendung eines Treffers", async () => {
    const result = await searchPoisWithAi(
      params(),
      deps({
        suggestPlaces: vi.fn(async () =>
          antwort(["Ort A"], "Passt zu eurem Interesse an Geschichte."),
        ),
        lookupPlace: vi.fn(async () =>
          place({ description: "Kegelhäuser aus Kalkstein." }),
        ),
      }),
    );

    expect(result?.treffer).toHaveLength(1);
    expect(result?.treffer[0].draft).toMatchObject({
      name: "Trulli di Alberobello",
      ort: "Alberobello",
      type: "sehenswuerdigkeit",
      position: INSIDE,
      googlePlaceId: "place-a",
      bewertung: 4.6,
      bewertungAnzahl: 1240,
      shortText: "Kegelhäuser aus Kalkstein.",
      longText: "Kegelhäuser aus Kalkstein.",
      kiBegruendung: "Passt zu eurem Interesse an Geschichte.",
    });
    expect(result?.treffer[0].photoNames).toEqual([
      "places/place-a/photos/foto-1",
    ]);
    expect(result?.discardedCount).toBe(0);
  });

  it("verwirft einen Vorschlag, den Google nicht kennt", async () => {
    const result = await searchPoisWithAi(
      params(),
      deps({ lookupPlace: vi.fn(async () => null) }),
    );

    expect(result?.treffer).toEqual([]);
    expect(result?.discardedCount).toBe(1);
  });

  it("verwirft einen gefundenen Ort ausserhalb des Suchgebiets", async () => {
    const result = await searchPoisWithAi(
      params(),
      deps({ lookupPlace: vi.fn(async () => place({ position: OUTSIDE })) }),
    );

    expect(result?.treffer).toEqual([]);
    expect(result?.discardedCount).toBe(1);
  });

  it("sucht nur im Rechteck um das gezeichnete Suchgebiet", async () => {
    const lookupPlace = vi.fn(async () => place());
    await searchPoisWithAi(params(), deps({ lookupPlace }));

    expect(lookupPlace).toHaveBeenCalledWith("Ort A", {
      minLat: 0,
      maxLat: 2,
      minLng: 0,
      maxLng: 2,
    });
  });

  it("verwendet bei gesetztem Typfilter dessen Typ, unabhaengig von der Art bei Google", async () => {
    const result = await searchPoisWithAi(
      params({ typeFilter: "restaurant" }),
      deps({ lookupPlace: vi.fn(async () => place({ types: ["hotel"] })) }),
    );

    expect(result?.treffer[0].draft.type).toBe("restaurant");
  });

  it("bildet ohne Typfilter die Art bei Google auf einen POI-Typ ab", async () => {
    const result = await searchPoisWithAi(
      params(),
      deps({ lookupPlace: vi.fn(async () => place({ types: ["beach"] })) }),
    );

    expect(result?.treffer[0].draft.type).toBe("strand");
  });

  it("schlaegt einen bereits vorhandenen POI nicht erneut nach", async () => {
    const lookupPlace = vi.fn(async () => place());
    const result = await searchPoisWithAi(
      params({ existingNames: ["Ort A"] }),
      deps({
        suggestPlaces: vi.fn(async () => antwort(["ort a"])),
        lookupPlace,
      }),
    );

    expect(lookupPlace).not.toHaveBeenCalled();
    expect(result?.treffer).toEqual([]);
    expect(result?.discardedCount).toBe(1);
  });

  it("legt einen bereits vorhandenen Google-Ort kein zweites Mal an", async () => {
    const result = await searchPoisWithAi(
      params({ existingPlaceIds: ["place-a"] }),
      deps(),
    );

    expect(result?.treffer).toEqual([]);
    expect(result?.discardedCount).toBe(1);
  });

  it("nennt der KI die bereits vorhandenen POIs, damit sie andere vorschlaegt", async () => {
    const suggestPlaces = vi.fn(async () => antwort([]));
    await searchPoisWithAi(
      params({ existingNames: ["Villa Rufolo", "Trattoria da Nennella"] }),
      deps({ suggestPlaces }),
    );

    expect(suggestPlaces).toHaveBeenCalledWith(
      expect.stringContaining("Villa Rufolo, Trattoria da Nennella"),
    );
  });

  it("begrenzt die Vorschlaege ohne Textwunsch auf zwanzig", async () => {
    const namen = Array.from({ length: 25 }, (_, i) => `Ort ${i}`);
    const lookupPlace = vi.fn(async (name: string) =>
      place({ placeId: name, name }),
    );
    const result = await searchPoisWithAi(
      params(),
      deps({ suggestPlaces: vi.fn(async () => antwort(namen)), lookupPlace }),
    );

    expect(lookupPlace).toHaveBeenCalledTimes(MAX_SUGGESTIONS);
    expect(result?.treffer).toHaveLength(MAX_SUGGESTIONS);
  });

  it("hebt eine im Wunsch genannte groessere Anzahl nicht ueber zwanzig", async () => {
    const namen = Array.from({ length: 40 }, (_, i) => `Ort ${i}`);
    const lookupPlace = vi.fn(async (name: string) =>
      place({ placeId: name, name }),
    );
    const result = await searchPoisWithAi(
      params({ wish: "gib mir 35 Treffer" }),
      deps({ suggestPlaces: vi.fn(async () => antwort(namen)), lookupPlace }),
    );

    expect(result?.treffer).toHaveLength(MAX_SUGGESTIONS);
  });

  it("verwendet eine kleinere im Wunsch genannte Anzahl als Obergrenze", async () => {
    const namen = Array.from({ length: 25 }, (_, i) => `Ort ${i}`);
    const lookupPlace = vi.fn(async (name: string) =>
      place({ placeId: name, name }),
    );
    const result = await searchPoisWithAi(
      params({ wish: "höchstens 12 Treffer" }),
      deps({ suggestPlaces: vi.fn(async () => antwort(namen)), lookupPlace }),
    );

    expect(lookupPlace).toHaveBeenCalledTimes(12);
    expect(result?.treffer).toHaveLength(12);
  });
});

describe("searchPoisWithAi mit Praeferenzen (req-057)", () => {
  it("nennt der KI die angekreuzten Interessen", async () => {
    const suggestPlaces = vi.fn(async () => antwort([]));
    await searchPoisWithAi(
      params({ praeferenzen: praeferenzen({ interessen: ["natur_wandern"] }) }),
      deps({ suggestPlaces }),
    );

    expect(suggestPlaces).toHaveBeenCalledWith(
      expect.stringContaining("Natur & Wandern"),
    );
  });

  it("nennt der KI, worauf die Gruppe Wert legt", async () => {
    const suggestPlaces = vi.fn(async () => antwort([]));
    await searchPoisWithAi(
      params({ praeferenzen: praeferenzen({ wertAuf: "wenig Trubel" }) }),
      deps({ suggestPlaces }),
    );

    expect(suggestPlaces).toHaveBeenCalledWith(
      expect.stringContaining("wenig Trubel"),
    );
  });

  it("nennt der KI, was die Gruppe nicht will", async () => {
    const suggestPlaces = vi.fn(async () => antwort([]));
    await searchPoisWithAi(
      params({ praeferenzen: praeferenzen({ nichtWollen: "keine Museen" }) }),
      deps({ suggestPlaces }),
    );

    expect(suggestPlaces).toHaveBeenCalledWith(
      expect.stringContaining("keine Museen"),
    );
  });

  it("nennt der KI die Mindestbewertung", async () => {
    const suggestPlaces = vi.fn(async () => antwort([]));
    await searchPoisWithAi(
      params({ praeferenzen: praeferenzen({ mindestbewertung: 4 }) }),
      deps({ suggestPlaces }),
    );

    expect(suggestPlaces).toHaveBeenCalledWith(
      expect.stringContaining("mindestens 4,0 von 5"),
    );
  });

  it("nennt der KI nichts von alldem, wenn keine Praeferenz gesetzt ist", async () => {
    let prompt = "";
    const suggestPlaces = vi.fn(async (gestellt: string) => {
      prompt = gestellt;
      return antwort([]);
    });
    await searchPoisWithAi(params(), deps({ suggestPlaces }));

    expect(prompt).not.toContain("Darauf legt die Gruppe Wert");
    expect(prompt).not.toContain("mindestens");
  });

  it("verwirft einen Ort unterhalb der Mindestbewertung", async () => {
    const result = await searchPoisWithAi(
      params({ praeferenzen: praeferenzen({ mindestbewertung: 4 }) }),
      deps({ lookupPlace: vi.fn(async () => place({ rating: 3.9 })) }),
    );

    expect(result?.treffer).toEqual([]);
    expect(result?.discardedCount).toBe(1);
  });

  it("uebernimmt einen Ort genau auf der Mindestbewertung", async () => {
    const result = await searchPoisWithAi(
      params({ praeferenzen: praeferenzen({ mindestbewertung: 4 }) }),
      deps({ lookupPlace: vi.fn(async () => place({ rating: 4 })) }),
    );

    expect(result?.treffer).toHaveLength(1);
  });

  it("verwirft bei gesetzter Mindestbewertung einen Ort ohne Bewertung", async () => {
    const result = await searchPoisWithAi(
      params({ praeferenzen: praeferenzen({ mindestbewertung: 4 }) }),
      deps({
        lookupPlace: vi.fn(async () =>
          place({ rating: undefined, ratingCount: undefined }),
        ),
      }),
    );

    expect(result?.treffer).toEqual([]);
    expect(result?.discardedCount).toBe(1);
  });

  it("uebernimmt ohne Mindestbewertung auch einen Ort ohne Bewertung", async () => {
    const result = await searchPoisWithAi(
      params(),
      deps({
        lookupPlace: vi.fn(async () =>
          place({ rating: undefined, ratingCount: undefined }),
        ),
      }),
    );

    expect(result?.treffer).toHaveLength(1);
    expect(result?.treffer[0].draft.bewertung).toBeUndefined();
  });

  it("legt keinen Ort an, den die KI wegen „Was wir nicht wollen“ nicht nennt", async () => {
    // Die Grenze liegt hier: was die Gruppe nicht will, steht im Prompt --
    // die KI nennt es dann gar nicht erst. Geprueft wird beides zusammen.
    const suggestPlaces = vi.fn(async (prompt: string) =>
      prompt.includes("keine Museen")
        ? antwort(["Botanischer Garten"])
        : antwort(["Archäologisches Museum", "Botanischer Garten"]),
    );
    const result = await searchPoisWithAi(
      params({ praeferenzen: praeferenzen({ nichtWollen: "keine Museen" }) }),
      deps({
        suggestPlaces,
        lookupPlace: vi.fn(async (name: string) =>
          place({ placeId: name, name }),
        ),
      }),
    );

    expect(result?.treffer.map((t) => t.draft.name)).toEqual([
      "Botanischer Garten",
    ]);
  });
});
