import { describe, expect, it } from "vitest";
import {
  lueckeMinuten,
  passtInLuecke,
  zeitpuffer,
  zeitreichtNichtHinweis,
} from "./luecke";

const VORMITTAG = { endAt: "2026-07-20T12:30" };
const NACHMITTAG = { startAt: "2026-07-20T12:50" };

describe("lueckeMinuten (req-052)", () => {
  it("misst die Minuten zwischen zwei Programmpunkten", () => {
    expect(lueckeMinuten(VORMITTAG, NACHMITTAG)).toBe(20);
  });

  it("misst ueber Mitternacht hinweg", () => {
    expect(
      lueckeMinuten(
        { endAt: "2026-07-20T23:30" },
        { startAt: "2026-07-21T00:15" },
      ),
    ).toBe(45);
  });

  it("misst bei ueberlappenden Programmpunkten nach unten", () => {
    expect(
      lueckeMinuten(
        { endAt: "2026-07-20T13:00" },
        { startAt: "2026-07-20T12:30" },
      ),
    ).toBe(-30);
  });
});

describe("passtInLuecke (req-052)", () => {
  it("laesst eine Fahrzeit gelten, die genau aufgeht", () => {
    expect(passtInLuecke(20, 20)).toBe(true);
  });

  it("erkennt eine Fahrzeit, die laenger ist als die Luecke", () => {
    expect(passtInLuecke(20, 40)).toBe(false);
  });
});

describe("zeitreichtNichtHinweis (req-052)", () => {
  it("schweigt, wenn die Zeit reicht", () => {
    expect(zeitreichtNichtHinweis(60, 40)).toBeNull();
  });

  it("nennt Luecke und Fahrzeit, wenn die Zeit nicht reicht", () => {
    expect(zeitreichtNichtHinweis(20, 40)).toContain("20 Min");
    expect(zeitreichtNichtHinweis(20, 40)).toContain("40 Min");
  });

  it("nennt bei fehlender Luecke, dass gar keine da ist", () => {
    expect(zeitreichtNichtHinweis(0, 40)).toContain("keine Lücke");
  });
});

describe("zeitpuffer (req-073)", () => {
  it("nennt die uebrige Zeit mit einem Plus", () => {
    expect(zeitpuffer(60, 35)).toMatchObject({
      minuten: 25,
      text: "+25 Min",
      passt: true,
    });
  });

  it("nennt die fehlende Zeit mit einem Minus", () => {
    expect(zeitpuffer(20, 35)).toMatchObject({
      minuten: -15,
      text: "−15 Min",
      passt: false,
    });
  });

  it("nennt das genaue Aufgehen mit einem Plusminus -- und als passend", () => {
    expect(zeitpuffer(35, 35)).toMatchObject({
      minuten: 0,
      text: "±0 Min",
      passt: true,
    });
  });

  it("nennt ohne Luecke die volle Fahrzeit als Minus", () => {
    // Nicht "±0 Min": es fehlt die ganze Fahrzeit (req-073).
    expect(zeitpuffer(0, 35)).toMatchObject({
      minuten: -35,
      text: "−35 Min",
      passt: false,
    });
  });

  it("nennt auch bei ueberlappenden Programmpunkten das volle Minus", () => {
    expect(zeitpuffer(-10, 35).text).toBe("−45 Min");
  });
});
