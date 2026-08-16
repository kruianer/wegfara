// @vitest-environment node
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * Alle Bereiche ausser der Startseite setzen eine angemeldete Person
 * voraus (req-016). Server-Komponenten koennen nicht gerendert werden,
 * ohne Next zu starten -- geprueft wird deshalb an der Quelle, dass die
 * Seite die Sitzung ueberhaupt verlangt (siehe app/layout.test.ts).
 */
function readPage(relativePath: string): string {
  return readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

const GESCHUETZTE_SEITEN = [
  "app/go/page.tsx",
  "app/plan/page.tsx",
  "app/konto/page.tsx",
  "app/anmeldung/notfallcodes/page.tsx",
];

describe("Geschuetzte Seiten (req-016)", () => {
  it.each(GESCHUETZTE_SEITEN)("%s verlangt eine Sitzung", (page) => {
    expect(readPage(page)).toContain("requireSession()");
  });

  it("laesst die Startseite ohne Anmeldung stehen (req-016)", () => {
    const source = readPage("app/page.tsx");

    expect(source).not.toContain("requireSession");
    expect(source).not.toContain("currentSession");
  });

  it.each(["app/go/page.tsx", "app/plan/page.tsx"])(
    "%s liest den Mandanten aus dem angemeldeten Konto, nicht aus einem festen Wert",
    (page) => {
      const source = readPage(page);

      expect(source).toContain("session.participant.accountId");
      expect(source).not.toContain("ACCOUNT_ID");
    },
  );

  it("schickt die Anmeldeseite eine bereits angemeldete Person weiter", () => {
    expect(readPage("app/anmeldung/page.tsx")).toContain("currentSession()");
  });
});
