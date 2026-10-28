import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { toIsoDateTimeString } from "./sql-datetime";
import { PG_TYPEN, TIMESTAMP_OID } from "./pg-typen";

/**
 * bug-071: Der Treiber las `timestamp without time zone` in der Ortszeit des
 * Prozesses. Auf dem Runner am Beelink (Europe/Berlin) wurde aus 14:00 so
 * 13:00 -- der Begleiter schickte die Wahl einer Options-Gruppe unter diesem
 * Schluessel zurueck, gespeichert wurde sie fuer 13:00, und beim naechsten
 * Laden passte sie zu keiner Gruppe mehr.
 */
describe("PG_TYPEN", () => {
  const vorher = process.env.TZ;

  beforeEach(() => {
    process.env.TZ = "Europe/Berlin";
  });

  afterEach(() => {
    if (vorher === undefined) delete process.env.TZ;
    else process.env.TZ = vorher;
  });

  const lies = (roh: string) =>
    toIsoDateTimeString(PG_TYPEN.getTypeParser(TIMESTAMP_OID, "text")(roh));

  it("liest einen Zeitstempel ohne Zeitzone mit derselben Uhrzeit, die gespeichert ist (bug-071)", () => {
    expect(lies("2026-10-28 14:00:00")).toBe("2026-10-28T14:00");
  });

  it("verschiebt die Uhrzeit auch an der Tagesgrenze nicht", () => {
    expect(lies("2026-07-18 00:30:00")).toBe("2026-07-18T00:30");
  });

  it("liest dasselbe zurueck, was geschrieben wurde -- wiederholt, ohne zu wandern", () => {
    let wert = "2026-10-28T14:00";
    for (let runde = 0; runde < 3; runde++) {
      wert = lies(`${wert.replace("T", " ")}:00`);
    }
    expect(wert).toBe("2026-10-28T14:00");
  });

  it("laesst die uebrigen Typen beim Treiber", () => {
    // int4: unveraendert die Wandlung des Treibers.
    expect(PG_TYPEN.getTypeParser(23, "text")("42")).toBe(42);
  });
});
