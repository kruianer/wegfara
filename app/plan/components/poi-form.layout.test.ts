import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// jsdom fuehrt kein CSS aus -- ob die Knoepfe des Formulars im sichtbaren
// Bereich bleiben (bug-016), wird deshalb direkt am CSS geprueft statt am
// gerenderten DOM (siehe poi-list.layout.test.ts, bug-014).
function readCss(relativePath: string) {
  return readFileSync(
    fileURLToPath(new URL(relativePath, import.meta.url)),
    "utf8",
  );
}

function rule(css: string, selector: string) {
  return css.match(new RegExp(`\\.${selector}\\s*{[^}]*}`))?.[0] ?? "";
}

describe("poi-form Layout -- Erreichbarkeit von Speichern (bug-016)", () => {
  const css = readCss("./poi-form.module.css");

  it("haelt die Knopfleiste am unteren Rand des sichtbaren Bereichs", () => {
    const actions = rule(css, "actions");
    expect(actions).toMatch(/position:\s*sticky/);
    expect(actions).toMatch(/bottom:\s*0/);
  });

  it("gibt der Knopfleiste einen deckenden Hintergrund", () => {
    // Ohne ihn scheinen die Felder durch, ueber denen die Leiste steht.
    const actions = rule(css, "actions");
    expect(actions).toMatch(/background:\s*var\(--card\)/);
  });

  it("laesst die Ortsvorschlaege ueber der Knopfleiste liegen", () => {
    const actionsZ = Number(
      rule(css, "actions").match(/z-index:\s*(\d+)/)?.[1] ?? 0,
    );
    const suggestionsZ = Number(
      rule(css, "suggestions").match(/z-index:\s*(\d+)/)?.[1] ?? 0,
    );
    expect(suggestionsZ).toBeGreaterThan(actionsZ);
  });
});
