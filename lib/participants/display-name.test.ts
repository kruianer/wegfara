import { describe, expect, it } from "vitest";
import type { Participant } from "./types";
import { participantDisplayName, participantPaymentName } from "./display-name";

const CLARA: Participant = {
  id: "9b1c1e3a-6d0a-4f57-9a3f-2c2b7f5f1111",
  accountId: "eb873b95-257b-49c6-b08f-1709d6ad3b94",
  name: "Clara Berger",
  nickname: "Clari",
  email: null,
  phone: null,
  iban: "AT611904300234573201",
  loginEnabled: false,
};

describe("participantDisplayName (req-020)", () => {
  it("nennt die Person beim Nicknamen", () => {
    expect(participantDisplayName(CLARA)).toBe("Clari");
  });

  it("nennt die Person beim Namen, wo kein Nickname steht", () => {
    expect(
      participantDisplayName({ ...CLARA, name: "Max Gast", nickname: null }),
    ).toBe("Max Gast");
  });

  it("nennt die Person beim Namen, wo der Nickname entfernt wurde", () => {
    expect(participantDisplayName({ ...CLARA, nickname: "  " })).toBe(
      "Clara Berger",
    );
  });
});

describe("participantPaymentName (req-020)", () => {
  it("nennt bei der Bankverbindung immer den vollen Namen", () => {
    expect(participantPaymentName(CLARA)).toBe("Clara Berger");
  });
});
