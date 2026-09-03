// @vitest-environment node
import { describe, expect, it } from "vitest";
import { createToken, hashSecret, secretsMatch } from "./tokens";

describe("createToken", () => {
  it("liefert bei jedem Aufruf ein anderes Token", () => {
    const tokens = new Set(Array.from({ length: 50 }, () => createToken()));

    expect(tokens.size).toBe(50);
  });

  it("liefert ein Token, das unveraendert in eine URL passt", () => {
    expect(createToken()).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("liefert ein Token mit 256 Bit Zufall", () => {
    // 32 Bytes ergeben in base64url 43 Zeichen.
    expect(createToken()).toHaveLength(43);
  });
});

describe("hashSecret", () => {
  it("liefert zum selben Geheimnis dieselbe Pruefsumme", () => {
    expect(hashSecret("geheim")).toBe(hashSecret("geheim"));
  });

  it("liefert zu verschiedenen Geheimnissen verschiedene Pruefsummen", () => {
    expect(hashSecret("geheim")).not.toBe(hashSecret("geheim2"));
  });

  it("gibt das Geheimnis nicht preis", () => {
    expect(hashSecret("geheim")).not.toContain("geheim");
  });
});

describe("secretsMatch", () => {
  it("erkennt gleiche Werte", () => {
    expect(secretsMatch(hashSecret("a"), hashSecret("a"))).toBe(true);
  });

  it("erkennt verschiedene Werte", () => {
    expect(secretsMatch(hashSecret("a"), hashSecret("b"))).toBe(false);
  });

  it("erkennt verschieden lange Werte, ohne zu werfen", () => {
    expect(secretsMatch("kurz", "deutlich laenger")).toBe(false);
  });
});
