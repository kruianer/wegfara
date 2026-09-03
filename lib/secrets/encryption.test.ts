// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import {
  decryptSecret,
  encryptSecret,
  secretEncryptionKey,
} from "./encryption";

const KEY = Buffer.alloc(32, 7);
const ANDERER_KEY = Buffer.alloc(32, 9);

describe("encryptSecret / decryptSecret (req-028)", () => {
  it("gibt den Wert nach dem Entschluesseln unveraendert zurueck", () => {
    const verschluesselt = encryptSecret("sk-test-1234", KEY);

    expect(decryptSecret(verschluesselt, KEY)).toBe("sk-test-1234");
  });

  it("laesst den Schluessel im Ergebnis nicht erkennen", () => {
    const verschluesselt = encryptSecret("sk-test-1234", KEY);

    expect(verschluesselt).not.toContain("sk-test-1234");
    expect(verschluesselt).not.toContain("1234");
  });

  it("ergibt zweimal verschiedene Werte", () => {
    const a = encryptSecret("sk-test-1234", KEY);
    const b = encryptSecret("sk-test-1234", KEY);

    expect(a).not.toBe(b);
    expect(decryptSecret(b, KEY)).toBe("sk-test-1234");
  });

  it("liefert mit einem anderen Schluessel nichts", () => {
    const verschluesselt = encryptSecret("sk-test-1234", KEY);

    expect(decryptSecret(verschluesselt, ANDERER_KEY)).toBeNull();
  });

  it("erkennt einen veraenderten Wert", () => {
    const verschluesselt = encryptSecret("sk-test-1234", KEY);
    const [version, iv, tag, body] = verschluesselt.split(".");
    const veraendert = [version, iv, tag, `${body}AA`].join(".");

    expect(decryptSecret(veraendert, KEY)).toBeNull();
  });

  it("liefert bei einem Wert in fremder Form nichts", () => {
    expect(decryptSecret("sk-test-1234", KEY)).toBeNull();
    expect(decryptSecret("", KEY)).toBeNull();
    expect(decryptSecret("v2.a.b.c", KEY)).toBeNull();
  });
});

describe("secretEncryptionKey (req-028)", () => {
  it("leitet den Schluessel aus der Umgebungsvariablen ab", () => {
    vi.stubEnv("AUTH_SECRET", "geheim");

    const key = secretEncryptionKey();

    expect(key).toHaveLength(32);
    expect(key).toEqual(secretEncryptionKey());
    vi.unstubAllEnvs();
  });

  it("ergibt fuer ein anderes Geheimnis einen anderen Schluessel", () => {
    vi.stubEnv("AUTH_SECRET", "geheim");
    const eins = secretEncryptionKey();
    vi.stubEnv("AUTH_SECRET", "anders");
    const zwei = secretEncryptionKey();
    vi.unstubAllEnvs();

    expect(eins).not.toEqual(zwei);
  });

  it("liefert ohne Umgebungsvariable keinen Schluessel", () => {
    vi.stubEnv("AUTH_SECRET", "");

    expect(secretEncryptionKey()).toBeNull();
    vi.unstubAllEnvs();
  });
});
