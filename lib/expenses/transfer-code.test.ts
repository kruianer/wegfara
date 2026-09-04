// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  TRANSFER_CODE_NAME_MAX,
  transferCodeAmount,
  transferCodeName,
  transferCodePayload,
} from "./transfer-code";

/** Eine gueltige Bankverbindung -- Pruefziffer stimmt (siehe iban.ts). */
const IBAN = "DE89370400440532013000";

function payload(
  overrides: Partial<Parameters<typeof transferCodePayload>[0]>,
) {
  return transferCodePayload({
    recipientName: "Uwe Kremmel",
    iban: IBAN,
    amountCents: 4000,
    ...overrides,
  });
}

function zeilen(text: string): string[] {
  return text.split("\n");
}

describe("transferCodePayload (req-031)", () => {
  it("folgt dem in Europa gebraeuchlichen Format fuer Ueberweisungen", () => {
    const teile = zeilen(payload({}) as string);

    expect(teile[0]).toBe("BCD");
    expect(teile[1]).toBe("002");
    expect(teile[2]).toBe("1");
    expect(teile[3]).toBe("SCT");
    // Die BIC ist in Version 002 entbehrlich und bleibt leer.
    expect(teile[4]).toBe("");
  });

  it("nennt Empfaenger, Bankverbindung und Betrag", () => {
    const teile = zeilen(payload({}) as string);

    expect(teile[5]).toBe("Uwe Kremmel");
    expect(teile[6]).toBe(IBAN);
    expect(teile[7]).toBe("EUR40.00");
  });

  it("enthaelt nichts ueber die Reise oder die Ausgaben", () => {
    // Nach dem Betrag kommt nichts mehr: kein Verwendungszweck, keine
    // Referenz (req-031, Constraints).
    expect(zeilen(payload({}) as string)).toHaveLength(8);
  });

  it("nimmt die Bankverbindung auch mit Leerzeichen entgegen", () => {
    const teile = zeilen(payload({ iban: "de89 3704 0044 0532 0130 00" })!);

    expect(teile[6]).toBe(IBAN);
  });

  it("erzeugt ohne Bankverbindung keinen Code", () => {
    expect(payload({ iban: "" })).toBeNull();
  });

  it("erzeugt zu einer Bankverbindung mit falscher Pruefziffer keinen Code", () => {
    expect(payload({ iban: "DE88370400440532013000" })).toBeNull();
  });

  it("erzeugt ohne Namen keinen Code", () => {
    expect(payload({ recipientName: "   " })).toBeNull();
  });

  it("erzeugt zu einem Betrag von null keinen Code", () => {
    expect(payload({ amountCents: 0 })).toBeNull();
  });

  it("erzeugt zu einem negativen Betrag keinen Code", () => {
    expect(payload({ amountCents: -4000 })).toBeNull();
  });
});

describe("transferCodeName (req-031)", () => {
  it("kuerzt einen zu langen Namen, statt den Code scheitern zu lassen", () => {
    const lang = "Maximiliane".repeat(10);

    expect(transferCodeName(lang)).toHaveLength(TRANSFER_CODE_NAME_MAX);
  });

  it("legt den Namen in eine Zeile", () => {
    expect(transferCodeName("Uwe\nKremmel")).toBe("Uwe Kremmel");
  });
});

describe("transferCodeAmount (req-031)", () => {
  it("schreibt den Betrag mit Punkt und zwei Nachkommastellen", () => {
    expect(transferCodeAmount(4000)).toBe("EUR40.00");
    expect(transferCodeAmount(5)).toBe("EUR0.05");
    expect(transferCodeAmount(123456)).toBe("EUR1234.56");
  });
});
