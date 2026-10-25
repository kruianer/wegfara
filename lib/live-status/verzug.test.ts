import { describe, expect, it } from "vitest";
import { verzugAusFahrzeit, verzugText } from "./verzug";

describe("verzugAusFahrzeit (req-051)", () => {
  it("meldet 25 Fahrminuten als Verspaetung", () => {
    expect(verzugAusFahrzeit(25)).toEqual({ art: "verspaetet", minuten: 25 });
  });

  it("rundet auf ganze Minuten", () => {
    expect(verzugAusFahrzeit(24.6)).toEqual({ art: "verspaetet", minuten: 25 });
    expect(verzugAusFahrzeit(5.4)).toEqual({ art: "verspaetet", minuten: 5 });
  });

  it("ist am Ort des Programmpunkts im Zeitplan", () => {
    expect(verzugAusFahrzeit(0)).toEqual({ art: "im_zeitplan" });
  });

  it("ist bei drei Fahrminuten im Zeitplan", () => {
    expect(verzugAusFahrzeit(3)).toEqual({ art: "im_zeitplan" });
  });

  // Entschieden wird an der gerundeten Minute -- dieselbe Zahl, die in der
  // Pille steht. Sonst koennte dort "5 Min zu spaet" neben der Aussage
  // stehen, die Gruppe sei im Zeitplan.
  it("ist ab fuenf Fahrminuten zu spaet", () => {
    expect(verzugAusFahrzeit(4.4)).toEqual({ art: "im_zeitplan" });
    expect(verzugAusFahrzeit(4.5)).toEqual({ art: "verspaetet", minuten: 5 });
    expect(verzugAusFahrzeit(5)).toEqual({ art: "verspaetet", minuten: 5 });
  });

  it("bleibt unbekannt, wenn der Routing-Dienst nichts liefert", () => {
    expect(verzugAusFahrzeit(null)).toEqual({ art: "unbekannt" });
  });
});

describe("verzugText (req-051)", () => {
  it("beschriftet die Status-Pille", () => {
    expect(verzugText({ art: "im_zeitplan" })).toBe("Im Zeitplan");
    expect(verzugText({ art: "verspaetet", minuten: 25 })).toBe(
      "25 Min zu spät",
    );
  });

  it("weist auf den nicht ermittelbaren Verzug hin", () => {
    expect(verzugText({ art: "unbekannt" })).toMatch(/nicht ermittel/i);
  });

  it("hat ohne Verzug keinen Text", () => {
    expect(verzugText({ art: "keiner" })).toBeNull();
  });
});

describe("Verzug aus einer frueheren Abfrage (bug-067)", () => {
  const VORHIN = new Date(2026, 6, 20, 14, 2);

  it("nennt den Stand, wenn die Fahrzeit aus dem Speicher kommt", () => {
    expect(verzugAusFahrzeit(25, VORHIN.getTime())).toEqual({
      art: "verspaetet",
      minuten: 25,
      stand: VORHIN.toISOString(),
    });
    expect(verzugAusFahrzeit(2, VORHIN.getTime())).toEqual({
      art: "im_zeitplan",
      stand: VORHIN.toISOString(),
    });
  });

  it("haengt den Stand in Ortszeit an den Text", () => {
    expect(
      verzugText({
        art: "verspaetet",
        minuten: 25,
        stand: VORHIN.toISOString(),
      }),
    ).toBe("25 Min zu spät · Stand 14:02");
    expect(
      verzugText({ art: "im_zeitplan", stand: VORHIN.toISOString() }),
    ).toBe("Im Zeitplan · Stand 14:02");
  });

  it("nennt ohne Stand keinen", () => {
    expect(verzugText({ art: "verspaetet", minuten: 25 })).toBe(
      "25 Min zu spät",
    );
  });
});
