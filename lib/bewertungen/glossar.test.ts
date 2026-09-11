// @vitest-environment node
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * Der Begriff "Zustimmung" gehoert ins Glossar (req-063): Requirements, Bugs
 * und Code sollen ihn einheitlich verwenden. Geprueft wird das an der Quelle
 * -- ein Eintrag, den jemand wieder herausnimmt, faellt so auf.
 */
describe("Glossar (req-063)", () => {
  const stack = readFileSync(
    path.join(process.cwd(), "delivery", "stack.md"),
    "utf8",
  );

  it("kennt den Begriff „Zustimmung“", () => {
    expect(stack).toMatch(/^\| Zustimmung\s+\|/m);
  });

  /**
   * Die Zustimmung ordnet die Zeilen, sie entscheidet nicht -- aus den
   * Stimmen folgt nie ein Status (req-054).
   */
  it("haelt fest, dass aus ihr kein Status folgt", () => {
    const zeile = stack.match(/^\| Zustimmung\s+\|.*$/m)?.[0] ?? "";
    expect(zeile).toMatch(/nie ein Status/);
  });
});
