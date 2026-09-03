import { describe, expect, it } from "vitest";
import {
  PARTICIPANT_ERRORS,
  PARTICIPANT_NAME_MAX_LENGTH,
  participantDraftIsValid,
  toParticipantInput,
  validateParticipantDraft,
  type ParticipantDraft,
} from "./validate";

const CLARA: ParticipantDraft = {
  name: "Clara Berger",
  email: "clara@example.com",
  phone: "+43 664 1234567",
  iban: "AT611904300234573201",
};

describe("validateParticipantDraft (req-019)", () => {
  it("nimmt eine vollstaendige Angabe an", () => {
    expect(validateParticipantDraft(CLARA)).toEqual({});
    expect(participantDraftIsValid(CLARA)).toBe(true);
  });

  it("nimmt eine Person nur mit Namen an", () => {
    const draft = { name: "Max Gast", email: "", phone: "", iban: "" };

    expect(validateParticipantDraft(draft)).toEqual({});
  });

  it("verlangt einen Namen", () => {
    expect(validateParticipantDraft({ ...CLARA, name: "   " })).toEqual({
      name: PARTICIPANT_ERRORS.nameRequired,
    });
  });

  it("laesst hoechstens 80 Zeichen im Namen zu", () => {
    const name = "N".repeat(PARTICIPANT_NAME_MAX_LENGTH + 1);

    expect(validateParticipantDraft({ ...CLARA, name })).toEqual({
      name: PARTICIPANT_ERRORS.nameTooLong,
    });
    expect(
      validateParticipantDraft({
        ...CLARA,
        name: "N".repeat(PARTICIPANT_NAME_MAX_LENGTH),
      }),
    ).toEqual({});
  });

  it("weist eine unbrauchbare Adresse zurueck", () => {
    expect(validateParticipantDraft({ ...CLARA, email: "clara" })).toEqual({
      email: PARTICIPANT_ERRORS.emailInvalid,
    });
  });

  it("weist eine Bankverbindung mit falscher Pruefziffer zurueck", () => {
    expect(
      validateParticipantDraft({ ...CLARA, iban: "AT611904300234573200" }),
    ).toEqual({ iban: PARTICIPANT_ERRORS.ibanInvalid });
  });

  it("benennt jede betroffene Stelle einzeln", () => {
    expect(
      validateParticipantDraft({
        name: "",
        email: "x",
        phone: "",
        iban: "AT1",
      }),
    ).toEqual({
      name: PARTICIPANT_ERRORS.nameRequired,
      email: PARTICIPANT_ERRORS.emailInvalid,
      iban: PARTICIPANT_ERRORS.ibanInvalid,
    });
  });

  it("verlangt die Adresse, wo sie fuer die Anmeldung gebraucht wird", () => {
    expect(
      validateParticipantDraft(
        { ...CLARA, email: "" },
        { emailRequired: true },
      ),
    ).toEqual({ email: PARTICIPANT_ERRORS.emailRequiredForLogin });
  });

  it("prueft die Telefonnummer nicht -- sie darf jede Form haben", () => {
    expect(
      validateParticipantDraft({ ...CLARA, phone: "0664/123 45 67" }),
    ).toEqual({});
  });
});

describe("toParticipantInput (req-019)", () => {
  it("legt Leergelassenes als null ab", () => {
    expect(
      toParticipantInput({
        name: " Max Gast ",
        email: " ",
        phone: "",
        iban: "",
      }),
    ).toEqual({ name: "Max Gast", email: null, phone: null, iban: null });
  });

  it("vereinheitlicht Adresse und Bankverbindung", () => {
    expect(
      toParticipantInput({
        name: "Clara Berger",
        email: " Clara@Example.COM ",
        phone: " +43 664 1234567 ",
        iban: "at61 1904 3002 3457 3201",
      }),
    ).toEqual({
      name: "Clara Berger",
      email: "clara@example.com",
      phone: "+43 664 1234567",
      iban: "AT611904300234573201",
    });
  });
});
