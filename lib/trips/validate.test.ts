import { describe, expect, it } from "vitest";
import {
  TRIP_DESCRIPTION_MAX_LENGTH,
  TRIP_ERRORS,
  TRIP_TITLE_MAX_LENGTH,
  tripDraftIsValid,
  validateTripDraft,
  type TripDraft,
} from "./validate";
import { LEERE_PRAEFERENZEN, PRAEFERENZ_TEXT_MAX_LENGTH } from "./praeferenzen";

const FLORENZ = { name: "Florenz", lat: 43.7696, lng: 11.2558 };

function draft(overrides: Partial<TripDraft> = {}): TripDraft {
  return {
    title: "Toskana 2027",
    startDate: "2027-05-12",
    endDate: "2027-05-19",
    mainPlace: FLORENZ,
    description: "",
    tempo: "ausgewogen",
    praeferenzen: LEERE_PRAEFERENZEN,
    ...overrides,
  };
}

describe("validateTripDraft (req-017)", () => {
  it("beanstandet vollstaendige Eingaben nicht", () => {
    expect(validateTripDraft(draft())).toEqual({});
    expect(tripDraftIsValid(draft())).toBe(true);
  });

  it("verlangt einen Titel", () => {
    expect(validateTripDraft(draft({ title: "   " })).title).toBe(
      TRIP_ERRORS.titleRequired,
    );
  });

  it(`laesst einen Titel mit ${TRIP_TITLE_MAX_LENGTH} Zeichen zu`, () => {
    expect(
      validateTripDraft(draft({ title: "T".repeat(TRIP_TITLE_MAX_LENGTH) }))
        .title,
    ).toBeUndefined();
  });

  it(`beanstandet einen Titel mit ${TRIP_TITLE_MAX_LENGTH + 1} Zeichen`, () => {
    expect(
      validateTripDraft(draft({ title: "T".repeat(TRIP_TITLE_MAX_LENGTH + 1) }))
        .title,
    ).toBe(TRIP_ERRORS.titleTooLong);
  });

  it("verlangt Beginn und Ende", () => {
    const errors = validateTripDraft(draft({ startDate: "", endDate: "" }));

    expect(errors.startDate).toBe(TRIP_ERRORS.startRequired);
    expect(errors.endDate).toBe(TRIP_ERRORS.endRequired);
  });

  it("beanstandet ein Ende vor dem Beginn", () => {
    const errors = validateTripDraft(
      draft({ startDate: "2027-05-12", endDate: "2027-05-05" }),
    );

    expect(errors.endDate).toBe(TRIP_ERRORS.endBeforeStart);
    expect(tripDraftIsValid(draft({ endDate: "2027-05-05" }))).toBe(false);
  });

  it("laesst einen eintaegigen Zeitraum zu", () => {
    expect(
      validateTripDraft(
        draft({ startDate: "2027-05-12", endDate: "2027-05-12" }),
      ),
    ).toEqual({});
  });

  it("laesst einen zurueckliegenden Zeitraum zu", () => {
    expect(
      validateTripDraft(
        draft({ startDate: "2019-04-01", endDate: "2019-04-10" }),
      ),
    ).toEqual({});
  });

  it("beanstandet ein Datum, das es nicht gibt", () => {
    expect(
      validateTripDraft(draft({ startDate: "2027-02-30" })).startDate,
    ).toBe(TRIP_ERRORS.startInvalid);
  });

  it("verlangt einen Hauptort", () => {
    expect(validateTripDraft(draft({ mainPlace: null })).mainPlace).toBe(
      TRIP_ERRORS.mainPlaceRequired,
    );
  });
});

describe("Beschreibung einer Reise (req-033)", () => {
  it("ist freiwillig -- leer ist zulaessig", () => {
    expect(validateTripDraft(draft({ description: "" }))).toEqual({});
  });

  it(`laesst ${TRIP_DESCRIPTION_MAX_LENGTH} Zeichen zu`, () => {
    expect(
      validateTripDraft(
        draft({ description: "x".repeat(TRIP_DESCRIPTION_MAX_LENGTH) }),
      ).description,
    ).toBeUndefined();
  });

  it(`beanstandet ${TRIP_DESCRIPTION_MAX_LENGTH + 1} Zeichen`, () => {
    const zuLang = draft({
      description: "x".repeat(TRIP_DESCRIPTION_MAX_LENGTH + 1),
    });

    expect(validateTripDraft(zuLang).description).toBe(
      TRIP_ERRORS.descriptionTooLong,
    );
    expect(tripDraftIsValid(zuLang)).toBe(false);
  });

  it("laesst mehrere Zeilen zu", () => {
    expect(
      validateTripDraft(draft({ description: "Zeile eins\nZeile zwei" })),
    ).toEqual({});
  });
});

/**
 * Die Praeferenzen einer Reise (req-057). Alle vier sind freiwillig; die
 * beiden Saetze in eigenen Worten haben eine Hoechstlaenge.
 */
describe("Praeferenzen einer Reise (req-057)", () => {
  function mit(praeferenzen: Partial<typeof LEERE_PRAEFERENZEN>) {
    return draft({ praeferenzen: { ...LEERE_PRAEFERENZEN, ...praeferenzen } });
  }

  it("sind freiwillig -- eine Reise ohne sie ist zulaessig", () => {
    expect(validateTripDraft(draft())).toEqual({});
  });

  it(`laesst bei "Worauf legen wir Wert" ${PRAEFERENZ_TEXT_MAX_LENGTH} Zeichen zu`, () => {
    const gerade = mit({ wertAuf: "x".repeat(PRAEFERENZ_TEXT_MAX_LENGTH) });

    expect(validateTripDraft(gerade)).toEqual({});
    expect(tripDraftIsValid(gerade)).toBe(true);
  });

  it(`beanstandet bei "Worauf legen wir Wert" ${PRAEFERENZ_TEXT_MAX_LENGTH + 1} Zeichen`, () => {
    const zuLang = mit({ wertAuf: "x".repeat(PRAEFERENZ_TEXT_MAX_LENGTH + 1) });

    expect(validateTripDraft(zuLang).wertAuf).toBe(TRIP_ERRORS.wertAufTooLong);
    expect(tripDraftIsValid(zuLang)).toBe(false);
  });

  it(`beanstandet bei "Was wir nicht wollen" ${PRAEFERENZ_TEXT_MAX_LENGTH + 1} Zeichen`, () => {
    const zuLang = mit({
      nichtWollen: "x".repeat(PRAEFERENZ_TEXT_MAX_LENGTH + 1),
    });

    expect(validateTripDraft(zuLang).nichtWollen).toBe(
      TRIP_ERRORS.nichtWollenTooLong,
    );
    expect(tripDraftIsValid(zuLang)).toBe(false);
  });

  it("beanstandet angekreuzte Interessen und eine Mindestbewertung nie", () => {
    expect(
      validateTripDraft(
        mit({ interessen: ["natur_wandern"], mindestbewertung: 4.5 }),
      ),
    ).toEqual({});
  });
});
