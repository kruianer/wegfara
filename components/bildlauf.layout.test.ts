import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// jsdom fuehrt kein CSS aus -- welche Farbe eine Bildlaufleiste traegt
// (bug-041), wird deshalb direkt am CSS geprueft statt am gerenderten DOM
// (siehe app/plan/components/poi-list.layout.test.ts, bug-014). Dass die
// rollenden Flaechen das gemeinsame Blatt auch anlegen, pruefen die
// Komponententests von PlanungView und GoView.
function readCss(relativePath: string) {
  return readFileSync(
    fileURLToPath(new URL(relativePath, import.meta.url)),
    "utf8",
  );
}

function rule(css: string, selector: string) {
  return css.match(new RegExp(`\\.${selector}\\s*{[^}]*}`))?.[0] ?? "";
}

/** Der Wert einer Eigenschaft in einer Regel, ohne Semikolon. */
function wert(regel: string, property: string) {
  return regel.match(new RegExp(`${property}:\\s*([^;]+);`))?.[1]?.trim() ?? "";
}

const css = readCss("./bildlauf.module.css");

describe("Bildlaufleiste -- das gemeinsame Blatt (bug-041)", () => {
  it("nimmt Rille und Griff aus Variablen statt aus festen Werten", () => {
    // Nur so traegt der Balken die Farbe seiner Umgebung und fuegt sich in
    // jede Farbwelt ein (req-007) -- ein fester Wert passte in der einen und
    // in der anderen nicht.
    expect(rule(css, "bildlauf")).toMatch(
      /scrollbar-color:\s*var\(--bildlauf-griff\)\s+var\(--bildlauf-rille/,
    );
    expect(css).not.toMatch(/#[0-9a-f]{3,8}/i);
    expect(css).not.toMatch(/\brgba?\(/);
  });

  it("faerbt die Rille auch in WebKit aus derselben Variablen", () => {
    // Firefox liest `scrollbar-color`, WebKit und Chromium die
    // ::-webkit-Pseudoelemente -- ohne beides bleibt in einem der beiden
    // Browser der helle Standard stehen.
    const rille =
      css.match(/\.bildlauf::-webkit-scrollbar-track\s*{[^}]*}/)?.[0] ?? "";
    expect(wert(rille, "background")).toMatch(/^var\(--bildlauf-rille/);
  });

  it("faerbt den Griff auch in WebKit aus derselben Variablen", () => {
    const griff =
      css.match(/\.bildlauf::-webkit-scrollbar-thumb\s*{[^}]*}/)?.[0] ?? "";
    expect(wert(griff, "background")).toBe("var(--bildlauf-griff)");
    expect(griff).toMatch(/border-radius:\s*999px/);
  });

  it("laesst die Rille durchsichtig, wo sie niemand setzt", () => {
    // Dann zeigt sie den Hintergrund der rollenden Flaeche selbst -- nie den
    // hellen Standard des Browsers.
    expect(css).toMatch(/var\(--bildlauf-rille,\s*transparent\)/);
  });
});

/**
 * Die rollenden Flaechen des Zeitstrahls: die beiden Spalten der Planung im
 * Planer und der Zeitstrahl des Begleiters. Jede von ihnen faerbt die Rille
 * mit ihrem eigenen Hintergrund -- die Leiste liegt darin und faellt damit
 * nicht mehr auf.
 */
describe("Bildlaufleiste -- die Flaechen des Zeitstrahls (bug-041)", () => {
  const flaechen = [
    {
      name: "Zeitstrahl des Planers",
      css: readCss("../app/plan/components/timeline-column.module.css"),
      rollt: "scroll",
      umgebung: "column",
    },
    {
      name: "„Noch unverplant“",
      css: readCss("../app/plan/components/unplanned-column.module.css"),
      rollt: "list",
      umgebung: "column",
    },
    {
      name: "Zeitstrahl des Begleiters",
      css: readCss("../app/go/go-view.module.css"),
      rollt: "content",
      umgebung: "app",
    },
  ];

  it.each(flaechen)(
    "$name gibt der Rille den Hintergrund seiner Umgebung",
    ({ css: eigenes, rollt, umgebung }) => {
      const hintergrund = wert(rule(eigenes, umgebung), "background");
      expect(hintergrund).toMatch(/^var\(--[\w-]+\)$/);
      expect(wert(rule(eigenes, rollt), "--bildlauf-rille")).toBe(hintergrund);
    },
  );

  it.each(flaechen)(
    "$name nimmt auch den Griff aus seiner Farbwelt",
    ({ css: eigenes, rollt }) => {
      expect(wert(rule(eigenes, rollt), "--bildlauf-griff")).toMatch(
        /^var\(--[\w-]+\)$/,
      );
    },
  );
});
