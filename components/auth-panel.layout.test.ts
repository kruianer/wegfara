import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// jsdom fuehrt kein CSS aus -- ob die Anmelde- und Einladungsseiten mit dem
// Finger bedienbar sind (bug-024), wird deshalb direkt am CSS geprueft statt
// am gerenderten DOM (siehe app/plan/components/poi-list.layout.test.ts,
// bug-014).
function readCss(relativePath: string) {
  return readFileSync(
    fileURLToPath(new URL(relativePath, import.meta.url)),
    "utf8",
  );
}

function rule(css: string, selector: string) {
  return css.match(new RegExp(`\\.${selector}\\s*{[^}]*}`))?.[0] ?? "";
}

describe("auth-panel Layout -- Tippziele (bug-024)", () => {
  const css = readCss("./auth-panel.module.css");

  it('gibt "Passkey einrichten" / "Anmeldelink senden" (primaryButton, secondaryButton) mindestens 44px Hoehe', () => {
    expect(rule(css, "primaryButton")).toMatch(/min-height:\s*44px/);
    expect(rule(css, "secondaryButton")).toMatch(/min-height:\s*44px/);
  });

  it('gibt "Später einrichten" (linkButton) mindestens 44px Hoehe', () => {
    expect(rule(css, "linkButton")).toMatch(/min-height:\s*44px/);
  });

  it("gibt dem E-Mail-/Notfallcode-Feld (input) mindestens 44px Hoehe", () => {
    expect(rule(css, "input")).toMatch(/min-height:\s*44px/);
  });
});
