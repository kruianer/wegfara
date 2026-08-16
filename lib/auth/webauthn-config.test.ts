// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_APP_URL,
  absoluteUrl,
  appUrl,
  webAuthnConfigFor,
} from "./webauthn-config";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("webAuthnConfigFor", () => {
  it("bindet den Passkey an die Domain der Umgebung", () => {
    expect(webAuthnConfigFor("https://dev.wegfara.com")).toMatchObject({
      rpId: "dev.wegfara.com",
      origin: "https://dev.wegfara.com",
    });
  });

  it("trennt dev und prod voneinander", () => {
    const dev = webAuthnConfigFor("https://dev.wegfara.com");
    const prod = webAuthnConfigFor("https://app.wegfara.com");

    expect(dev.rpId).not.toBe(prod.rpId);
  });

  it("kommt in der lokalen Entwicklung ohne HTTPS aus", () => {
    expect(webAuthnConfigFor("http://localhost:3000")).toMatchObject({
      rpId: "localhost",
      origin: "http://localhost:3000",
    });
  });
});

describe("appUrl", () => {
  it("nimmt die Adresse aus der Umgebung", () => {
    vi.stubEnv("APP_URL", "https://dev.wegfara.com");

    expect(appUrl()).toBe("https://dev.wegfara.com");
  });

  it("faellt ohne Umgebungsvariable auf die lokale Adresse zurueck", () => {
    vi.stubEnv("APP_URL", "");

    expect(appUrl()).toBe(DEFAULT_APP_URL);
  });
});

describe("absoluteUrl", () => {
  it("baut eine vollstaendige Adresse fuer den Anmeldelink", () => {
    expect(
      absoluteUrl("/anmeldung/link?token=abc", "https://dev.wegfara.com"),
    ).toBe("https://dev.wegfara.com/anmeldung/link?token=abc");
  });
});
