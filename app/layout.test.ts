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

describe("Root Layout -- Hinweisbalken bei fremdem Account (req-025)", () => {
  it("zeigt den Balken auf jeder Seite, also im Root-Layout", () => {
    const layout = readFile("./layout.tsx");

    // Der Balken gehoert ueber den Kopfbereich und ist auf jeder Seite
    // sichtbar -- deshalb steht er hier und nicht im Planer.
    expect(layout).toMatch(/import\s+{\s*FremderAccountBalken\s*}/);
    expect(layout).toContain("<FremderAccountBalken");
  });

  it("zeigt ihn nur, solange in einem fremden Account gearbeitet wird", () => {
    const layout = readFile("./layout.tsx");

    expect(layout).toContain("session?.actingAccount");
    expect(layout).toContain("fremderAccount &&");
  });

  it("verkuerzt die Seite um die Hoehe des Balkens, statt sie zu verschieben", () => {
    const css = readFile("./layout.module.css");
    const regel = css.match(/\.mitBalken\s*{[^}]*}/)?.[0] ?? "";

    expect(regel).toMatch(/--balken-hoehe:\s*\d+px/);
    // Planer und Begleiter rechnen damit (siehe plan-view.module.css).
    expect(readFile("./plan/plan-view.module.css")).toContain(
      "calc(100dvh - var(--balken-hoehe, 0px))",
    );
  });
});
