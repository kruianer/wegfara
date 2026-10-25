import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearFahrzeitCache,
  FAHRZEIT_RUECKFALL_MS,
  fahrzeitMitRueckfall,
} from "./fahrzeit-cache";

const REISE = "reise-1";
const PRAIANO = { lat: 40.6114, lng: 14.6896 };
const AMALFI = { lat: 40.634, lng: 14.6027 };
const POSITANO = { lat: 40.6281, lng: 14.4842 };
const NOW = new Date(2026, 6, 20, 14, 10).getTime();

function dienst(...antworten: (number | null)[]) {
  const fahrzeitMinuten = vi.fn(async () => null as number | null);
  for (const antwort of antworten) {
    fahrzeitMinuten.mockResolvedValueOnce(antwort);
  }
  return { fahrzeitMinuten };
}

beforeEach(() => {
  clearFahrzeitCache();
});

describe("fahrzeitMitRueckfall (bug-067)", () => {
  it("nimmt die frische Angabe des Dienstes", async () => {
    expect(
      await fahrzeitMitRueckfall(REISE, PRAIANO, POSITANO, dienst(25), NOW),
    ).toEqual({ minuten: 25, ermitteltAm: null });
  });

  it("faellt bei einem Ausfall auf die zuletzt ermittelte Fahrzeit zurueck", async () => {
    const routing = dienst(25, null);

    await fahrzeitMitRueckfall(REISE, PRAIANO, POSITANO, routing, NOW);
    const spaeter = NOW + 10 * 60_000;

    // Unterwegs steht die Gruppe inzwischen woanders -- das Ziel ist dasselbe.
    expect(
      await fahrzeitMitRueckfall(REISE, AMALFI, POSITANO, routing, spaeter),
    ).toEqual({ minuten: 25, ermitteltAm: NOW });
  });

  it("fragt den Dienst trotz gemerkter Angabe jedes Mal", async () => {
    // Antwortet er, ist seine Angabe besser als die gemerkte.
    const routing = dienst(25, 18);

    await fahrzeitMitRueckfall(REISE, PRAIANO, POSITANO, routing, NOW);

    expect(
      await fahrzeitMitRueckfall(
        REISE,
        AMALFI,
        POSITANO,
        routing,
        NOW + 60_000,
      ),
    ).toEqual({ minuten: 18, ermitteltAm: null });
    expect(routing.fahrzeitMinuten).toHaveBeenCalledTimes(2);
  });

  it("verwirft eine Angabe, die aelter als das Hoechstalter ist", async () => {
    const routing = dienst(25, null);

    await fahrzeitMitRueckfall(REISE, PRAIANO, POSITANO, routing, NOW);

    expect(
      await fahrzeitMitRueckfall(
        REISE,
        PRAIANO,
        POSITANO,
        routing,
        NOW + FAHRZEIT_RUECKFALL_MS + 1,
      ),
    ).toBeNull();
  });

  it("hat ohne frühere Angabe keinen Rueckfall", async () => {
    expect(
      await fahrzeitMitRueckfall(REISE, PRAIANO, POSITANO, dienst(null), NOW),
    ).toBeNull();
  });

  it("nimmt keine Angabe zu einem anderen Ziel", async () => {
    const routing = dienst(25, null);

    await fahrzeitMitRueckfall(REISE, PRAIANO, POSITANO, routing, NOW);

    expect(
      await fahrzeitMitRueckfall(REISE, PRAIANO, AMALFI, routing, NOW),
    ).toBeNull();
  });

  it("nimmt keine Angabe einer anderen Reise", async () => {
    const routing = dienst(25, null);

    await fahrzeitMitRueckfall(REISE, PRAIANO, POSITANO, routing, NOW);

    expect(
      await fahrzeitMitRueckfall("reise-2", PRAIANO, POSITANO, routing, NOW),
    ).toBeNull();
  });
});
