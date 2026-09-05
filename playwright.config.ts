import { defineConfig } from "@playwright/test";
import { PLANNER_MIN_WIDTH_PX } from "./lib/plan/viewport";

/**
 * Die zweite Pruefebene (req-047): Tests, die die Anwendung im echten
 * Browser bedienen und dabei gegen eine echte PostgreSQL-Datenbank laufen.
 * Sie ergaenzen die Vitest-Suite, sie ersetzen sie nicht.
 *
 * Gestartet werden sie ueber `npm run test:e2e` (siehe scripts/e2e.mjs):
 * dort entstehen die Wegwerf-Datenbank und der Anwendungsserver, die diese
 * Tests voraussetzen. Ein Aufruf von `playwright test` ohne diesen Rahmen
 * findet keinen Server -- deshalb steht hier bewusst kein `webServer`: der
 * Rahmen raeumt am Ende auch die Datenbank wieder weg.
 *
 * Ein Arbeiter, keine Parallelitaet: es sind wenige, kurze Fluesse (siehe
 * Test-Policy in delivery/stack.md), und ein gemeinsamer Anwendungsserver
 * bleibt so berechenbar. Getrennt sind die Tests trotzdem -- jeder legt
 * seinen eigenen Account an (siehe tests/e2e/seed.ts).
 */
/**
 * Normalerweise laeuft das von Playwright mitgelieferte Chromium (siehe
 * `npx playwright install chromium`). Auf Systemen, fuer die es das nicht
 * gibt -- etwa Alpine mit musl statt glibc --, nennt E2E_CHROMIUM_PATH den
 * Browser des Systems, z.B. `/usr/bin/chromium`.
 */
const chromiumPfad = process.env.E2E_CHROMIUM_PATH?.trim();

export default defineConfig({
  testDir: "./tests/e2e",
  // Die Vitest-Suite sammelt *.test.ts ein; die Fluesse hier tragen deshalb
  // eine eigene Endung und geraten nie in den falschen Lauf.
  testMatch: "**/*.e2e.ts",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: [["list"]],
  outputDir: "test-results",
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3210",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: {
        browserName: "chromium",
        // Der Planer setzt einen breiten Bildschirm voraus; darunter zeigt
        // er nur den Hinweis darauf (siehe lib/plan/viewport.ts).
        viewport: { width: PLANNER_MIN_WIDTH_PX + 320, height: 1000 },
        ...(chromiumPfad
          ? { launchOptions: { executablePath: chromiumPfad } }
          : {}),
      },
    },
  ],
});
