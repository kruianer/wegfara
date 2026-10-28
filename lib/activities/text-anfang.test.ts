import { describe, expect, it } from "vitest";
import { teileLangtext } from "./text-anfang";

describe("teileLangtext (bug-069)", () => {
  it("schneidet nach dem ersten Satz, wenn der Kurztext kuerzer ist", () => {
    expect(
      teileLangtext("Erster Satz. Zweiter Satz. Dritter Satz.", "Kurz"),
    ).toEqual({ anfang: "Erster Satz.", rest: "Zweiter Satz. Dritter Satz." });
  });

  it("schneidet erst am Satzende hinter der Laenge des Kurztexts", () => {
    expect(
      teileLangtext(
        "Eins. Zwei. Drei, vier und fuenf. Sechs.",
        "Kurztext ueber zwei Saetze",
      ),
    ).toEqual({ anfang: "Eins. Zwei. Drei, vier und fuenf.", rest: "Sechs." });
  });

  it("erkennt auch Ausrufe- und Fragezeichen als Satzende", () => {
    expect(teileLangtext("Schau hin! Warum? Darum.", "")).toEqual({
      anfang: "Schau hin!",
      rest: "Warum? Darum.",
    });
  });

  it("laesst einen Text aus einem einzigen Satz ganz", () => {
    expect(teileLangtext("Nur ein Satz.", "Kurz")).toEqual({
      anfang: "Nur ein Satz.",
      rest: "",
    });
  });

  it("laesst den Text ganz, wenn hinter dem Kurztext kein Satzende mehr kommt", () => {
    expect(
      teileLangtext("Eins. Zwei", "Ein Kurztext, der laenger ist"),
    ).toEqual({ anfang: "Eins. Zwei", rest: "" });
  });

  it("schneidet nicht mitten in einer Zahl wie 1.200", () => {
    expect(teileLangtext("Rund 1.200 Stufen. Oben die Aussicht.", "")).toEqual({
      anfang: "Rund 1.200 Stufen.",
      rest: "Oben die Aussicht.",
    });
  });
});
