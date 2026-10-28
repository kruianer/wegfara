import { describe, expect, it, vi } from "vitest";
import type { AiClient } from "@/lib/ai/client";
import { baskenland, baskenlandTrip } from "@/tests/fixtures/baskenland-reise";
import { druckTage } from "./stationen";
import {
  leseUeberschriften,
  schlageUeberschriftenVor,
  ueberschriftenAufforderung,
  ueberschriftVorlagen,
} from "./ueberschriften";

function tage() {
  return druckTage({
    trip: baskenlandTrip(),
    activities: baskenland().activities,
    pois: [],
  });
}

function client(antwort: string): AiClient {
  return {
    complete: vi.fn(async () => ({ ok: true as const, text: antwort })),
    completeWithWebSearch: vi.fn(),
    generateImage: vi.fn(),
  } as unknown as AiClient;
}

describe("Die Ueberschriften der Reisetage (req-103)", () => {
  it("gibt der KI je Tag die Stationen -- aber keine Zahlen", () => {
    const aufforderung = ueberschriftenAufforderung(
      ueberschriftVorlagen(tage()),
    );
    expect(aufforderung).toContain("guggenheim");
    expect(aufforderung).toContain("2027-05-19");
    expect(aufforderung).not.toMatch(/\bkm\b|€|Stationen":\s*\d|kosten/i);
    expect(aufforderung).not.toContain("800");
  });

  it("liefert je Tag eine Ueberschrift", async () => {
    const daten = tage().map((tag) => tag.datum);
    const ki = client(
      JSON.stringify({
        tage: daten.map((datum, index) => ({
          datum,
          ueberschrift: `Tag ${index + 1} am Atlantik`,
        })),
      }),
    );

    const antwort = await schlageUeberschriftenVor(ki, tage());

    expect(antwort.ok).toBe(true);
    if (antwort.ok) {
      expect(antwort.ueberschriften.map((u) => u.datum)).toEqual(daten);
    }
  });

  it("uebergeht Tage, nach denen nicht gefragt war, und zu lange Texte", () => {
    expect(
      leseUeberschriften(
        'Hier: {"tage":[{"datum":"2027-05-19","ueberschrift":"„Guggenheim und Altstadt“"},{"datum":"1999-01-01","ueberschrift":"x"},{"datum":"2027-05-20","ueberschrift":"' +
          "x".repeat(80) +
          '"}]}',
        ["2027-05-19", "2027-05-20"],
      ),
    ).toEqual([{ datum: "2027-05-19", text: "Guggenheim und Altstadt" }]);
  });

  it("meldet einen Fehlschlag, statt etwas zu erfinden", async () => {
    expect(
      (await schlageUeberschriftenVor(client("kein JSON"), tage())).ok,
    ).toBe(false);
  });
});
