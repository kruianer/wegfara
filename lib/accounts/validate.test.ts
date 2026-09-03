import { describe, expect, it } from "vitest";
import {
  ACCOUNT_ERRORS,
  ACCOUNT_NAME_MAX_LENGTH,
  toAccountInput,
  validateAccountDraft,
  type AccountDraft,
} from "./validate";

const HUBER: AccountDraft = {
  name: "Familie Huber",
  personName: "Anna Huber",
  personEmail: "anna@huber.de",
};

describe("validateAccountDraft (req-025)", () => {
  it("laesst vollstaendige Angaben durch", () => {
    expect(validateAccountDraft(HUBER)).toEqual({});
  });

  it("verlangt einen Namen des Accounts", () => {
    expect(validateAccountDraft({ ...HUBER, name: "   " })).toEqual({
      name: ACCOUNT_ERRORS.nameRequired,
    });
  });

  it("begrenzt den Namen des Accounts", () => {
    const zuLang = "H".repeat(ACCOUNT_NAME_MAX_LENGTH + 1);

    expect(validateAccountDraft({ ...HUBER, name: zuLang })).toEqual({
      name: ACCOUNT_ERRORS.nameTooLong,
    });
  });

  it("verlangt eine erste Person", () => {
    expect(validateAccountDraft({ ...HUBER, personName: "" })).toEqual({
      personName: ACCOUNT_ERRORS.personNameRequired,
    });
  });

  it("verlangt ihre E-Mail-Adresse", () => {
    expect(validateAccountDraft({ ...HUBER, personEmail: "" })).toEqual({
      personEmail: ACCOUNT_ERRORS.emailRequired,
    });
  });

  it("weist eine unbrauchbare Adresse zurueck", () => {
    expect(
      validateAccountDraft({ ...HUBER, personEmail: "keine-adresse" }),
    ).toEqual({
      personEmail: ACCOUNT_ERRORS.emailInvalid,
    });
  });
});

describe("toAccountInput (req-025)", () => {
  it("entfernt Leerzeichen und schreibt die Adresse klein", () => {
    expect(
      toAccountInput({
        name: "  Familie Huber  ",
        personName: " Anna Huber ",
        personEmail: " Anna@Huber.DE ",
      }),
    ).toEqual({
      name: "Familie Huber",
      personName: "Anna Huber",
      personEmail: "anna@huber.de",
    });
  });
});
