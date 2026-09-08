import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// jsdom fuehrt kein CSS aus -- ob "Abmelden" mit dem Finger bedienbar ist
// (bug-024), wird deshalb direkt am CSS geprueft statt am gerenderten DOM
// (siehe app/plan/components/poi-list.layout.test.ts, bug-014).
function readCss(relativePath: string) {
  return readFileSync(
    fileURLToPath(new URL(relativePath, import.meta.url)),
    "utf8",
  );
}

describe("AbmeldenButton Layout -- Tippziel (bug-024)", () => {
  it("ist mindestens 44x44px gross", () => {
    const css = readCss("./abmelden-button.module.css");
    const buttonRule = css.match(/\.button\s*{[^}]*}/)?.[0] ?? "";

    expect(buttonRule).toMatch(/width:\s*44px/);
    expect(buttonRule).toMatch(/height:\s*44px/);
  });
});
