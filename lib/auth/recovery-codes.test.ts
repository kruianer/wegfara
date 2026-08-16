// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  RECOVERY_CODE_COUNT,
  generateRecoveryCodes,
  hashRecoveryCode,
  isPlausibleRecoveryCode,
  normalizeRecoveryCode,
} from "./recovery-codes";

describe("generateRecoveryCodes", () => {
  it("erzeugt acht Codes (req-016)", () => {
    expect(generateRecoveryCodes()).toHaveLength(RECOVERY_CODE_COUNT);
    expect(RECOVERY_CODE_COUNT).toBe(8);
  });

  it("erzeugt lauter verschiedene Codes", () => {
    const codes = generateRecoveryCodes();

    expect(new Set(codes).size).toBe(codes.length);
  });

  it("erzeugt bei jedem Aufruf einen anderen Satz", () => {
    expect(generateRecoveryCodes()).not.toEqual(generateRecoveryCodes());
  });

  it("gruppiert jeden Code lesbar in drei Vierergruppen", () => {
    for (const code of generateRecoveryCodes()) {
      expect(code).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
    }
  });

  it("verwendet keine verwechselbaren Zeichen", () => {
    for (const code of generateRecoveryCodes()) {
      expect(code).not.toMatch(/[IO01]/);
    }
  });
});

describe("normalizeRecoveryCode", () => {
  it("nimmt Kleinschreibung und fehlende Bindestriche hin", () => {
    const code = generateRecoveryCodes()[0];
    const eingetippt = code.toLowerCase().replace(/-/g, " ");

    expect(normalizeRecoveryCode(eingetippt)).toBe(code);
  });
});

describe("hashRecoveryCode", () => {
  it("speichert den Code nie im Klartext (req-016)", () => {
    const code = generateRecoveryCodes()[0];

    expect(hashRecoveryCode(code)).not.toContain(code.slice(0, 4));
  });

  it("erkennt denselben Code trotz abweichender Schreibweise wieder", () => {
    const code = generateRecoveryCodes()[0];

    expect(hashRecoveryCode(code.toLowerCase())).toBe(hashRecoveryCode(code));
  });

  it("liefert zu verschiedenen Codes verschiedene Pruefsummen", () => {
    const [first, second] = generateRecoveryCodes();

    expect(hashRecoveryCode(first)).not.toBe(hashRecoveryCode(second));
  });
});

describe("isPlausibleRecoveryCode", () => {
  it("nimmt einen vollstaendigen Code an", () => {
    expect(isPlausibleRecoveryCode(generateRecoveryCodes()[0])).toBe(true);
  });

  it("weist zu kurze Eingaben ab", () => {
    expect(isPlausibleRecoveryCode("ABCD-EFGH")).toBe(false);
  });

  it("weist eine leere Eingabe ab", () => {
    expect(isPlausibleRecoveryCode("")).toBe(false);
  });
});
