import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// jsdom fuehrt kein CSS aus -- ob "Liste ausblenden" mit dem Finger bedienbar
// ist (bug-024), wird deshalb direkt am CSS geprueft statt am gerenderten DOM
// (siehe poi-list.layout.test.ts, bug-014).
function readCss(relativePath: string) {
  return readFileSync(
    fileURLToPath(new URL(relativePath, import.meta.url)),
    "utf8",
  );
}

describe("split-view Layout -- Tippziel von „Liste ausblenden“ (bug-024)", () => {
  it("gibt der Schaltflaeche mindestens 44px Hoehe", () => {
    const css = readCss("./split-view.module.css");
    const toggle = css.match(/\.collapseToggle\s*{[^}]*}/)?.[0] ?? "";

    expect(toggle).toMatch(/min-height:\s*44px/);
    expect(toggle).toMatch(/box-sizing:\s*border-box/);
  });
});
