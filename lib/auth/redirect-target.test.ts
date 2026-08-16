// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  DEFAULT_AFTER_LOGIN,
  loginUrlFor,
  safeRedirectTarget,
} from "./redirect-target";

describe("safeRedirectTarget", () => {
  it("laesst einen Pfad innerhalb der Anwendung durch", () => {
    expect(safeRedirectTarget("/go")).toBe("/go");
    expect(safeRedirectTarget("/plan?tag=2")).toBe("/plan?tag=2");
  });

  it.each([
    ["//fremde-seite.example", "Protokoll-relative Adresse"],
    ["/\\fremde-seite.example", "Backslash-Variante"],
    ["https://fremde-seite.example", "absolute Adresse"],
    ["javascript:alert(1)", "Skript-Adresse"],
  ])("weist %j ab (%s)", (value) => {
    expect(safeRedirectTarget(value)).toBe(DEFAULT_AFTER_LOGIN);
  });

  it("weist Steuerzeichen ab", () => {
    expect(safeRedirectTarget("/go\r\nSet-Cookie: x=1")).toBe(
      DEFAULT_AFTER_LOGIN,
    );
  });

  it("schickt niemanden im Kreis auf die Anmeldeseite zurueck", () => {
    expect(safeRedirectTarget("/anmeldung")).toBe(DEFAULT_AFTER_LOGIN);
    expect(safeRedirectTarget("/anmeldung/notfallcodes")).toBe(
      DEFAULT_AFTER_LOGIN,
    );
  });

  it("faellt ohne Angabe auf die Startseite zurueck", () => {
    expect(safeRedirectTarget(null)).toBe(DEFAULT_AFTER_LOGIN);
    expect(safeRedirectTarget(undefined)).toBe(DEFAULT_AFTER_LOGIN);
    expect(safeRedirectTarget("")).toBe(DEFAULT_AFTER_LOGIN);
  });
});

describe("loginUrlFor", () => {
  it("merkt sich das gewuenschte Ziel", () => {
    expect(loginUrlFor("/go")).toBe("/anmeldung?weiter=%2Fgo");
  });

  it("merkt sich kein fremdes Ziel", () => {
    expect(loginUrlFor("//fremde-seite.example")).toBe("/anmeldung");
  });
});
