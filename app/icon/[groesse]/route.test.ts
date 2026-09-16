// @vitest-environment node
import { describe, expect, it } from "vitest";
import { ICON_TAB_GROESSE, iconPfad } from "@/lib/icon/icon-pfade";
import { GET } from "./route";

const PNG_SIGNATUR = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);

async function icon(groesse: string) {
  return GET(new Request(`http://localhost:3000/icon/${groesse}`), {
    params: Promise.resolve({ groesse }),
  });
}

/** Breite und Hoehe stehen im IHDR-Block, gleich hinter der Signatur. */
function masse(png: Buffer) {
  return { breite: png.readUInt32BE(16), hoehe: png.readUInt32BE(20) };
}

describe("Icon fuer den Browser-Tab (req-065)", () => {
  it("liefert ein PNG in der angefragten Kantenlaenge", async () => {
    const antwort = await icon(String(ICON_TAB_GROESSE));
    expect(antwort.status).toBe(200);
    expect(antwort.headers.get("Content-Type")).toContain("image/png");

    const png = Buffer.from(await antwort.arrayBuffer());
    expect(png.subarray(0, 8)).toEqual(PNG_SIGNATUR);
    expect(masse(png)).toEqual({
      breite: ICON_TAB_GROESSE,
      hoehe: ICON_TAB_GROESSE,
    });
  }, 20000);

  it("kennt nur die ausgelieferten Kantenlaengen", async () => {
    expect((await icon("4096")).status).toBe(404);
  });

  it("haengt an der Adresse, die das Layout in den Tab schreibt", () => {
    expect(iconPfad(ICON_TAB_GROESSE)).toBe(`/icon/${ICON_TAB_GROESSE}`);
  });
});
