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

/**
 * Seiten ohne Reisebezug. Sie gelten auch fuer jemanden, der gerade keiner
 * laufenden Reise zugeordnet ist -- er muss seinen Passkey einrichten und
 * sich abmelden koennen (req-023).
 */
const GESCHUETZTE_SEITEN = [
  "app/konto/page.tsx",
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
   * Ein Gast hat kein Konto (req-038): er kommt an requireTripAccess() nicht
   * vorbei, sondern wird davor erkannt -- und bekommt dann ausschliesslich
   * die eine Reise seines Gastzugangs zu sehen (siehe
   * lib/guests/guest-trip.ts).
   */
  it.each(SEITEN_MIT_REISEDATEN)(
    "%s erkennt einen Gast vor der Anmeldepruefung (req-038)",
    (page) => {
      const source = readPage(page);

      expect(source).toContain("currentGuest()");
      expect(source).toContain("loadGuestTrip(");
      expect(source.indexOf("await currentGuest()")).toBeLessThan(
        source.indexOf("await requireTripAccess()"),
      );
    },
  );

  it("laedt fuer einen Gast weder Ausgaben noch Dokumente (req-038)", () => {
    const source = readFileSync(
      path.join(process.cwd(), "lib/guests/guest-trip.ts"),
      "utf8",
    );

    expect(source).not.toContain("listExpenses");
    expect(source).not.toContain("listDocuments");
    expect(source).not.toContain("listParticipants");
  });

  it("laesst die Startseite ohne Anmeldung stehen (req-016)", () => {
    const source = readPage("app/page.tsx");

    expect(source).not.toContain("requireSession");
    expect(source).not.toContain("currentSession");
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
