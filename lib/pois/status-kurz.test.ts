import { describe, expect, it } from "vitest";
import { POI_STATUSES, POI_STATUS_KURZ } from "./status-meta";

describe("POI_STATUS_KURZ (req-097)", () => {
  it("nennt jeden Status kurz", () => {
    expect(POI_STATUSES.map((status) => POI_STATUS_KURZ[status])).toEqual([
      "Fix",
      "Alternative",
      "Offen",
      "Warteliste",
      "Nein",
    ]);
  });
});
