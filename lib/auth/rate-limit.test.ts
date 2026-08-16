// @vitest-environment node
import { describe, expect, it } from "vitest";
import { createRateLimiter } from "./rate-limit";

const NOW = new Date("2026-08-16T12:00:00Z");

function later(minutes: number): Date {
  return new Date(NOW.getTime() + minutes * 60 * 1000);
}

describe("createRateLimiter", () => {
  it("laesst Versuche bis zur Grenze durch", () => {
    const limiter = createRateLimiter(3, 15 * 60 * 1000);

    expect(limiter.allow("uwe@kremmel.org", NOW)).toBe(true);
    expect(limiter.allow("uwe@kremmel.org", NOW)).toBe(true);
    expect(limiter.allow("uwe@kremmel.org", NOW)).toBe(true);
  });

  it("bremst ab der Grenze", () => {
    const limiter = createRateLimiter(2, 15 * 60 * 1000);
    limiter.allow("uwe@kremmel.org", NOW);
    limiter.allow("uwe@kremmel.org", NOW);

    expect(limiter.allow("uwe@kremmel.org", NOW)).toBe(false);
  });

  it("bremst nur den betroffenen Schluessel", () => {
    const limiter = createRateLimiter(1, 15 * 60 * 1000);
    limiter.allow("uwe@kremmel.org", NOW);

    expect(limiter.allow("andere@example.com", NOW)).toBe(true);
  });

  it("gibt nach Ablauf des Zeitfensters wieder frei", () => {
    const limiter = createRateLimiter(1, 15 * 60 * 1000);
    limiter.allow("uwe@kremmel.org", NOW);

    expect(limiter.allow("uwe@kremmel.org", later(16))).toBe(true);
  });

  it("laesst abgelehnte Versuche das Zeitfenster nicht verlaengern", () => {
    const limiter = createRateLimiter(1, 15 * 60 * 1000);
    limiter.allow("uwe@kremmel.org", NOW);
    limiter.allow("uwe@kremmel.org", later(10));

    expect(limiter.allow("uwe@kremmel.org", later(16))).toBe(true);
  });
});
