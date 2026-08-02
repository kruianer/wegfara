import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// jsdom fuehrt kein CSS aus -- ob der Kartenfläche die Behandlung von
// Touch-Gesten uebergeben wird (bug-005), wird deshalb direkt am CSS
// geprueft statt am gerenderten DOM (siehe app/go/go-view.layout.test.ts,
// bug-001).
function readCss(relativePath: string) {
  return readFileSync(
    fileURLToPath(new URL(relativePath, import.meta.url)),
    "utf8",
  );
}

describe("poi-map Layout -- Touch-Verhalten der Kartenflaeche (bug-005)", () => {
  it("ueberlaesst Touch-Gesten auf der Kartenflaeche vollstaendig MapLibre", () => {
    const css = readCss("./poi-map.module.css");
    const mapRule = css.match(/\.map\s*{[^}]*}/)?.[0] ?? "";

    expect(mapRule).toMatch(/touch-action:\s*none/);
  });
});
