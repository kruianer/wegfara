import { describe, expect, it } from "vitest";
import type { Participant } from "./types";
import {
  accountAdmins,
  canSetAccountAdmin,
  isLastAccountAdmin,
  promoteAccountAdminWhereMissing,
  withAccountAdmin,
} from "./account-admin";

function person(id: string, name: string, accountAdmin: boolean): Participant {
  return {
    id,
    accountId: "eb873b95-257b-49c6-b08f-1709d6ad3b94",
    name,
    nickname: null,
    email: null,
    phone: null,
    iban: null,
    loginEnabled: true,
    accountAdmin,
  };
}

const UWE = person("uwe", "Uwe Kremmel", true);
const CLARA = person("clara", "Clara Berger", false);

describe("accountAdmins (req-027)", () => {
  it("nennt nur die Personen mit der Kennzeichnung", () => {
    expect(accountAdmins([UWE, CLARA])).toEqual([UWE]);
  });
});

describe("isLastAccountAdmin (req-027)", () => {
  it("erkennt den einzigen Account-Admin", () => {
    expect(isLastAccountAdmin([UWE, CLARA], UWE.id)).toBe(true);
  });

  it("erkennt ihn nicht, solange ein zweiter die Kennzeichnung traegt", () => {
    const beide = [UWE, { ...CLARA, accountAdmin: true }];

    expect(isLastAccountAdmin(beide, UWE.id)).toBe(false);
  });

  it("gilt nicht fuer eine Person ohne die Kennzeichnung", () => {
    expect(isLastAccountAdmin([UWE, CLARA], CLARA.id)).toBe(false);
  });
});

describe("canSetAccountAdmin (req-027)", () => {
  it("laesst das Ernennen immer zu", () => {
    expect(canSetAccountAdmin([UWE, CLARA], CLARA.id, true)).toBe(true);
  });

  it("laesst den Entzug zu, solange ein zweiter die Kennzeichnung traegt", () => {
    const beide = [UWE, { ...CLARA, accountAdmin: true }];

    expect(canSetAccountAdmin(beide, UWE.id, false)).toBe(true);
  });

  it("laesst den Entzug beim letzten Account-Admin nicht zu", () => {
    expect(canSetAccountAdmin([UWE, CLARA], UWE.id, false)).toBe(false);
  });
});

describe("withAccountAdmin (req-027)", () => {
  it("setzt die Kennzeichnung an dieser Person", () => {
    const nachher = withAccountAdmin([UWE, CLARA], CLARA.id, true);

    expect(nachher.map((p) => p.accountAdmin)).toEqual([true, true]);
  });

  it("laesst die uebrigen unberuehrt", () => {
    const nachher = withAccountAdmin([UWE, CLARA], UWE.id, false);

    expect(nachher.map((p) => p.accountAdmin)).toEqual([false, false]);
  });
});

describe("promoteAccountAdminWhereMissing (req-027)", () => {
  it("laesst eine Liste mit Account-Admin unveraendert", () => {
    const liste = [UWE, CLARA];

    expect(promoteAccountAdminWhereMissing(liste)).toEqual(liste);
  });

  it("ernennt die dienstaelteste Person, wenn keine die Kennzeichnung traegt", () => {
    const ohne = [CLARA, person("max", "Max Gast", false)];

    expect(
      promoteAccountAdminWhereMissing(ohne).map((p) => p.accountAdmin),
    ).toEqual([true, false]);
  });

  it("kommt mit einem Account ohne Personen zurecht", () => {
    expect(promoteAccountAdminWhereMissing([])).toEqual([]);
  });
});
