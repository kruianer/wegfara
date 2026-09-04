import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// jsdom fuehrt kein CSS aus -- ob das Formular einer Zeile die ganze Breite
// der Liste bekommt (bug-014), wird deshalb direkt am CSS geprueft statt am
// gerenderten DOM (siehe app/go/go-view.layout.test.ts, bug-001).
function readCss(relativePath: string) {
  return readFileSync(
    fileURLToPath(new URL(relativePath, import.meta.url)),
    "utf8",
  );
}

function rule(css: string, selector: string) {
  return css.match(new RegExp(`\\.${selector}\\s*{[^}]*}`))?.[0] ?? "";
}

describe("poi-list Layout -- Breite des Formulars einer Zeile (bug-014)", () => {
  const css = readCss("./poi-list.module.css");

  it("teilt die Zeile selbst nicht in Spalten -- das taete .rowTop", () => {
    expect(rule(css, "row")).not.toMatch(/display:\s*flex/);
    expect(rule(css, "rowTop")).toMatch(/display:\s*flex/);
  });

  it("gibt dem Formular der Zeile dieselbe Breite wie dem beim Anlegen", () => {
    // Beide sitzen mit demselben seitlichen Abstand im linken Container:
    // das Formular beim Anlegen ueber .formStandalone, das der Zeile ueber
    // die Innenabstaende der Liste.
    expect(rule(css, "rows")).toMatch(/padding:\s*0 22px 22px/);
    expect(rule(css, "row")).not.toMatch(/padding-(left|right)/);
    expect(rule(readCss("./poi-form.module.css"), "formStandalone")).toMatch(
      /margin:\s*0 22px 13px/,
    );
  });
});

describe("poi-list Layout -- Erreichbarkeit der Formulare (bug-016)", () => {
  const css = readCss("./poi-list.module.css");

  it("scrollt alles unter den Leisten in einem Bereich, nicht nur die Liste", () => {
    const scroll = rule(css, "scroll");
    expect(scroll).toMatch(/overflow-y:\s*auto/);
    expect(scroll).toMatch(/flex:\s*1/);
    // Ohne min-height: 0 waechst der Bereich mit seinem Inhalt statt zu
    // scrollen -- der Ueberstand wird dann von .pane abgeschnitten.
    expect(scroll).toMatch(/min-height:\s*0/);

    // Die Liste selbst scrollt nicht mehr: sonst laege das Formular beim
    // Anlegen wieder ausserhalb des scrollenden Bereichs.
    expect(rule(css, "rows")).not.toMatch(/overflow/);
  });

  it("zeigt die Bildlaufleiste dauerhaft an", () => {
    const scroll = rule(css, "scroll");
    expect(scroll).toMatch(/scrollbar-gutter:\s*stable/);
    expect(scroll).toMatch(/scrollbar-color:/);
    expect(css).toMatch(/\.scroll::-webkit-scrollbar\s*{[^}]*width:\s*10px/);
  });
});
