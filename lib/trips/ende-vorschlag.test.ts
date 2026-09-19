import { describe, expect, it } from "vitest";
import {
  endeNachBeginn,
  endeVorschlag,
  VORGESCHLAGENE_REISELAENGE_TAGE,
} from "./ende-vorschlag";

/**
 * Das Ende folgt dem Beginn (req-067): steht ein Beginn und das Ende ist
 * leer, wird es auf Beginn plus sieben Tage vorbelegt. Der Vorschlag ist
 * ein Vorschlag im Formular -- keine Regel in der Datenbank.
 */
describe("endeVorschlag (req-067)", () => {
  it("schlaegt den Beginn plus sieben Tage vor", () => {
    expect(endeVorschlag("2027-03-01")).toBe("2027-03-08");
  });

  it("rechnet ueber den Monatswechsel hinweg", () => {
    expect(endeVorschlag("2027-03-28")).toBe("2027-04-04");
  });

  it("rechnet ueber den Jahreswechsel hinweg", () => {
    expect(endeVorschlag("2027-12-28")).toBe("2028-01-04");
  });

  it("rechnet ueber den Schalttag hinweg", () => {
    expect(endeVorschlag("2028-02-26")).toBe("2028-03-04");
  });

  it("rechnet ueber die Sommerzeitumstellung hinweg", () => {
    // Ende Maerz springt die Uhr -- der Tagesabstand darf das nicht merken.
    expect(endeVorschlag("2027-03-25")).toBe("2027-04-01");
  });

  it("schlaegt nichts vor, solange kein Beginn dasteht", () => {
    expect(endeVorschlag("")).toBe("");
  });

  it("schlaegt nichts zu einem halb getippten Beginn vor", () => {
    expect(endeVorschlag("2027-03")).toBe("");
    expect(endeVorschlag("0000-00-00")).toBe("");
  });

  it("legt eine Woche zugrunde", () => {
    expect(VORGESCHLAGENE_REISELAENGE_TAGE).toBe(7);
  });
});

describe("endeNachBeginn (req-067)", () => {
  it("belegt ein leeres Ende vor", () => {
    expect(endeNachBeginn("2027-03-01", "")).toBe("2027-03-08");
  });

  it("laesst ein eingetragenes Ende unveraendert", () => {
    expect(endeNachBeginn("2027-03-01", "2027-03-20")).toBe("2027-03-20");
  });

  it("ueberschreibt ein eingetragenes Ende auch bei spaeterem Beginn nicht", () => {
    expect(endeNachBeginn("2027-04-10", "2027-03-20")).toBe("2027-03-20");
  });

  it("laesst das Ende leer, solange der Beginn unvollstaendig ist", () => {
    expect(endeNachBeginn("", "")).toBe("");
  });
});
