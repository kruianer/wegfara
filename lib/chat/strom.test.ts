import { describe, expect, it } from "vitest";
import { chatZeile, leseChatZeilen, type ChatEreignis } from "./strom";
import type { ChatNachricht } from "./types";

const FRAGE: ChatNachricht = {
  id: "11111111-1111-4111-8111-111111111111",
  tripId: "22222222-2222-4222-8222-222222222222",
  rolle: "ich",
  text: "Suche Weingüter bei Bernkastel",
  modell: null,
  quellen: [],
  sucheFehler: null,
  createdAt: "2026-10-12T10:00:00.000Z",
};

function alsStrom(ereignisse: ChatEreignis[]): string {
  return ereignisse.map(chatZeile).join("");
}

describe("Strom des Chats (req-081)", () => {
  it("schreibt je Ereignis eine Zeile", () => {
    expect(chatZeile({ art: "text", text: "Hallo" })).toBe(
      '{"art":"text","text":"Hallo"}\n',
    );
  });

  it("liest die geschriebenen Ereignisse wieder heraus", () => {
    const ereignisse: ChatEreignis[] = [
      { art: "frage", nachricht: FRAGE },
      { art: "text", text: "Bei " },
      { art: "text", text: "Bernkastel" },
      { art: "antwort", nachricht: { ...FRAGE, rolle: "ki" } },
    ];

    const gelesen = leseChatZeilen(alsStrom(ereignisse));

    expect(gelesen.ereignisse).toEqual(ereignisse);
    expect(gelesen.rest).toBe("");
  });

  /**
   * Die Antwort erscheint, waehrend sie entsteht: ein eintreffendes Stueck
   * kann mitten in einer Zeile enden. Eine halbe Zeile ist kein Ereignis und
   * bleibt als Rest liegen, bis der Rest nachkommt.
   */
  it("haelt eine halbe Zeile als Rest zurueck", () => {
    const erstes = leseChatZeilen('{"art":"text","text":"Hal');

    expect(erstes.ereignisse).toEqual([]);
    expect(erstes.rest).toBe('{"art":"text","text":"Hal');

    const zweites = leseChatZeilen(`${erstes.rest}lo"}\n`);
    expect(zweites.ereignisse).toEqual([{ art: "text", text: "Hallo" }]);
    expect(zweites.rest).toBe("");
  });

  it("ueberspringt eine unlesbare Zeile, statt den Strom zu verwerfen", () => {
    const gelesen = leseChatZeilen(
      `kaputt\n{"art":"text","text":"weiter"}\n{"ohne":"art"}\n`,
    );

    expect(gelesen.ereignisse).toEqual([{ art: "text", text: "weiter" }]);
  });

  it("nimmt den Grund eines Fehlschlags mit (bug-032)", () => {
    const gelesen = leseChatZeilen(
      chatZeile({ art: "fehler", grund: "zugang" }),
    );

    expect(gelesen.ereignisse).toEqual([{ art: "fehler", grund: "zugang" }]);
  });
});
