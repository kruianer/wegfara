// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { deployTokenMatches } from "./deploy-token";

const VORHER = process.env.AUTH_SECRET;

beforeEach(() => {
  process.env.AUTH_SECRET = "ein-sehr-langes-geheimnis";
});

afterEach(() => {
  if (VORHER === undefined) delete process.env.AUTH_SECRET;
  else process.env.AUTH_SECRET = VORHER;
});

describe("deployTokenMatches (req-053)", () => {
  it("erkennt das Geheimnis der Umgebung", () => {
    expect(deployTokenMatches("ein-sehr-langes-geheimnis")).toBe(true);
  });

  it("weist ein falsches zurueck", () => {
    expect(deployTokenMatches("ein-sehr-langes-geheimnix")).toBe(false);
    expect(deployTokenMatches("zu-kurz")).toBe(false);
  });

  it("weist eine fehlende Angabe zurueck", () => {
    expect(deployTokenMatches(null)).toBe(false);
    expect(deployTokenMatches("")).toBe(false);
  });

  it("laesst ohne AUTH_SECRET niemanden durch", () => {
    delete process.env.AUTH_SECRET;

    expect(deployTokenMatches("egal")).toBe(false);
    expect(deployTokenMatches("")).toBe(false);
  });
});
