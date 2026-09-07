// @vitest-environment node
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

/**
 * Alles ausser Anmeldung und Wiederherstellung setzt eine angemeldete Person
 * voraus (req-016), seit req-055 auch die Hauptadresse. Server-Komponenten
 * koennen nicht gerendert werden, ohne Next zu starten -- geprueft wird
 * deshalb an der Quelle, dass die Seite die Sitzung ueberhaupt verlangt
 * (siehe app/layout.test.ts).
 */
function readPage(relativePath: string): string {
  return readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

/**
 * Seiten ohne Reisebezug. Sie gelten auch fuer jemanden, der gerade keiner
 * laufenden Reise zugeordnet ist -- er muss seinen Passkey einrichten und
 * sich abmelden koennen (req-023).
 */
const GESCHUETZTE_SEITEN = [
  "app/mein-bereich/page.tsx",
  "app/anmeldung/notfallcodes/page.tsx",
  "app/einladung/passkey/page.tsx",
];

/**
 * Die Bereiche mit Reisedaten. Hier endet die Sitzung zusaetzlich, sobald
 * die Person keiner freigegebenen Reise mehr zugeordnet ist (req-023).
 */
const SEITEN_MIT_REISEDATEN = ["app/go/page.tsx", "app/plan/page.tsx"];

describe("Geschuetzte Seiten (req-016)", () => {
  it.each(GESCHUETZTE_SEITEN)("%s verlangt eine Sitzung", (page) => {
    expect(readPage(page)).toContain("requireSession()");
  });

  it.each(SEITEN_MIT_REISEDATEN)(
    "%s verlangt eine Sitzung mit laufender Reise (req-023)",
    (page) => {
      expect(readPage(page)).toContain("requireTripAccess()");
    },
  );

  /**
   * Bis req-042 kam ein Gast vor requireTripAccess() zum Zug und sah dann
   * seine eine Reise. Mit dem Gastzugang ist dieser Weg entfallen: der
   * Begleiter und der Planer kennen nur noch die angemeldete Person, und wer
   * es nicht ist, sieht die Anmeldeseite.
   */
  it.each(SEITEN_MIT_REISEDATEN)(
    "%s kennt keine Gast-Ansicht mehr (req-042)",
    (page) => {
      const source = readPage(page);

      expect(source).not.toContain("currentGuest");
      expect(source).not.toContain("GuestTrip");
      expect(source).not.toContain("gastzugang");
    },
  );

  /**
   * Seit req-055 zeigt die Hauptadresse keine Auswahlseite mehr, sondern
   * leitet dorthin weiter, wo die angemeldete Person hingehoert -- sie setzt
   * damit selbst eine Anmeldung voraus.
   */
  it("verlangt auch die Hauptadresse eine Sitzung (req-055)", () => {
    const source = readPage("app/page.tsx");

    expect(source).toContain("requireSession()");
    expect(source).toContain("einstiegsZiel(");
    expect(source).toContain("redirect(");
  });

  /**
   * Die Auswahlseite mit den drei Kacheln aus req-015 entfaellt, ebenso das
   * Feld fuer den Einladungscode -- der Beitritt laeuft seit req-023 ueber
   * die Einladung.
   */
  it("zeigt auf der Hauptadresse keine Auswahlseite mehr (req-055)", () => {
    const source = readPage("app/page.tsx");

    expect(source).not.toContain("HomeView");
    expect(existsSync(path.join(process.cwd(), "app/home-view.tsx"))).toBe(
      false,
    );
  });

  it("gibt den Planer nur Reiseleiter und Account-Admin (req-055)", () => {
    const source = readPage("app/plan/page.tsx");

    // Wer ihn nicht darf, landet ohne Meldung im Begleiter.
    expect(source).toContain("darfPlanen({");
    expect(source).toContain("redirect(BEGLEITER_PATH)");
  });

  it.each(["app/go/page.tsx", "app/plan/page.tsx"])(
    "%s liest den Mandanten aus der Sitzung, nicht aus einem festen Wert",
    (page) => {
      const source = readPage(page);

      // Seit req-025 ist das der eigene Account der angemeldeten Person
      // oder der fremde, in den der Gesamt-Admin gewechselt hat -- beides
      // steht in der Sitzung (siehe account-scope.test.ts).
      expect(source).toContain("session.accountId");
      expect(source).not.toContain("ACCOUNT_ID");
    },
  );

  it("gibt die Account-Verwaltung nur dem Gesamt-Admin (req-025)", () => {
    const source = readPage("app/plan/accounts/page.tsx");

    expect(source).toContain("requireSuperAdmin()");
  });

  it("schickt die Anmeldeseite eine bereits angemeldete Person weiter", () => {
    expect(readPage("app/anmeldung/page.tsx")).toContain("currentSession()");
  });
});
