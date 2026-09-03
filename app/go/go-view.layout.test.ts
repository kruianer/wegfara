import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// jsdom fuehrt kein Layout aus - eine gerenderte Komponente hat in Tests
// immer Hoehe 0, unabhaengig vom CSS. Der Kartenbereich (bug-001) braucht
// aber tatsaechlich eine von Null verschiedene Hoehe: die Karte rendert
// sonst in eine Flaeche von 0 Pixeln. Dieser Test prueft deshalb direkt am
// CSS, dass der Container-Kette eine definite Hoehe zugrunde liegt, statt
// nur eine, die vom (bei leerer Karte fehlenden) Inhalt abhaengt.
function readCss(relativePath: string) {
  return readFileSync(
    fileURLToPath(new URL(relativePath, import.meta.url)),
    "utf8",
  );
}

describe("go-view Layout (bug-001)", () => {
  it("gibt .app eine definite Hoehe statt nur einer Mindesthoehe", () => {
    const css = readCss("./go-view.module.css");
    const appRule = css.match(/\.app\s*{[^}]*}/)?.[0] ?? "";

    // Seit req-025 um die Hoehe des Hinweisbalkens verkuerzt -- die Hoehe
    // bleibt damit definit, sie haengt weiterhin nicht am Inhalt.
    expect(appRule).toMatch(/(?<!min-)height:\s*(?:100dvh|calc\(100dvh)/);
  });

  it("erlaubt .content, auf die tatsaechlich verfuegbare Hoehe zu schrumpfen", () => {
    const css = readCss("./go-view.module.css");
    const contentRule = css.match(/\.content\s*{[^}]*}/)?.[0] ?? "";

    expect(contentRule).toMatch(/flex:\s*1/);
    expect(contentRule).toMatch(/min-height:\s*0/);
  });
});
