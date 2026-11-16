import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Die Schriften gehoeren zum Vorrat des Repos (bug-075): Der Build darf sie
 * nicht aus dem Netz holen, sonst scheitert er, sobald fonts.googleapis.com
 * einmal nicht antwortet -- bei unveraendertem Code.
 */
const WURZEL = process.cwd();
const ORDNER = path.join(WURZEL, "lib/schriften");
const modul = readFileSync(path.join(ORDNER, "index.ts"), "utf8");

/** Alle Quelldateien unter den Ordnern, aus denen Next die App baut. */
function quelldateien(): string[] {
  return ["app", "components", "lib"].flatMap((ordner) =>
    readdirSync(path.join(WURZEL, ordner), { recursive: true })
      .map(String)
      .filter((datei) => /\.(ts|tsx)$/.test(datei))
      .filter((datei) => !/\.test\.tsx?$/.test(datei))
      .map((datei) => path.join(ordner, datei)),
  );
}

describe("Schriften aus dem Repo (bug-075)", () => {
  it("laedt keine Schrift beim Bauen von Google", () => {
    const fremd = quelldateien().filter((datei) =>
      /from\s+"next\/font\/google"/.test(
        readFileSync(path.join(WURZEL, datei), "utf8"),
      ),
    );
    expect(fremd).toEqual([]);
  });

  it("bindet die Schriften ueber next/font/local ein", () => {
    expect(modul).toMatch(/import localFont from "next\/font\/local";/);
    expect(modul).not.toMatch(/https?:\/\//);
  });

  it("bringt jede eingebundene Datei im Repo mit", () => {
    const pfade = [...modul.matchAll(/"\.\/([\w-]+\.woff2)"/g)].map(
      (m) => m[1],
    );
    // Fuenf Familien, Playfair Display zusaetzlich kursiv.
    expect(pfade).toHaveLength(6);
    for (const datei of pfade) {
      const inhalt = readFileSync(path.join(ORDNER, datei));
      // Die Kennung am Anfang jeder WOFF2-Datei.
      expect(inhalt.subarray(0, 4).toString("latin1"), datei).toBe("wOF2");
    }
  });

  it("legt jeder Familie ihre Lizenz bei", () => {
    const familien = readdirSync(ORDNER)
      .filter((datei) => datei.endsWith(".woff2"))
      .map((datei) => datei.replace(/(-Italic)?\.woff2$/, ""));
    for (const familie of new Set(familien)) {
      const lizenz = path.join(ORDNER, `${familie}-OFL.txt`);
      expect(existsSync(lizenz), familie).toBe(true);
      expect(readFileSync(lizenz, "utf8")).toMatch(/SIL OPEN FONT LICENSE/);
    }
  });

  it.each([
    ["playfairDisplay", "--font-heading"],
    ["figtree", "--font-body"],
    ["caveat", "--font-hand"],
    ["spaceGrotesk", "--font-heading"],
    ["albertSans", "--font-body"],
  ])("setzt fuer %s die Variable %s wie zuvor", (name, variable) => {
    const aufruf = modul.match(
      new RegExp(
        `export const ${name} = localFont\\(\\{([\\s\\S]*?)\\n\\}\\);`,
      ),
    );
    expect(aufruf, name).not.toBeNull();
    expect(aufruf![1]).toContain(`variable: "${variable}"`);
  });
});
