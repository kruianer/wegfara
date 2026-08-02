import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// jsdom laedt kein CSS -- ob der helle Browser-Standardrand (bug-005)
// tatsaechlich entfernt wird, wird deshalb direkt am CSS und am Import in
// layout.tsx geprueft statt am gerenderten DOM (siehe
// app/go/go-view.layout.test.ts, bug-001).
function readFile(relativePath: string) {
  return readFileSync(
    fileURLToPath(new URL(relativePath, import.meta.url)),
    "utf8",
  );
}

describe("Root Layout -- heller Rand um die Seite (bug-005)", () => {
  it("bindet das globale Stylesheet ein", () => {
    const layout = readFile("./layout.tsx");

    expect(layout).toMatch(/import\s+["']\.\/globals\.css["']/);
  });

  it("entfernt den Standardabstand am body", () => {
    const css = readFile("./globals.css");
    const bodyRule = css.match(/(?:html\s*,\s*)?body\s*{[^}]*}/)?.[0] ?? "";

    expect(bodyRule).toMatch(/margin:\s*0/);
  });

  it("stellt am body den dunklen Seitenhintergrund statt des hellen Browser-Standards", () => {
    const css = readFile("./globals.css");
    const bodyRule = css.match(/(?:html\s*,\s*)?body\s*{[^}]*}/)?.[0] ?? "";

    expect(bodyRule).toMatch(/background:\s*#0c0f1e/);
  });
});
