import { describe, expect, it } from "vitest";
import type { PlaceSuggestion } from "@/lib/osm/place-search";
import {
  gefuellteFelder,
  googleOrtFuellung,
  ortsvorschlagFuellung,
} from "./formular-fuellen";
import type { GoogleOrt } from "./google-ort";
import { emptyPoiInput, type PoiInput } from "./validate";

function vorschlag(overrides: Partial<PlaceSuggestion> = {}): PlaceSuggestion {
  return {
    name: "Villa Rufolo",
    context: "Kampanien, Italien",
    lat: 40.6465,
    lng: 14.6127,
    address: "Via Santa Chiara 26, 84010 Ravello, Italien",
    art: "tourism/attraction",
    ...overrides,
  };
}

function googleOrt(overrides: Partial<GoogleOrt> = {}): GoogleOrt {
  return {
    placeId: "ChIJVillaRufolo",
    name: "Villa Rufolo",
    type: "sehenswuerdigkeit",
    position: { lat: 40.6491, lng: 14.6113 },
    address: "Piazza Duomo, 1, 84010 Ravello SA, Italien",
    web: "https://villarufolo.com",
    phone: "+39 089 857621",
    openingHours: "Montag: 09:00–20:00",
    shortText: "Gärten mit Meerblick",
    longText: "Ein Palast aus dem 13. Jahrhundert über der Amalfiküste.",
    bewertung: 4.6,
    bewertungAnzahl: 1240,
    photoNames: ["places/x/photos/a"],
    ...overrides,
  };
}

/** Ein Formularstand, in dem schon etwas steht. */
function ausgefuellt(overrides: Partial<PoiInput> = {}): PoiInput {
  return {
    ...emptyPoiInput(),
    name: "Mein Lieblingsort",
    type: "restaurant",
    address: "Meine Adresse",
    phone: "+49 30 000000",
    shortText: "Mein Kurztext",
    status: "gesetzt",
    ...overrides,
  };
}

describe("ortsvorschlagFuellung (req-048)", () => {
  it("füllt Name, Typ, Adresse und Position", () => {
    const fuellung = ortsvorschlagFuellung(vorschlag());

    expect(fuellung).toEqual({
      name: "Villa Rufolo",
      type: "sehenswuerdigkeit",
      address: "Via Santa Chiara 26, 84010 Ravello, Italien",
      position: { lat: 40.6465, lng: 14.6127 },
    });
  });

  it("überschreibt einen selbst eingetippten Namen", () => {
    const gefuellt = {
      ...ausgefuellt(),
      ...ortsvorschlagFuellung(vorschlag()),
    };

    expect(gefuellt.name).toBe("Villa Rufolo");
  });

  it("lässt den Typ stehen, wenn OpenStreetMap keine Einordnung kennt", () => {
    const gefuellt = {
      ...ausgefuellt(),
      ...ortsvorschlagFuellung(vorschlag({ art: "" })),
    };

    expect(gefuellt.type).toBe("restaurant");
  });

  it("lässt die Adresse stehen, wenn der Vorschlag keine kennt", () => {
    const gefuellt = {
      ...ausgefuellt(),
      ...ortsvorschlagFuellung(vorschlag({ address: "" })),
    };

    expect(gefuellt.address).toBe("Meine Adresse");
  });

  it("lässt den Status unberührt — er beschreibt nicht den Ort", () => {
    const gefuellt = {
      ...ausgefuellt(),
      ...ortsvorschlagFuellung(vorschlag()),
    };

    expect(gefuellt.status).toBe("gesetzt");
  });
});

describe("googleOrtFuellung (req-048)", () => {
  it("füllt alle Felder, die Google kennt", () => {
    const gefuellt = { ...ausgefuellt(), ...googleOrtFuellung(googleOrt()) };

    expect(gefuellt).toMatchObject({
      name: "Villa Rufolo",
      type: "sehenswuerdigkeit",
      position: { lat: 40.6491, lng: 14.6113 },
      address: "Piazza Duomo, 1, 84010 Ravello SA, Italien",
      web: "https://villarufolo.com",
      phone: "+39 089 857621",
      openingHours: "Montag: 09:00–20:00",
      shortText: "Gärten mit Meerblick",
      longText: "Ein Palast aus dem 13. Jahrhundert über der Amalfiküste.",
    });
  });

  it("lässt stehen, was Google nicht kennt", () => {
    const gefuellt = {
      ...ausgefuellt(),
      ...googleOrtFuellung(googleOrt({ phone: "", shortText: "" })),
    };

    expect(gefuellt.phone).toBe("+49 30 000000");
    expect(gefuellt.shortText).toBe("Mein Kurztext");
  });
});

describe("gefuellteFelder (req-048)", () => {
  it("nennt die Angaben, die eine Füllung gesetzt hat", () => {
    expect(gefuellteFelder(ortsvorschlagFuellung(vorschlag()))).toEqual([
      "name",
      "type",
      "position",
      "address",
    ]);
  });

  it("nennt nichts, was die Quelle nicht kannte", () => {
    const felder = gefuellteFelder(
      googleOrtFuellung(googleOrt({ phone: "", web: "", openingHours: "" })),
    );

    expect(felder).not.toContain("phone");
    expect(felder).not.toContain("web");
    expect(felder).not.toContain("openingHours");
  });
});
