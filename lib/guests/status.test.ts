// @vitest-environment node
import { describe, expect, it } from "vitest";
import { guestAccessStatus } from "./status";

const NOW = new Date("2026-09-04T10:00:00Z");
const SPAETER = "2026-09-11T10:00:00Z";
const FRUEHER = "2026-09-01T10:00:00Z";

describe("guestAccessStatus (req-038)", () => {
  it("nennt einen laufenden Zugang aktiv", () => {
    expect(
      guestAccessStatus({ expiresAt: SPAETER, revokedAt: null }, NOW),
    ).toBe("aktiv");
  });

  it("nennt einen verstrichenen Zugang abgelaufen", () => {
    expect(
      guestAccessStatus({ expiresAt: FRUEHER, revokedAt: null }, NOW),
    ).toBe("abgelaufen");
  });

  it("nennt einen zurueckgenommenen Zugang widerrufen", () => {
    expect(
      guestAccessStatus({ expiresAt: SPAETER, revokedAt: FRUEHER }, NOW),
    ).toBe("widerrufen");
  });

  it("laesst den Widerruf den Ablauf schlagen", () => {
    // Ein widerrufener Zugang bleibt widerrufen, auch nachdem seine Frist
    // verstrichen ist -- das ist die staerkere Aussage.
    expect(
      guestAccessStatus({ expiresAt: FRUEHER, revokedAt: FRUEHER }, NOW),
    ).toBe("widerrufen");
  });

  it("laesst einen im selben Augenblick ablaufenden Zugang nicht mehr gelten", () => {
    expect(
      guestAccessStatus({ expiresAt: NOW.toISOString(), revokedAt: null }, NOW),
    ).toBe("abgelaufen");
  });
});
