import { afterEach, describe, expect, it } from "vitest";
import { beginRestore, endRestore, restoreInProgress } from "./maintenance";

afterEach(() => {
  endRestore();
});

describe("Sperre waehrend der Wiederherstellung (req-053)", () => {
  it("ist im Ruhezustand offen", () => {
    expect(restoreInProgress()).toBe(false);
  });

  it("sperrt, solange eine Wiederherstellung laeuft", () => {
    expect(beginRestore()).toBe(true);

    expect(restoreInProgress()).toBe(true);
  });

  it("laesst keine zweite gleichzeitig beginnen", () => {
    beginRestore();

    expect(beginRestore()).toBe(false);
  });

  it("gibt die App danach wieder frei", () => {
    beginRestore();

    endRestore();

    expect(restoreInProgress()).toBe(false);
    expect(beginRestore()).toBe(true);
  });
});
