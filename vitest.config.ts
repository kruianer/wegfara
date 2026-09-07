import { configDefaults, defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
    // Steht NODE_ENV beim Aufruf auf "production" (etwa weil zuvor gebaut
    // wurde), laedt React seine Produktions-Bauart -- der fehlt `act`, und
    // jeder Komponententest scheitert daran, ohne dass am Quelltext etwas
    // falsch waere. Der Testlauf setzt die Umgebung deshalb selbst, statt
    // sie vorzufinden.
    env: { NODE_ENV: "test" },
    // Getestet wird der Quelltext, nie das Bauergebnis. Das Standalone-Bundle
    // enthaelt Kopien von Quelldateien (siehe outputFileTracingExcludes in
    // next.config.ts); wuerden deren Tests mitlaufen, liefen sie gegen eine
    // zweite Next-Installation unter .next/standalone/node_modules — die
    // Mocks der Tests greifen dort nicht, und die Suite waere rot, sobald
    // vor dem Testlauf gebaut wurde.
    // tests/e2e/ gehoert Playwright (req-047) -- diese Fluesse setzen einen
    // laufenden Server und eine echte Datenbank voraus und laufen ueber
    // `npm run test:e2e`.
    exclude: [...configDefaults.exclude, "**/.next/**", "tests/e2e/**"],
  },
});
