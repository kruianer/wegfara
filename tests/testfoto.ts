import sharp from "sharp";

/**
 * Ein echtes Bild fuer die Tests der Miniaturen (req-105). Die uebrigen
 * Tests legen ein paar Bytes als "Foto" ab -- daraus entsteht keine
 * Miniatur, weil der Inhalt kein Bild ist. Wer die Miniatur pruefen will,
 * braucht ein Bild, das sich verkleinern laesst.
 */
export async function testFoto({
  breite = 1200,
  hoehe = 800,
  art = "jpeg",
}: {
  breite?: number;
  hoehe?: number;
  art?: "jpeg" | "png";
} = {}): Promise<Uint8Array> {
  const bild = sharp({
    create: {
      width: breite,
      height: hoehe,
      channels: 3,
      background: { r: 200, g: 120, b: 40 },
    },
  });
  const daten =
    art === "png" ? await bild.png().toBuffer() : await bild.jpeg().toBuffer();
  return new Uint8Array(daten);
}

/** Breite, Hoehe und Art eines Bildes, gelesen am Inhalt. */
export async function bildMasse(
  data: Uint8Array,
): Promise<{ breite: number; hoehe: number; format: string }> {
  const meta = await sharp(data).metadata();
  return {
    breite: meta.width ?? 0,
    hoehe: meta.height ?? 0,
    format: meta.format ?? "",
  };
}
