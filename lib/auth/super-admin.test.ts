// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Session } from "./types";

const navigation = vi.hoisted(() => ({
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));
const auth = vi.hoisted(() => ({
  session: null as Session | null,
}));

vi.mock("next/navigation", () => ({ notFound: navigation.notFound }));
vi.mock("./current-session", () => ({
  requireSession: async () => {
    if (!auth.session) throw new Error("NEXT_REDIRECT");
    return auth.session;
  },
}));

const { requireSuperAdmin } = await import("./super-admin");

function sitzung(superAdmin: boolean): Session {
  return {
    id: "session-1",
    accountId: "account-1",
    actingAccount: null,
    superAdmin,
    expiresAt: new Date("2026-12-01T00:00:00Z"),
    participant: {
      id: "person-1",
      accountId: "account-1",
      name: "Clara Berger",
      nickname: null,
      email: null,
      phone: null,
      iban: null,
      loginEnabled: true,
    },
  };
}

beforeEach(() => {
  navigation.notFound.mockClear();
  auth.session = null;
});

describe("requireSuperAdmin (req-025)", () => {
  it("laesst den Gesamt-Admin durch", async () => {
    auth.session = sitzung(true);

    await expect(requireSuperAdmin()).resolves.toBe(auth.session);
    expect(navigation.notFound).not.toHaveBeenCalled();
  });

  it("gibt einer gewoehnlichen Person keinen Zugriff", async () => {
    auth.session = sitzung(false);

    await expect(requireSuperAdmin()).rejects.toThrow("NEXT_NOT_FOUND");
    expect(navigation.notFound).toHaveBeenCalled();
  });

  it("verlangt zuerst eine Anmeldung", async () => {
    auth.session = null;

    await expect(requireSuperAdmin()).rejects.toThrow("NEXT_REDIRECT");
  });
});
