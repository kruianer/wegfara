// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ICON_APPLE_GROESSE,
  ICON_TAB_GROESSE,
  iconPfad,
} from "@/lib/icon/icon-pfade";
import {
  ICON_FARBEN_ANDERE_UMGEBUNG,
  ICON_FARBEN_PROD,
} from "@/lib/icon/icon-farben";
import { alsHex, lesePng } from "@/tests/png-pixel";
import { GET } from "./route";

// Das Icon nimmt seine Farben aus der Umgebung (req-065). Solange nichts
// anderes gesetzt ist, wird gegen prod geprueft.
beforeEach(() => {
  vi.stubEnv("APP_URL", "https://app.wegfara.com");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

const PNG_SIGNATUR = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);

async function icon(groesse: string) {
  return GET(new Request(`http://localhost:3000/icon/${groesse}`), {
    params: Promise.resolve({ groesse }),
  });
}

async function iconBild(groesse: number) {
  const antwort = await icon(String(groesse));
  expect(antwort.status).toBe(200);
  return lesePng(Buffer.from(await antwort.arrayBuffer()));
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

describe("Icon fuer den Homescreen (req-065)", () => {
  it("liefert es in der Kantenlaenge, die Apple erwartet", async () => {
    const bild = await iconBild(ICON_APPLE_GROESSE);

    expect(bild.breite).toBe(ICON_APPLE_GROESSE);
    expect(bild.hoehe).toBe(ICON_APPLE_GROESSE);
  }, 20000);

  it("zeigt die Kompassrose und nicht nur eine leere Flaeche", async () => {
    const bild = await iconBild(ICON_APPLE_GROESSE);
    const mitte = Math.floor(ICON_APPLE_GROESSE / 2);

    // Im Mittelpunkt liegt der gefuellte innere Stern -- dort steht die
    // Zeichenfarbe, nicht der Grund.
    expect(alsHex(bild.punkt(mitte, mitte))).toBe(ICON_FARBEN_PROD.zeichen);
  }, 20000);

  it("legt die Rose auf einen dunklen Grund und nicht auf Schwarz", async () => {
    const bild = await iconBild(ICON_APPLE_GROESSE);
    const ecke = bild.punkt(0, 0);

    // Deckend bis in die Ecke: waere dort etwas durchsichtig, fuellte Apple
    // es auf dem Homescreen mit Schwarz.
    expect(ecke.a).toBe(255);
    expect(alsHex(ecke)).toBe(ICON_FARBEN_PROD.grund);
    expect(alsHex(ecke)).not.toBe("#000000");
    // Dunkel heisst hier: deutlich dunkler als das Zeichen darauf.
    expect(ecke.r + ecke.g + ecke.b).toBeLessThan(255);
  }, 20000);

  it("laesst nirgends etwas durchscheinen", async () => {
    const bild = await iconBild(ICON_APPLE_GROESSE);
    const letzte = ICON_APPLE_GROESSE - 1;

    for (const [x, y] of [
      [0, 0],
      [letzte, 0],
      [0, letzte],
      [letzte, letzte],
      [Math.floor(letzte / 2), Math.floor(letzte / 2)],
    ]) {
      expect(bild.punkt(x, y).a).toBe(255);
    }
  }, 20000);
});

describe("dev und prod auf demselben Homescreen (req-065)", () => {
  async function grundfarbe(appUrl: string) {
    vi.stubEnv("APP_URL", appUrl);
    const bild = await iconBild(ICON_TAB_GROESSE);
    return alsHex(bild.punkt(0, 0));
  }

  it("gibt dev einen anderen Grund als prod", async () => {
    expect(await grundfarbe("https://dev.wegfara.com")).toBe(
      ICON_FARBEN_ANDERE_UMGEBUNG.grund,
    );
    expect(await grundfarbe("https://app.wegfara.com")).toBe(
      ICON_FARBEN_PROD.grund,
    );
  }, 30000);

  it("zeigt in beiden Umgebungen dieselbe Kompassrose", async () => {
    const mitte = Math.floor(ICON_TAB_GROESSE / 2);

    vi.stubEnv("APP_URL", "https://dev.wegfara.com");
    const dev = await iconBild(ICON_TAB_GROESSE);

    expect(alsHex(dev.punkt(mitte, mitte))).toBe(ICON_FARBEN_PROD.zeichen);
  }, 20000);
});
