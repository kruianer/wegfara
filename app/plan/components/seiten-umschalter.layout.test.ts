import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { PLANNER_MIN_WIDTH_PX } from "@/lib/plan/viewport";

// jsdom fuehrt kein CSS aus -- wie gross die Reiter sind und ob die Spalten
// bei 768 px nebeneinander passen, wird deshalb direkt am CSS geprueft (siehe
// seitenleiste.layout.test.ts).
function readCss(relativePath: string) {
  return readFileSync(
    fileURLToPath(new URL(relativePath, import.meta.url)),
    "utf8",
  );
}

/** Die Regel zu genau diesem Selektor -- am Zeilenanfang, nie eine Teilmenge. */
function rule(css: string, selector: string) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return css.match(new RegExp(`(^|\\n)${escaped}\\s*{[^}]*}`))?.[0] ?? "";
}

/** Der Zahlenwert einer Eigenschaft in Pixeln. */
function px(regel: string, eigenschaft: string) {
  const treffer = regel.match(
    new RegExp(`(^|[\\s;{])${eigenschaft}:\\s*(-?[\\d.]+)px`, "i"),
  );
  return treffer ? Number(treffer[2]) : null;
}

/**
 * Der Umschalter zwischen zwei Spalten (req-088) bei 768 px: Tippziele von
 * 44x44 px (stack.md, Bildschirmbreiten, Regel 4), und was er umschaltet,
 * passt neben den Zeitstrahl, ohne ueber den Rand zu stehen (Regel 1).
 */
describe("Seiten-Umschalter -- Layout bei 768 px (req-088)", () => {
  const css = readCss("./seiten-umschalter.module.css");
  const planung = readCss("./planung-view.module.css");

  it("gibt jedem Reiter mindestens 44x44 px", () => {
    const reiter = rule(css, ".reiter");
    expect(px(reiter, "min-width")).toBeGreaterThanOrEqual(44);
    expect(px(reiter, "min-height")).toBeGreaterThanOrEqual(44);
    expect(reiter).toMatch(/box-sizing:\s*border-box/);
  });

  it("laesst die Spalte neben dem Zeitstrahl nehmen, was uebrig bleibt", () => {
    const daneben = rule(planung, ".daneben");
    expect(daneben).toMatch(/flex:\s*1/);
    expect(daneben).toMatch(/min-width:\s*0/);
    // Die POI-Auswahl verliert darin ihre feste Breite (340 px, req-099).
    const kind = rule(planung, ".danebenInhalt > *");
    expect(kind).toMatch(/width:\s*auto/);
    expect(kind).toMatch(/min-width:\s*0/);
  });

  it("laesst bei 768 px neben Leiste und Zeitstrahl Platz fuer eine Spalte", () => {
    const leiste = px(
      rule(readCss("./seitenleiste.module.css"), ".leiste"),
      "--leiste-breite",
    )!;
    const zeitstrahl = px(
      rule(readCss("./timeline-column.module.css"), ".column"),
      "width",
    )!;
    const uebrig = PLANNER_MIN_WIDTH_PX - leiste - zeitstrahl;
    // 768 - 60 - 412: was die POI-Auswahl oder die Karte bekommt. Seit die
    // Leiste immer schmal ist (req-094), sind es 6 px mehr als zuvor.
    expect(uebrig).toBe(296);
    // Die beiden Reiter mit ihren Abstaenden passen hinein.
    const reiter = px(rule(css, ".reiter"), "min-width")!;
    expect(2 * reiter + 4 + 2 * 14).toBeLessThan(uebrig);
  });
});
