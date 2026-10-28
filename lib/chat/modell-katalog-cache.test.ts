import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  AiModellKatalog,
  KatalogErgebnis,
  KatalogModell,
} from "../ai/modell-katalog";
import {
  KATALOG_FEHLPAUSE_MS,
  KATALOG_HOECHSTALTER_MS,
  KATALOG_RUECKFALL_MS,
  chatModelleZwischengespeichert,
  clearChatModellCache,
  gemerkteChatModelle,
} from "./modell-katalog-cache";

const ACCOUNT = "account-1";
const NOW = Date.parse("2026-10-27T10:00:00Z");

const SONNET: KatalogModell = {
  id: "claude-sonnet-5-5",
  name: "Claude Sonnet 5.5",
  lebenslauf: "active",
  reihe: "sonnet",
  maxEingabeTokens: 200000,
};

/** Der Dienst antwortet der Reihe nach so, danach immer wie zuletzt. */
function dienst(...ergebnisse: KatalogErgebnis[]) {
  let letztes = ergebnisse[0];
  const liste = vi.fn(async () => {
    letztes = ergebnisse.shift() ?? letztes;
    return letztes;
  });
  return { liste, katalog: (): AiModellKatalog => ({ liste }) };
}

const NENNT: KatalogErgebnis = { modelle: [SONNET], fehler: null };
const SCHWEIGT: KatalogErgebnis = {
  modelle: null,
  fehler: { art: "netz", detail: "Connection error." },
};

beforeEach(() => {
  clearChatModellCache();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("Zwischenspeicher der Modellauswahl (req-090)", () => {
  it("fragt beim zweiten Oeffnen nicht erneut beim Dienst", async () => {
    const { liste, katalog } = dienst(NENNT);
    await chatModelleZwischengespeichert(ACCOUNT, katalog, NOW);
    const zweites = await chatModelleZwischengespeichert(
      ACCOUNT,
      katalog,
      NOW + 60_000,
    );

    expect(zweites?.map((modell) => modell.id)).toEqual(["claude-sonnet-5-5"]);
    expect(liste).toHaveBeenCalledTimes(1);
  });

  it("fragt nach dem Hoechstalter erneut", async () => {
    const { liste, katalog } = dienst(NENNT);
    await chatModelleZwischengespeichert(ACCOUNT, katalog, NOW);
    await chatModelleZwischengespeichert(
      ACCOUNT,
      katalog,
      NOW + KATALOG_HOECHSTALTER_MS + 1,
    );

    expect(liste).toHaveBeenCalledTimes(2);
  });

  it("merkt sich je Account -- jeder fragt mit seinem Schluessel", async () => {
    const { liste, katalog } = dienst(NENNT);
    await chatModelleZwischengespeichert(ACCOUNT, katalog, NOW);
    await chatModelleZwischengespeichert("account-2", katalog, NOW);

    expect(liste).toHaveBeenCalledTimes(2);
  });

  it("traegt beim Ausfall des Dienstes den gemerkten Katalog weiter", async () => {
    const { katalog } = dienst(NENNT, SCHWEIGT);
    await chatModelleZwischengespeichert(ACCOUNT, katalog, NOW);
    const spaeter = await chatModelleZwischengespeichert(
      ACCOUNT,
      katalog,
      NOW + KATALOG_HOECHSTALTER_MS + 1,
    );

    expect(spaeter?.map((modell) => modell.id)).toEqual(["claude-sonnet-5-5"]);
  });

  it("traegt einen zu alten Katalog nicht weiter", async () => {
    const { katalog } = dienst(NENNT, SCHWEIGT);
    await chatModelleZwischengespeichert(ACCOUNT, katalog, NOW);

    expect(
      await chatModelleZwischengespeichert(
        ACCOUNT,
        katalog,
        NOW + KATALOG_RUECKFALL_MS + 1,
      ),
    ).toBeNull();
  });

  it("meldet ohne gemerkten Katalog, dass die Liste nicht zu holen ist", async () => {
    const { katalog } = dienst(SCHWEIGT);
    expect(
      await chatModelleZwischengespeichert(ACCOUNT, katalog, NOW),
    ).toBeNull();
  });

  it("gilt eine Liste ohne aktives Modell als nicht geholt", async () => {
    const { katalog } = dienst({
      modelle: [{ ...SONNET, lebenslauf: "retired" }],
      fehler: null,
    });
    expect(
      await chatModelleZwischengespeichert(ACCOUNT, katalog, NOW),
    ).toBeNull();
  });

  it("fragt nach einem Fehlschlag nicht bei jedem Oeffnen erneut", async () => {
    const { liste, katalog } = dienst(SCHWEIGT, NENNT);
    await chatModelleZwischengespeichert(ACCOUNT, katalog, NOW);
    await chatModelleZwischengespeichert(ACCOUNT, katalog, NOW + 1000);
    expect(liste).toHaveBeenCalledTimes(1);

    const danach = await chatModelleZwischengespeichert(
      ACCOUNT,
      katalog,
      NOW + KATALOG_FEHLPAUSE_MS,
    );
    expect(liste).toHaveBeenCalledTimes(2);
    expect(danach?.map((modell) => modell.id)).toEqual(["claude-sonnet-5-5"]);
  });

  it("schickt bei gleichzeitigem Oeffnen nur eine Anfrage hinaus", async () => {
    const { liste, katalog } = dienst(NENNT);
    await Promise.all([
      chatModelleZwischengespeichert(ACCOUNT, katalog, NOW),
      chatModelleZwischengespeichert(ACCOUNT, katalog, NOW),
    ]);
    expect(liste).toHaveBeenCalledTimes(1);
  });

  it("nennt den gemerkten Katalog fuer die Pruefung beim Senden", async () => {
    expect(gemerkteChatModelle(ACCOUNT, NOW)).toBeNull();
    const { katalog } = dienst(NENNT);
    await chatModelleZwischengespeichert(ACCOUNT, katalog, NOW);
    expect(gemerkteChatModelle(ACCOUNT, NOW)?.[0].id).toBe("claude-sonnet-5-5");
  });
});
