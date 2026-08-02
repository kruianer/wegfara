import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// jsdom fuehrt keine Media Queries aus - diese Layout-Eigenschaften der
// Startseite (req-015) werden deshalb direkt am CSS geprueft statt am
// gerenderten DOM (siehe app/go/go-view.layout.test.ts, bug-001).
function readCss(relativePath: string) {
  return readFileSync(
    fileURLToPath(new URL(relativePath, import.meta.url)),
    "utf8",
  );
}

describe("home-view Layout (req-015)", () => {
  it("stellt den Hintergrund auf die dunkle Seitenfarbe #0c0f1e", () => {
    const css = readCss("./home-view.module.css");
    const pageRule = css.match(/\.page\s*{[^}]*}/)?.[0] ?? "";

    expect(pageRule).toMatch(/--page:\s*#0c0f1e/i);
  });

  it("stellt die drei Wege bei schmalem Fenster untereinander", () => {
    const css = readCss("./home-view.module.css");
    const mediaBlock = css.match(/@media[^{]*\{[\s\S]*\}\s*\}/)?.[0] ?? "";
    const waysRuleInMedia = mediaBlock.match(/\.ways\s*{[^}]*}/)?.[0] ?? "";

    expect(waysRuleInMedia).toMatch(/flex-direction:\s*column/);
  });
});
