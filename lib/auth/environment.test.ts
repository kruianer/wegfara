// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { environmentLabel, environmentLabelFor } from "./environment";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("environmentLabelFor (req-037)", () => {
  it("nennt dev beim Namen", () => {
    expect(environmentLabelFor("https://dev.wegfara.com")).toBe("dev");
  });

  it("laesst prod ohne Kennzeichnung", () => {
    // Der Betreff einer echten Mail traegt keinen Zusatz.
    expect(environmentLabelFor("https://app.wegfara.com")).toBeNull();
  });

  it("nennt die lokale Entwicklung", () => {
    expect(environmentLabelFor("http://localhost:3000")).toBe("lokal");
  });

  it("bleibt bei einer unsinnigen Adresse still", () => {
    expect(environmentLabelFor("keine-adresse")).toBeNull();
  });
});

describe("environmentLabel (req-037)", () => {
  it("leitet die Umgebung aus APP_URL ab, nie aus der Anfrage", () => {
    vi.stubEnv("APP_URL", "https://dev.wegfara.com");

    expect(environmentLabel()).toBe("dev");
  });

  it("schweigt auf prod", () => {
    vi.stubEnv("APP_URL", "https://app.wegfara.com");

    expect(environmentLabel()).toBeNull();
  });
});
