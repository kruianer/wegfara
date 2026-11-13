// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { ACCOUNT_ID, createTestDb, PARTICIPANT_ID } from "@/tests/test-db";
import { SESSION_COOKIE } from "@/lib/auth/cookies";
import { testFoto } from "@/tests/testfoto";
import type { MiniaturenSchritt } from "@/lib/miniaturen/types";

const testDb = vi.hoisted(() => ({
  pool: undefined as ReturnType<typeof import("@/tests/test-db").createTestDb>,
}));
const cookieJar = vi.hoisted(() => ({ werte: {} as Record<string, string> }));

vi.mock("@/lib/db/pool", () => ({ getPool: () => testDb.pool }));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      cookieJar.werte[name] ? { value: cookieJar.werte[name] } : undefined,
  }),
}));

const { createSession } = await import("@/lib/db/sessions");
const { createParticipant } = await import("@/lib/db/participants");
const { GET, POST } = await import("./route");

let bilder: string;

beforeEach(async () => {
  testDb.pool = createTestDb();
  cookieJar.werte = {};
  bilder = await mkdtemp(path.join(tmpdir(), "wegfara-bilder-"));
  process.env.IMAGE_DIR = bilder;
});

afterEach(async () => {
  await rm(bilder, { recursive: true, force: true });
  delete process.env.IMAGE_DIR;
});

async function alsGesamtAdmin() {
  await createSession(testDb.pool, PARTICIPANT_ID, "token-admin", new Date());
  cookieJar.werte[SESSION_COOKIE] = "token-admin";
}

/** Ein Account-Admin, der nicht Gesamt-Admin ist (req-027). */
async function alsAccountAdmin() {
  const clara = await createParticipant(
    testDb.pool,
    ACCOUNT_ID,
    {
      name: "Clara Berger",
      nickname: null,
      email: null,
      phone: null,
      iban: null,
    },
    new Date(),
    true,
  );
  await createSession(testDb.pool, clara.id, "token-clara", new Date());
  cookieJar.werte[SESSION_COOKIE] = "token-clara";
}

function schritt(nach: string | null = null): Request {
  return new Request("https://dev.wegfara.com/api/miniaturen", {
    method: "POST",
    body: JSON.stringify({ nach }),
  });
}

describe("/api/miniaturen (req-105)", () => {
  it("verlangt eine Anmeldung", async () => {
    expect((await GET()).status).toBe(401);
    expect((await POST(schritt())).status).toBe(401);
  });

  it("gehoert allein dem Gesamt-Admin", async () => {
    await alsAccountAdmin();
    await writeFile(path.join(bilder, "alt.jpg"), await testFoto());

    expect((await GET()).status).toBe(403);
    expect((await POST(schritt())).status).toBe(403);
    expect(await readdir(bilder)).toEqual(["alt.jpg"]);
  });

  it("nennt den Stand und erzeugt die fehlenden Miniaturen", async () => {
    await alsGesamtAdmin();
    await writeFile(path.join(bilder, "alt.jpg"), await testFoto());

    expect(await (await GET()).json()).toEqual({ bilder: 1, mitMiniatur: 0 });

    const response = await POST(schritt());
    expect(response.status).toBe(200);
    expect((await response.json()) as MiniaturenSchritt).toMatchObject({
      bilder: 1,
      mitMiniatur: 1,
      geprueft: 1,
      erzeugt: 1,
      weiter: null,
    });
    expect((await readdir(bilder)).sort()).toEqual([
      "alt.jpg",
      "alt.miniatur.webp",
    ]);
  });

  it("nimmt `nach` nur als Platz in der Reihenfolge, nie als Pfad", async () => {
    await alsGesamtAdmin();
    await writeFile(path.join(bilder, "b.jpg"), await testFoto());

    const response = await POST(schritt("../../a"));

    expect((await response.json()) as MiniaturenSchritt).toMatchObject({
      erzeugt: 1,
    });
  });

  it("beginnt ohne Angabe von vorn", async () => {
    await alsGesamtAdmin();
    await writeFile(path.join(bilder, "alt.jpg"), await testFoto());

    const response = await POST(
      new Request("https://dev.wegfara.com/api/miniaturen", { method: "POST" }),
    );

    expect(((await response.json()) as MiniaturenSchritt).erzeugt).toBe(1);
  });

  it("sagt, wenn es kein Bildverzeichnis gibt", async () => {
    await alsGesamtAdmin();
    delete process.env.IMAGE_DIR;

    expect((await GET()).status).toBe(503);
    expect((await POST(schritt())).status).toBe(503);
  });
});
