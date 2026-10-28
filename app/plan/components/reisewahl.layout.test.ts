import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { TIPPZIEL_PX } from "@/lib/design/stil";

// jsdom fuehrt kein CSS aus -- ob die Reisewahl mit dem Finger bedienbar ist
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

describe("Reisewahl Layout -- Tippziel des Reise-Knopfes (bug-024)", () => {
  const css = readCss("./reisewahl.module.css");

  /** Das Tippziel kommt seit req-094 aus lib/design/stil.ts (req-089). */
  it("gibt dem Reise-Knopf mindestens 44px Hoehe", () => {
    const tripButton = rule(css, "tripButton");
    expect(tripButton).toMatch(/min-height:\s*var\(--tippziel\)/);
    expect(TIPPZIEL_PX).toBe(44);
    expect(tripButton).toMatch(/box-sizing:\s*border-box/);
  });

  /**
   * Er fuellt die Breite der Leiste -- sie laesst innen mehr als 44 px
   * (req-094, siehe seitenleiste.layout.test.ts).
   */
  it("füllt die Breite der Leiste", () => {
    expect(rule(css, "tripButton")).toMatch(/width:\s*100%/);
  });

  /** Das Aufklappmenue geht neben der Leiste auf, nicht unter ihr (req-077). */
  it("öffnet das Aufklappmenü neben der Leiste", () => {
    const dropdown = rule(css, "dropdown");
    expect(dropdown).toMatch(/left:\s*calc\(100% \+ \d+px\)/);
    expect(dropdown).not.toMatch(/right:\s*0/);
  });
});
