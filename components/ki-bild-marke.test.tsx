import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { KiBildMarke, kiBildMarkeElement } from "./ki-bild-marke";
import {
  kontrastVerhaeltnis,
  MINDESTKONTRAST_FLIESSTEXT,
} from "@/lib/design/kontrast";

// jsdom fuehrt kein CSS aus -- wo das Zeichen liegt und worauf es steht,
// wird deshalb direkt am Blatt geprueft (siehe farbwelt.kontrast.test.ts).
function readCss(relativePath: string) {
  return readFileSync(
    fileURLToPath(new URL(relativePath, import.meta.url)),
    "utf8",
  );
}

function rule(css: string, selector: string) {
  return css.match(new RegExp(`\\.${selector}\\s*{[^}]*}`))?.[0] ?? "";
}

/**
 * Das Zeichen, an dem ein KI-Bild zu erkennen ist (req-072). Es steht unten
 * rechts im Bild und bleibt auch dort lesbar, wo das Bild dunkel oder
 * unruhig ist.
 */
describe("KiBildMarke (req-072)", () => {
  const css = readCss("./ki-bild-marke.module.css");

  it("sagt an, was es bedeutet", () => {
    render(<KiBildMarke />);

    expect(
      screen.getByRole("img", { name: "Mit KI erzeugt" }),
    ).toBeInTheDocument();
  });

  it("steht unten rechts", () => {
    const marke = rule(css, "marke");

    expect(marke).toMatch(/position:\s*absolute/);
    expect(marke).toMatch(/right:\s*4px/);
    expect(marke).toMatch(/bottom:\s*4px/);
  });

  /**
   * Erkennbar bleibt es auch auf einem dunklen oder unruhigen Bild: es
   * bringt seinen eigenen, deckenden Grund mit -- ein durchscheinender
   * liesse den Kontrast vom Foto darunter abhaengen.
   */
  it("bringt einen deckenden Grund mit", () => {
    const marke = rule(css, "marke");

    expect(marke).toMatch(/background:\s*#12120f/i);
    expect(marke).not.toMatch(/background:\s*(rgba|transparent)/i);
  });

  it("hebt seine Schrift von seinem Grund ab (stack.md, Kontrast)", () => {
    expect(kontrastVerhaeltnis("#f4f2ee", "#12120f")).toBeGreaterThanOrEqual(
      MINDESTKONTRAST_FLIESSTEXT,
    );
  });

  /**
   * Im Flyout der Karte entsteht das Zeichen imperativ (req-070) -- es muss
   * dasselbe sein wie das gerenderte, und in einer Schaltflaeche stehen
   * duerfen: nur <span>, kein <svg> und kein <div>.
   */
  it("laesst sich als DOM-Element bauen und sieht dabei gleich aus", () => {
    const element = kiBildMarkeElement();

    expect(element.tagName).toBe("SPAN");
    expect(element.getAttribute("aria-label")).toBe("Mit KI erzeugt");
    expect(element.textContent).toContain("KI");
    expect(element.querySelectorAll("span, #text")).toHaveLength(1);
    expect(element.querySelector("svg")).toBeNull();
  });
});
