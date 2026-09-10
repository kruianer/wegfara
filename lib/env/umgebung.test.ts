import { describe, expect, it } from "vitest";
import { envGeheimnis, envWert } from "./umgebung";

describe("envWert (bug-032)", () => {
  it("liefert den gesetzten Wert", () => {
    expect(envWert("FOO", { FOO: "gpt-5.6-luna" })).toBe("gpt-5.6-luna");
  });

  it("liefert null, wenn die Variable fehlt", () => {
    expect(envWert("FOO", {})).toBeNull();
  });

  /**
   * Der Fall aus bug-032: Compose reicht `FOO: ${FOO}` auch dann durch, wenn
   * FOO in der .env-Datei gar nicht steht — im Container kommt der leere
   * String an. Er darf den Standardwert nicht verdraengen.
   */
  it("behandelt den leeren String wie eine fehlende Variable", () => {
    expect(envWert("FOO", { FOO: "" })).toBeNull();
  });

  it("behandelt einen Wert aus lauter Leerraum wie eine fehlende Variable", () => {
    expect(envWert("FOO", { FOO: "   " })).toBeNull();
  });

  it("schneidet Leerraum am Rand ab", () => {
    expect(envWert("FOO", { FOO: " http://osrm:5000 " })).toBe(
      "http://osrm:5000",
    );
  });
});

describe("envGeheimnis (bug-032)", () => {
  it("liefert das gesetzte Geheimnis", () => {
    expect(envGeheimnis("S", { S: "geheim" })).toBe("geheim");
  });

  it("liefert null bei fehlender, leerer und blanker Variable", () => {
    expect(envGeheimnis("S", {})).toBeNull();
    expect(envGeheimnis("S", { S: "" })).toBeNull();
    expect(envGeheimnis("S", { S: "  " })).toBeNull();
  });

  /**
   * Aus AUTH_SECRET wird der Schluessel abgeleitet, der die Zugangsschluessel
   * der Accounts entschluesselt (req-028). Wuerde hier gekuerzt, passte der
   * abgeleitete Schluessel nicht mehr zu dem, womit gespeichert wurde.
   */
  it("laesst Leerraum am Rand stehen", () => {
    expect(envGeheimnis("S", { S: " geheim " })).toBe(" geheim ");
  });
});
