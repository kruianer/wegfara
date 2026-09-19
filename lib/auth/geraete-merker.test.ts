// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  PASSKEY_MERKER,
  hatPasskeyAufDiesemGeraet,
  merkePasskeyAufDiesemGeraet,
  vergissPasskeyAufDiesemGeraet,
} from "./geraete-merker";

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe("Der Merker dieses Geraets (req-066)", () => {
  it("weiss von einem Geraet ohne Passkey nichts", () => {
    expect(hatPasskeyAufDiesemGeraet()).toBe(false);
  });

  it("merkt sich einen eingerichteten Passkey", () => {
    merkePasskeyAufDiesemGeraet();

    expect(localStorage.getItem(PASSKEY_MERKER)).toBe("ja");
    expect(hatPasskeyAufDiesemGeraet()).toBe(true);
  });

  it("vergisst ihn wieder, wenn kein Passkey mehr uebrig ist", () => {
    merkePasskeyAufDiesemGeraet();
    vergissPasskeyAufDiesemGeraet();

    expect(hatPasskeyAufDiesemGeraet()).toBe(false);
  });

  it("kommt ohne Speicher aus, statt die Anmeldeseite zu zerlegen", () => {
    // Safari wirft im privaten Modus schon beim Zugriff auf localStorage.
    vi.stubGlobal("window", {
      get localStorage(): Storage {
        throw new Error("kein Speicher");
      },
    });

    expect(hatPasskeyAufDiesemGeraet()).toBe(false);
    expect(() => merkePasskeyAufDiesemGeraet()).not.toThrow();
    expect(() => vergissPasskeyAufDiesemGeraet()).not.toThrow();
  });
});
