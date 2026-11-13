// @vitest-environment node
import { describe, expect, it } from "vitest";
import { browserHatSchon, dateiAntwort, etagVon } from "./bild-auslieferung";

const DATEN = new Uint8Array([1, 2, 3]);

function anfrage(ifNoneMatch?: string): Request {
  return new Request("https://dev.wegfara.com/api/poi-fotos/x", {
    headers: ifNoneMatch ? { "If-None-Match": ifNoneMatch } : {},
  });
}

describe("etagVon (req-105)", () => {
  it("ist fuer gleiche Bytes gleich und fuer andere verschieden", () => {
    expect(etagVon(new Uint8Array([1, 2, 3]))).toBe(etagVon(DATEN));
    expect(etagVon(new Uint8Array([1, 2, 4]))).not.toBe(etagVon(DATEN));
  });

  it("ist ein starkes Kennzeichen in Anfuehrungszeichen", () => {
    expect(etagVon(DATEN)).toMatch(/^"[A-Za-z0-9_-]+"$/);
  });
});

describe("browserHatSchon (req-105)", () => {
  const etag = etagVon(DATEN);

  it("erkennt das eigene Kennzeichen, auch schwach und in einer Liste", () => {
    expect(browserHatSchon(etag, etag)).toBe(true);
    expect(browserHatSchon(`W/${etag}`, etag)).toBe(true);
    expect(browserHatSchon(`"anderes", ${etag}`, etag)).toBe(true);
    expect(browserHatSchon("*", etag)).toBe(true);
  });

  it("verneint ohne oder mit fremdem Kennzeichen", () => {
    expect(browserHatSchon(null, etag)).toBe(false);
    expect(browserHatSchon('"anderes"', etag)).toBe(false);
  });
});

describe("dateiAntwort (req-105)", () => {
  const KOPF = {
    "Content-Type": "image/jpeg",
    "Cache-Control": "private, max-age=86400",
  };

  it("schickt die Daten mit ETag, Laenge und den uebrigen Angaben", async () => {
    const response = dateiAntwort(anfrage(), DATEN, KOPF);

    expect(response.status).toBe(200);
    expect(response.headers.get("ETag")).toBe(etagVon(DATEN));
    expect(response.headers.get("Content-Length")).toBe("3");
    expect(response.headers.get("Content-Type")).toBe("image/jpeg");
    expect(response.headers.get("Cache-Control")).toBe(
      "private, max-age=86400",
    );
    expect(Array.from(new Uint8Array(await response.arrayBuffer()))).toEqual([
      1, 2, 3,
    ]);
  });

  it("antwortet mit 304 und ohne Daten, wenn der Browser sie schon hat", async () => {
    const response = dateiAntwort(anfrage(etagVon(DATEN)), DATEN, KOPF);

    expect(response.status).toBe(304);
    expect(response.headers.get("ETag")).toBe(etagVon(DATEN));
    expect(response.headers.get("Cache-Control")).toBe(
      "private, max-age=86400",
    );
    expect((await response.arrayBuffer()).byteLength).toBe(0);
  });

  it("schickt die Daten neu, wenn sie sich geaendert haben", () => {
    const response = dateiAntwort(
      anfrage(etagVon(new Uint8Array([9]))),
      DATEN,
      KOPF,
    );

    expect(response.status).toBe(200);
  });
});
