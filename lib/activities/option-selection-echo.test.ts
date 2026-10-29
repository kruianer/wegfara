import { afterEach, describe, expect, it } from "vitest";
import {
  bestaetigeOptionSelectionEcho,
  ladeBestaetigteOptionSelections,
  ladeOptionSelectionEcho,
  merkeOptionSelectionEcho,
  vergissOptionSelectionEcho,
} from "./option-selection-echo";

afterEach(() => {
  window.localStorage.clear();
});

describe("option-selection-echo (bug-060)", () => {
  it("ist leer, solange nichts gewaehlt wurde", () => {
    expect(ladeOptionSelectionEcho()).toEqual({});
  });

  it("merkt eine gewaehlte Alternative unter ihrem Gruppen-Schluessel", () => {
    merkeOptionSelectionEcho(
      "trip-1|2026-07-21T13:30|2026-07-21T15:00",
      "activity-2",
    );

    expect(ladeOptionSelectionEcho()).toEqual({
      "trip-1|2026-07-21T13:30|2026-07-21T15:00": "activity-2",
    });
  });

  it("ueberschreibt eine zuvor gemerkte Wahl derselben Gruppe", () => {
    const key = "trip-1|2026-07-21T13:30|2026-07-21T15:00";
    merkeOptionSelectionEcho(key, "activity-2");
    merkeOptionSelectionEcho(key, "activity-3");

    expect(ladeOptionSelectionEcho()).toEqual({ [key]: "activity-3" });
  });

  it("behaelt das Echo anderer Gruppen beim Merken einer weiteren", () => {
    merkeOptionSelectionEcho("trip-1|a|b", "activity-1");
    merkeOptionSelectionEcho("trip-1|c|d", "activity-2");

    expect(ladeOptionSelectionEcho()).toEqual({
      "trip-1|a|b": "activity-1",
      "trip-1|c|d": "activity-2",
    });
  });

  it("vergisst nur die genannte Gruppe", () => {
    merkeOptionSelectionEcho("trip-1|a|b", "activity-1");
    merkeOptionSelectionEcho("trip-1|c|d", "activity-2");

    vergissOptionSelectionEcho("trip-1|a|b");

    expect(ladeOptionSelectionEcho()).toEqual({ "trip-1|c|d": "activity-2" });
  });

  it("bleibt unveraendert, wenn die vergessene Gruppe gar nicht im Echo steht", () => {
    merkeOptionSelectionEcho("trip-1|a|b", "activity-1");

    vergissOptionSelectionEcho("trip-1|unbekannt|x");

    expect(ladeOptionSelectionEcho()).toEqual({ "trip-1|a|b": "activity-1" });
  });

  it("ignoriert einen beschaedigten Eintrag, statt zu werfen", () => {
    window.localStorage.setItem("wegfara.go.option-selection-echo", "{kaputt");

    expect(ladeOptionSelectionEcho()).toEqual({});
  });

  it("laesst Eintraege aus, deren Wert kein String ist", () => {
    window.localStorage.setItem(
      "wegfara.go.option-selection-echo",
      JSON.stringify({ "trip-1|a|b": 42 }),
    );

    expect(ladeOptionSelectionEcho()).toEqual({});
  });
});

describe("bestaetigte Wahlen (bug-073)", () => {
  const key = "trip-1|2026-07-21T13:30|2026-07-21T15:00";

  it("ersetzt das Echo durch die Bestaetigung samt Uhrzeit des Servers", () => {
    merkeOptionSelectionEcho(key, "activity-2");

    bestaetigeOptionSelectionEcho(key, "activity-2", 1000);

    expect(ladeOptionSelectionEcho()).toEqual({});
    expect(ladeBestaetigteOptionSelections()).toEqual({
      [key]: { activityId: "activity-2", um: 1000 },
    });
  });

  it("laesst eine neuere Wahl derselben Gruppe stehen", () => {
    merkeOptionSelectionEcho(key, "activity-2");
    merkeOptionSelectionEcho(key, "activity-3");

    bestaetigeOptionSelectionEcho(key, "activity-2", 1000);

    expect(ladeOptionSelectionEcho()).toEqual({ [key]: "activity-3" });
    expect(ladeBestaetigteOptionSelections()).toEqual({});
  });

  it("vergisst das Echo ohne Bestaetigung, wenn der Server keine Uhrzeit nennt", () => {
    merkeOptionSelectionEcho(key, "activity-2");

    bestaetigeOptionSelectionEcho(key, "activity-2", null);

    expect(ladeOptionSelectionEcho()).toEqual({});
    expect(ladeBestaetigteOptionSelections()).toEqual({});
  });

  it("eine neue Wahl hebt die Bestaetigung der vorigen auf", () => {
    merkeOptionSelectionEcho(key, "activity-2");
    bestaetigeOptionSelectionEcho(key, "activity-2", 1000);

    merkeOptionSelectionEcho(key, "activity-3");

    expect(ladeBestaetigteOptionSelections()).toEqual({});
    expect(ladeOptionSelectionEcho()).toEqual({ [key]: "activity-3" });
  });

  it("vergessen nimmt auch die Bestaetigung weg", () => {
    merkeOptionSelectionEcho(key, "activity-2");
    bestaetigeOptionSelectionEcho(key, "activity-2", 1000);

    vergissOptionSelectionEcho(key);

    expect(ladeBestaetigteOptionSelections()).toEqual({});
  });

  it("laesst unvollstaendige Eintraege aus", () => {
    window.localStorage.setItem(
      "wegfara.go.option-selection-bestaetigt",
      JSON.stringify({ [key]: { activityId: "activity-2" }, x: "kaputt" }),
    );

    expect(ladeBestaetigteOptionSelections()).toEqual({});
  });
});
