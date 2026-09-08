import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// jsdom fuehrt kein CSS aus -- ob die Kopfzeile mit dem Finger bedienbar ist
// (bug-024), wird deshalb direkt am CSS geprueft statt am gerenderten DOM
// (siehe poi-list.layout.test.ts, bug-014).
function readCss(relativePath: string) {
  return readFileSync(
    fileURLToPath(new URL(relativePath, import.meta.url)),
    "utf8",
  );
}

function rule(css: string, selector: string) {
  return css.match(new RegExp(`\\.${selector}\\s*{[^}]*}`))?.[0] ?? "";
}

describe("header Layout -- Tippziele der Bereichs- und Reise-Knoepfe (bug-024)", () => {
  const css = readCss("./header.module.css");

  it("gibt den Bereichs-Knoepfen und Verweisen (POIs, Begleiter, ...) mindestens 44px Hoehe", () => {
    const navButton = rule(css, "navButton");
    expect(navButton).toMatch(/min-height:\s*44px/);
    expect(navButton).toMatch(/box-sizing:\s*border-box/);
  });

  it("gibt dem Reise-Knopf mindestens 44px Hoehe", () => {
    const tripButton = rule(css, "tripButton");
    expect(tripButton).toMatch(/min-height:\s*44px/);
    expect(tripButton).toMatch(/box-sizing:\s*border-box/);
  });
});
