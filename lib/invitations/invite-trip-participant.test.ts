// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { ACCOUNT_ID, createTestDb } from "@/tests/test-db";
import { createParticipant } from "../db/participants";
import { assignTripParticipant } from "../db/trip-participants";
import { consumeAccessLink } from "../db/access-links";
import type { Mailer, MailMessage } from "../mail/mailer";
import { inviteTripParticipant } from "./invite-trip-participant";

type Pool = ReturnType<typeof createTestDb>;

const SUEDITALIEN_ID = "d5fda5ea-65e7-4b47-8096-62618599a288";
const NOW = new Date("2026-10-25T12:00:00Z");

function postfach(zugestellt = true): Mailer & { nachrichten: MailMessage[] } {
  const nachrichten: MailMessage[] = [];
  return {
    nachrichten,
    async send(message) {
      nachrichten.push(message);
      return zugestellt;
    },
  };
}

function tokenFrom(url: string): string {
  return decodeURIComponent(new URL(url).searchParams.get("token") ?? "");
}

async function inSueditalien(pool: Pool, name: string, email: string | null) {
  const person = await createParticipant(
    pool,
    ACCOUNT_ID,
    { name, nickname: null, email, phone: null, iban: null },
    NOW,
  );
  await assignTripParticipant(
    pool,
    ACCOUNT_ID,
    SUEDITALIEN_ID,
    person.id,
    "teilnehmer",
  );
  return person;
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("inviteTripParticipant (req-085)", () => {
  it("schickt Anna eine Einladungs-Mail mit dem Einladungslink", async () => {
    vi.stubEnv("APP_URL", "https://wegfara.com");
    const pool = createTestDb();
    const anna = await inSueditalien(pool, "Anna", "anna@example.org");
    const mailer = postfach();

    const result = await inviteTripParticipant(
      pool,
      mailer,
      ACCOUNT_ID,
      anna.id,
      NOW,
    );

    expect(result?.mail).toEqual({
      status: "versandt",
      an: "anna@example.org",
    });
    expect(mailer.nachrichten).toHaveLength(1);
    const [mail] = mailer.nachrichten;
    expect(mail.to).toBe("anna@example.org");
    expect(mail.text).toContain(result?.invitation.url);
    expect(mail.html).toContain(result?.invitation.url);
    expect(mail.text).toContain("Hallo Anna,");
  });

  it("verraet in der Mail nichts von der Reise", async () => {
    const pool = createTestDb();
    const anna = await inSueditalien(pool, "Anna", "anna@example.org");
    const mailer = postfach();

    await inviteTripParticipant(pool, mailer, ACCOUNT_ID, anna.id, NOW);

    const [mail] = mailer.nachrichten;
    expect(mail.text).not.toContain("Süditalien");
    expect(mail.html).not.toContain("Süditalien");
  });

  it("verschickt ohne hinterlegte Adresse nichts und sagt das", async () => {
    const pool = createTestDb();
    const ben = await inSueditalien(pool, "Ben", null);
    const mailer = postfach();

    const result = await inviteTripParticipant(
      pool,
      mailer,
      ACCOUNT_ID,
      ben.id,
      NOW,
    );

    expect(result?.mail).toEqual({ status: "keineAdresse" });
    expect(result?.invitation.participantId).toBe(ben.id);
    expect(mailer.nachrichten).toHaveLength(0);
  });

  it("laesst die Einladung gelten, wenn die Mail nicht hinausgeht", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const pool = createTestDb();
    const anna = await inSueditalien(pool, "Anna", "anna@example.org");

    const result = await inviteTripParticipant(
      pool,
      postfach(false),
      ACCOUNT_ID,
      anna.id,
      NOW,
    );

    expect(result?.mail).toEqual({
      status: "fehlgeschlagen",
      an: "anna@example.org",
    });
    expect(
      await consumeAccessLink(pool, tokenFrom(result!.invitation.url), NOW),
    ).toBe(anna.id);
  });

  it("entwertet mit der zweiten Einladung den Link der ersten Mail", async () => {
    const pool = createTestDb();
    const anna = await inSueditalien(pool, "Anna", "anna@example.org");
    const mailer = postfach();

    const erste = await inviteTripParticipant(
      pool,
      mailer,
      ACCOUNT_ID,
      anna.id,
      NOW,
    );
    const zweite = await inviteTripParticipant(
      pool,
      mailer,
      ACCOUNT_ID,
      anna.id,
      NOW,
    );

    expect(mailer.nachrichten).toHaveLength(2);
    expect(
      await consumeAccessLink(pool, tokenFrom(erste!.invitation.url), NOW),
    ).toBeNull();
    expect(
      await consumeAccessLink(pool, tokenFrom(zweite!.invitation.url), NOW),
    ).toBe(anna.id);
  });

  it("kennt eine Person eines anderen Accounts nicht und verschickt nichts", async () => {
    const pool = createTestDb();
    const anna = await inSueditalien(pool, "Anna", "anna@example.org");
    const mailer = postfach();

    const result = await inviteTripParticipant(
      pool,
      mailer,
      "00000000-0000-4000-8000-000000000000",
      anna.id,
      NOW,
    );

    expect(result).toBeNull();
    expect(mailer.nachrichten).toHaveLength(0);
  });
});
