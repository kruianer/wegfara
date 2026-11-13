// @vitest-environment node
import { describe, expect, it } from "vitest";
import { bildMasse, testFoto } from "@/tests/testfoto";
import {
  MINIATUR_BREITE_PX,
  bildArtAmInhalt,
  istMiniaturName,
  miniaturName,
  verkleinere,
} from "./miniatur";

describe("miniaturName (req-105)", () => {
  it("haengt die Miniatur erkennbar an den Namen des Originals", () => {
    expect(miniaturName("49d541f8-971c-4aea-acd8-4a8b359c91e1.jpg")).toBe(
      "49d541f8-971c-4aea-acd8-4a8b359c91e1.miniatur.webp",
    );
  });

  it("nimmt nur den reinen Dateinamen", () => {
    expect(miniaturName("../daneben/foto.png")).toBe("foto.miniatur.webp");
  });

  it("erkennt eine Miniatur an ihrem Namen", () => {
    expect(istMiniaturName(miniaturName("foto.jpg"))).toBe(true);
    expect(istMiniaturName("foto.jpg")).toBe(false);
    expect(istMiniaturName("foto.webp")).toBe(false);
  });
});

describe("bildArtAmInhalt (req-105: am Inhalt, nicht an der Endung)", () => {
  it("erkennt JPEG und PNG", async () => {
    expect(bildArtAmInhalt(await testFoto({ art: "jpeg" }))).toBe("image/jpeg");
    expect(bildArtAmInhalt(await testFoto({ art: "png" }))).toBe("image/png");
  });

  it("erkennt GIF, WebP und HEIC an ihren Kennungen", () => {
    expect(bildArtAmInhalt(new Uint8Array(Buffer.from("GIF89a....")))).toBe(
      "image/gif",
    );
    expect(
      bildArtAmInhalt(new Uint8Array(Buffer.from("RIFF0000WEBPVP8 "))),
    ).toBe("image/webp");
    expect(
      bildArtAmInhalt(new Uint8Array(Buffer.from("0000ftypheic0000"))),
    ).toBe("image/heic");
  });

  it("liefert null fuer etwas, das kein Bild ist", () => {
    expect(bildArtAmInhalt(new Uint8Array([1, 2, 3]))).toBeNull();
    expect(bildArtAmInhalt(new Uint8Array(Buffer.from("%PDF-1.7")))).toBeNull();
    expect(bildArtAmInhalt(new Uint8Array())).toBeNull();
  });
});

describe("verkleinere (req-105)", () => {
  it("macht aus einem Foto von 1200 Punkten eine Miniatur von 320", async () => {
    const miniatur = await verkleinere(
      await testFoto({ breite: 1200, hoehe: 800 }),
    );

    const masse = await bildMasse(miniatur!);
    expect(masse.breite).toBe(MINIATUR_BREITE_PX);
    expect(masse.breite).toBe(320);
    // Das Seitenverhaeltnis bleibt.
    expect(masse.hoehe).toBe(213);
  });

  it("liefert ein WebP, auch wenn das Original ein PNG ist", async () => {
    const miniatur = await verkleinere(
      await testFoto({ breite: 1200, hoehe: 1697, art: "png" }),
    );

    expect((await bildMasse(miniatur!)).format).toBe("webp");
    expect(bildArtAmInhalt(miniatur!)).toBe("image/webp");
  });

  it("vergroessert ein kleines Bild nicht", async () => {
    const miniatur = await verkleinere(
      await testFoto({ breite: 200, hoehe: 100 }),
    );

    expect((await bildMasse(miniatur!)).breite).toBe(200);
  });

  it("liefert null, wenn der Inhalt kein Bild ist", async () => {
    expect(await verkleinere(new Uint8Array([1, 2, 3]))).toBeNull();
  });

  it("wirft, wenn ein Bild sich nicht lesen laesst", async () => {
    const kaputt = (await testFoto()).slice(0, 40);

    await expect(verkleinere(kaputt)).rejects.toThrow();
  });
});
