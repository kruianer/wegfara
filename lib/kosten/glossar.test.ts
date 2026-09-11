// @vitest-environment node
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * Der Begriff "Kostenplanung" gehoert ins Glossar (req-062): Requirements,
 * Bugs und Code sollen ihn einheitlich verwenden. Geprueft wird das an der
 * Quelle -- ein Eintrag, den jemand wieder herausnimmt, faellt so auf.
 */
describe("Glossar (req-062)", () => {
  const stack = readFileSync(
    path.join(process.cwd(), "delivery", "stack.md"),
    "utf8",
  );

  it("kennt den Begriff „Kostenplanung“", () => {
    expect(stack).toMatch(/^\| Kostenplanung\s+\|/m);
  });

  /**
   * Die Kostenplanung ist die Kalkulation vorher, die Ausgabe das
   * tatsaechlich Gezahlte -- der Eintrag haelt beide auseinander.
   */
  it("grenzt sie gegen die Ausgaben ab", () => {
    const zeile = stack.match(/^\| Kostenplanung\s+\|.*$/m)?.[0] ?? "";
    expect(zeile).toMatch(/Ausgaben/);
  });
});
