import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";

// Kein Test darf unbeabsichtigt einen echten Netzwerkzugriff ausloesen
// (z.B. ueber die Wetterquelle). Tests, die fetch brauchen, stubben es
// gezielt selbst und ueberschreiben damit diesen Default.
beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => {
      throw new Error(
        "Netzwerkzugriff ist in Tests nicht erlaubt — fetch mocken.",
      );
    }),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
