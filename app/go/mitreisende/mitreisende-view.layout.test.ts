import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// jsdom fuehrt kein Layout aus -- eine gerenderte Komponente hat in Tests
// immer die Groesse 0. Geprueft wird deshalb direkt am CSS (siehe
// app/go/components/header.layout.test.ts); im echten Browser bei allen drei
// Breiten prueft es tests/e2e/mitreisende.e2e.ts.
function readCss(relativePath: string) {
  return readFileSync(
    fileURLToPath(new URL(relativePath, import.meta.url)),
    "utf8",
  );
}

function regel(klasse: string) {
  const css = readCss("./mitreisende-view.module.css");
  return css.match(new RegExp(`\\.${klasse}\\s*{[^}]*}`))?.[0] ?? "";
}

/**
 * req-087: "Wer faehrt mit" im Begleiter haelt die vier Regeln aus
 * delivery/stack.md (Bildschirmbreiten) bei 375 px.
 */
describe("„Wer fährt mit“ im Begleiter -- Layout (req-087)", () => {
  it("laesst die Seite nicht seitlich rollen", () => {
    expect(regel("seite")).toMatch(/overflow-x:\s*hidden/);
    expect(regel("inhalt")).toMatch(/overflow-x:\s*hidden/);
  });

  it("bricht einen langen Namen um, statt ihn abzuschneiden", () => {
    const name = regel("name");
    expect(name).toMatch(/overflow-wrap:\s*anywhere/);
    expect(name).toMatch(/min-width:\s*0/);
    expect(name).not.toMatch(/text-overflow/);
  });

  it("legt Name und Zugang in eine Zeile, Rolle und Einladen in die naechste -- beide duerfen umbrechen", () => {
    expect(regel("person")).toMatch(/flex-direction:\s*column/);
    expect(regel("personKopf")).toMatch(/flex-wrap:\s*wrap/);
    expect(regel("personAktionen")).toMatch(/flex-wrap:\s*wrap/);
  });

  it("laesst die Rollenauswahl schrumpfen, statt die Zeile zu sprengen", () => {
    expect(regel("rolle")).toMatch(/min-width:\s*0/);
  });

  it.each(["zurueck", "rolle", "einladen,\\s*\\.knopf"])(
    "gibt %s ein Tippziel von mindestens 44 px",
    (klasse) => {
      expect(regel(klasse)).toMatch(/min-height:\s*44px/);
    },
  );
});
