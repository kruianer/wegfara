// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PARTICIPANT_ID, createTestDb } from "@/tests/test-db";
import { SESSION_COOKIE, RECOVERY_COOKIE } from "@/lib/auth/cookies";

const testDb = vi.hoisted(() => ({
  pool: undefined as ReturnType<typeof import("@/tests/test-db").createTestDb>,
}));

vi.mock("@/lib/db/pool", () => ({ getPool: () => testDb.pool }));

const { createLoginLink } = await import("@/lib/db/login-links");
const { GET } = await import("./route");

const NOW = new Date();

function aufruf(token: string, weiter?: string) {
  const url = new URL("https://dev.wegfara.com/anmeldung/link");
  url.searchParams.set("token", token);
  if (weiter) url.searchParams.set("weiter", weiter);
  return new Request(url, { headers: { "x-forwarded-proto": "https" } });
}

beforeEach(() => {
  testDb.pool = createTestDb();
});

describe("GET /anmeldung/link (req-016)", () => {
  it("meldet an, wer den Anmeldelink aufruft", async () => {
    await createLoginLink(testDb.pool, PARTICIPANT_ID, "token-1", NOW);

    const response = await GET(aufruf("token-1", "/go"));

    expect(response.status).toBe(303);
    const cookie = response.cookies.get(SESSION_COOKIE);
    expect(cookie?.value).toBeTruthy();
    expect(cookie?.httpOnly).toBe(true);
    expect(cookie?.secure).toBe(true);
  });

  it("zeigt bei der ersten Anmeldung die Notfallcodes", async () => {
    await createLoginLink(testDb.pool, PARTICIPANT_ID, "token-1", NOW);

    const response = await GET(aufruf("token-1", "/go"));

    expect(response.headers.get("location")).toBe(
      "https://dev.wegfara.com/anmeldung/notfallcodes?weiter=%2Fgo",
    );
    const codes = JSON.parse(
      decodeURIComponent(response.cookies.get(RECOVERY_COOKIE)?.value ?? "[]"),
    );
    expect(codes).toHaveLength(8);
  });

  it("fuehrt bei jeder weiteren Anmeldung direkt ans gemerkte Ziel", async () => {
    await createLoginLink(testDb.pool, PARTICIPANT_ID, "token-1", NOW);
    await GET(aufruf("token-1", "/go"));
    await createLoginLink(testDb.pool, PARTICIPANT_ID, "token-2", NOW);

    const response = await GET(aufruf("token-2", "/go"));

    expect(response.headers.get("location")).toBe("https://dev.wegfara.com/go");
    expect(response.cookies.get(RECOVERY_COOKIE)).toBeUndefined();
  });

  it("meldet beim zweiten Aufruf desselben Links niemanden an", async () => {
    await createLoginLink(testDb.pool, PARTICIPANT_ID, "token-1", NOW);
    await GET(aufruf("token-1", "/go"));

    const response = await GET(aufruf("token-1", "/go"));

    expect(response.headers.get("location")).toBe(
      "https://dev.wegfara.com/anmeldung?fehler=link",
    );
    expect(response.cookies.get(SESSION_COOKIE)).toBeUndefined();
  });

  it("meldet mit einem erfundenen Token niemanden an", async () => {
    const response = await GET(aufruf("ausgedacht"));

    expect(response.headers.get("location")).toContain("fehler=link");
    expect(response.cookies.get(SESSION_COOKIE)).toBeUndefined();
  });

  it("nimmt kein fremdes Ziel aus der Adresszeile an", async () => {
    await createLoginLink(testDb.pool, PARTICIPANT_ID, "token-1", NOW);

    const response = await GET(aufruf("token-1", "//fremde-seite.example"));

    expect(response.headers.get("location")).toBe(
      "https://dev.wegfara.com/anmeldung/notfallcodes?weiter=%2F",
    );
  });
});
