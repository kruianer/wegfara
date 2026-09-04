// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ACCOUNT_ID, createTestDb } from "@/tests/test-db";
import { LOGIN_LINK_NOTICE } from "@/lib/auth/messages";
import { LOGIN_LINK_MAX_ATTEMPTS } from "@/lib/auth/rate-limit";

const testDb = vi.hoisted(() => ({
  pool: undefined as ReturnType<typeof import("@/tests/test-db").createTestDb>,
}));
const mailer = vi.hoisted(() => ({
  send: vi.fn(async () => true),
}));

vi.mock("@/lib/db/pool", () => ({ getPool: () => testDb.pool }));
vi.mock("@/lib/mail/smtp-mailer", () => ({ smtpMailer: mailer }));

const { createParticipant, enableLogin } = await import(
  "@/lib/db/participants"
);
const { POST } = await import("./route");

const NOW = new Date("2026-09-04T12:00:00Z");

/**
 * Die Bremse zaehlt je Adresse und liegt im Arbeitsspeicher des Moduls --
 * sie ueberdauert damit den einzelnen Test. Jeder Fall bekommt deshalb seine
 * eigene Adresse, so wie im Betrieb jedes Konto seine eigene hat.
 */
async function personMitAdresse(email: string) {
  const person = await createParticipant(
    testDb.pool,
    ACCOUNT_ID,
    { name: "Testperson", nickname: null, email, phone: null, iban: null },
    NOW,
  );
  await enableLogin(testDb.pool, person.id);
  return email;
}

function anfrage(email: string) {
  return new Request("https://dev.wegfara.com/api/auth/anmeldelink", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-forwarded-proto": "https",
    },
    body: JSON.stringify({ email }),
  });
}

async function anfordern(email: string) {
  const response = await POST(anfrage(email));
  return (await response.json()) as { notice: string };
}

beforeEach(() => {
  testDb.pool = createTestDb();
  mailer.send.mockClear();
  mailer.send.mockImplementation(async () => true);
  vi.stubEnv("APP_URL", "https://dev.wegfara.com");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("Anmeldelink anfordern (req-037)", () => {
  it("verschickt hoechstens drei Links pro Stunde und Konto", async () => {
    const email = await personMitAdresse("bremse@example.com");

    for (let versuch = 0; versuch < LOGIN_LINK_MAX_ATTEMPTS; versuch++) {
      await anfordern(email);
    }
    const vierte = await anfordern(email);

    expect(mailer.send).toHaveBeenCalledTimes(LOGIN_LINK_MAX_ATTEMPTS);
    // Die Antwort unterscheidet sich NICHT von der bei einer erfolgreichen
    // Anforderung -- sonst liesse sich am Verhalten ablesen, ob eine Adresse
    // bekannt ist.
    expect(vierte.notice).toBe(LOGIN_LINK_NOTICE);
  });

  it("antwortet bei unbekannter Adresse wortgleich wie bei bekannter", async () => {
    const email = await personMitAdresse("bekannt@example.com");

    const bekannt = await anfordern(email);
    const unbekannt = await anfordern("unbekannt@example.com");

    expect(unbekannt.notice).toBe(bekannt.notice);
    expect(mailer.send).toHaveBeenCalledTimes(1);
  });

  it("antwortet unveraendert, wenn der Versand ausfaellt", async () => {
    const email = await personMitAdresse("ausfall@example.com");
    mailer.send.mockImplementation(async () => false);
    const log = vi.spyOn(console, "error").mockImplementation(() => {});

    const antwort = await anfordern(email);

    expect(antwort.notice).toBe(LOGIN_LINK_NOTICE);
    // Der Fehler steht im Log, nicht in der Antwort.
    expect(log).toHaveBeenCalled();
    log.mockRestore();
  });
});
