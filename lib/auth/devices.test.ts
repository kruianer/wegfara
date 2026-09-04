// @vitest-environment node
import { describe, expect, it } from "vitest";
import { formatDeviceMoment, passkeyRemovalRefusal } from "./devices";

const IPHONE = { id: "cred-iphone" };
const IPAD = { id: "cred-ipad" };

describe("passkeyRemovalRefusal (req-037)", () => {
  it("laesst ein Geraet entfernen, solange ein weiteres bleibt", () => {
    expect(
      passkeyRemovalRefusal([IPHONE, IPAD], IPAD.id, "uwe@kremmel.org"),
    ).toBeNull();
  });

  it("laesst auch den letzten Passkey entfernen, wenn eine Adresse hinterlegt ist", () => {
    // Ueber den Anmeldelink kommt die Person wieder herein.
    expect(
      passkeyRemovalRefusal([IPHONE], IPHONE.id, "uwe@kremmel.org"),
    ).toBeNull();
  });

  it("verweigert den letzten Passkey ohne hinterlegte Adresse", () => {
    // Sonst sperrt sich der Nutzer selbst aus: kein Geraet, kein Postfach.
    expect(passkeyRemovalRefusal([IPHONE], IPHONE.id, null)).toBe(
      "letzterOhneAdresse",
    );
  });

  it("wertet eine leere Adresse wie keine", () => {
    expect(passkeyRemovalRefusal([IPHONE], IPHONE.id, "   ")).toBe(
      "letzterOhneAdresse",
    );
  });

  it("weist einen fremden Passkey ab", () => {
    expect(
      passkeyRemovalRefusal([IPHONE], "cred-fremd", "uwe@kremmel.org"),
    ).toBe("unbekannt");
  });
});

describe("formatDeviceMoment (req-037)", () => {
  it("nennt Tag, Monat und Jahr zweistellig", () => {
    expect(formatDeviceMoment(new Date(2026, 8, 4, 14, 30))).toBe("04.09.2026");
  });

  it("laesst den Jahreswechsel unverschoben", () => {
    expect(formatDeviceMoment(new Date(2026, 11, 31, 23, 30))).toBe(
      "31.12.2026",
    );
  });
});
