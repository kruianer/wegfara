import { describe, expect, it } from "vitest";
import {
  TRIP_DESCRIPTION_MAX_LENGTH,
  TRIP_ERRORS,
  TRIP_TITLE_MAX_LENGTH,
  tripDraftIsValid,
  validateTripDraft,
  type TripDraft,
} from "./validate";

const FLORENZ = { name: "Florenz", lat: 43.7696, lng: 11.2558 };

function draft(overrides: Partial<TripDraft> = {}): TripDraft {
  return {
    title: "Toskana 2027",
    startDate: "2027-05-12",
    endDate: "2027-05-19",
    mainPlace: FLORENZ,
    description: "",
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
