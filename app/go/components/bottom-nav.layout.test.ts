import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// jsdom fuehrt kein Layout aus -- eine gerenderte Komponente hat in Tests
// immer die Groesse 0. Gestapelt wird deshalb direkt am CSS geprueft (siehe
// app/go/components/header.layout.test.ts).
function readCss(relativePath: string) {
  return readFileSync(
    fileURLToPath(new URL(relativePath, import.meta.url)),
    "utf8",
  );
}

function regel(name: string) {
  const css = readCss("./bottom-nav.module.css");
  return css.match(new RegExp(`\\.${name}\\s*{[^}]*}`))?.[0] ?? "";
}

describe("Untere Leiste des Begleiters -- Aufbau eines Eintrags (bug-034)", () => {
  it("stapelt Symbol und Beschriftung untereinander", () => {
    const item = regel("item");

    expect(item).toMatch(/display:\s*flex/);
    expect(item).toMatch(/flex-direction:\s*column/);
  });

  it("gibt jedem Eintrag ein Tippziel von mindestens 44 px Hoehe", () => {
    // Mit dem Finger bedient (siehe stack.md, Bildschirmbreiten).
    expect(regel("item")).toMatch(/min-height:\s*44px/);
  });

  it("laesst das Symbol nicht schrumpfen, wenn der Platz eng wird", () => {
    expect(regel("icon")).toMatch(/flex:\s*none/);
  });
});
