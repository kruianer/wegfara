// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ACCOUNT_ID, createTestDb } from "@/tests/test-db";
import type { MailMessage } from "../mail/mailer";
import { PARTICIPANT_ERRORS } from "../participants/validate";
import { listOpenInvitations } from "../db/account-users";
import { consumeAccessLink } from "../db/access-links";
import { createAccount } from "../db/accounts";
import { createParticipant, findParticipantById } from "../db/participants";
import { inviteUser } from "./invite-user";

const NOW = new Date("2026-09-04T10:00:00Z");

const versandt: MailMessage[] = [];
const mailer = {
  send: async (message: MailMessage) => {
    versandt.push(message);
    return true;
  },
};

beforeEach(() => {
  versandt.length = 0;
  vi.stubEnv("APP_URL", "https://dev.wegfara.com");
});

describe("inviteUser (req-038)", () => {
  it("legt die Person an und schickt ihr den Zugangslink", async () => {
    const pool = createTestDb();

    const result = await inviteUser(
      pool,
      mailer,
      ACCOUNT_ID,
      { name: "Clara Berger", email: "Clara@Example.com" },
      NOW,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.participant).toMatchObject({
      name: "Clara Berger",
      email: "clara@example.com",
      // Zugang hat, wer den Link eingeloest hat -- nicht schon, wer
      // eingeladen wurde (req-023).
      loginEnabled: false,
    });
    expect(result.invitation.url).toContain(
      "https://dev.wegfara.com/einladung?token=",
    );
    expect(result.invitation.qr.path.length).toBeGreaterThan(0);
    expect(versandt).toHaveLength(1);
    expect(versandt[0].to).toBe("clara@example.com");
    expect(versandt[0].text).toContain(result.invitation.url);
  });

  it("laesst die eingeladene Person mit dem Link herein", async () => {
    const pool = createTestDb();
    const result = await inviteUser(
      pool,
      mailer,
      ACCOUNT_ID,
      { name: "Clara Berger", email: "clara@example.com" },
      NOW,
    );
    if (!result.ok) throw new Error("nicht eingeladen");

    const token = new URL(result.invitation.url).searchParams.get("token")!;

    expect(await consumeAccessLink(pool, token, NOW)).toBe(
      result.participant.id,
    );
  });

  it("weist eine Einladung ohne E-Mail-Adresse ab -- kein Konto ohne Adresse", async () => {
    const pool = createTestDb();

    const result = await inviteUser(
      pool,
      mailer,
      ACCOUNT_ID,
      { name: "Clara Berger", email: "  " },
      NOW,
    );

    expect(result).toEqual({
      ok: false,
      errors: { email: PARTICIPANT_ERRORS.emailRequiredForLogin },
    });
    expect(versandt).toHaveLength(0);
  });

  it("weist eine unbrauchbare Adresse und einen fehlenden Namen ab", async () => {
    const pool = createTestDb();

    expect(
      (
        await inviteUser(
          pool,
          mailer,
          ACCOUNT_ID,
          { name: "Clara", email: "keine-adresse" },
          NOW,
        )
      ).ok,
    ).toBe(false);
    expect(
      (
        await inviteUser(
          pool,
          mailer,
          ACCOUNT_ID,
          { name: " ", email: "clara@example.com" },
          NOW,
        )
      ).ok,
    ).toBe(false);
  });

  it("laedt eine bekannte Adresse erneut ein und entwertet die vorherige Einladung", async () => {
    const pool = createTestDb();
    const erste = await inviteUser(
      pool,
      mailer,
      ACCOUNT_ID,
      { name: "Clara Berger", email: "clara@example.com" },
      NOW,
    );
    if (!erste.ok) throw new Error("nicht eingeladen");
    const alterToken = new URL(erste.invitation.url).searchParams.get("token")!;

    const zweite = await inviteUser(
      pool,
      mailer,
      ACCOUNT_ID,
      { name: "Clara Berger", email: "clara@example.com" },
      NOW,
    );
    if (!zweite.ok) throw new Error("nicht eingeladen");

    // Dieselbe Person, keine zweite.
    expect(zweite.participant.id).toBe(erste.participant.id);
    expect(await consumeAccessLink(pool, alterToken, NOW)).toBeNull();
    // Genau eine offene Einladung -- die neue.
    expect(await listOpenInvitations(pool, ACCOUNT_ID, NOW)).toHaveLength(1);
  });

  it("holt eine bereits erfasste Person herein, statt sie zu verdoppeln", async () => {
    const pool = createTestDb();
    const clara = await createParticipant(
      pool,
      ACCOUNT_ID,
      {
        name: "Clara Berger",
        nickname: null,
        email: "clara@example.com",
        phone: null,
        iban: null,
      },
      NOW,
    );

    const result = await inviteUser(
      pool,
      mailer,
      ACCOUNT_ID,
      { name: "Clara Berger", email: "clara@example.com" },
      NOW,
    );

    expect(result.ok && result.participant.id).toBe(clara.id);
  });

  it("weist eine Adresse ab, die zu einem fremden Account gehoert", async () => {
    const pool = createTestDb();
    const fremder = await createAccount(
      pool,
      "Familie Berger",
      "b@example.com",
    );
    await createParticipant(
      pool,
      fremder.id,
      {
        name: "Clara Berger",
        nickname: null,
        email: "clara@example.com",
        phone: null,
        iban: null,
      },
      NOW,
    );

    const result = await inviteUser(
      pool,
      mailer,
      ACCOUNT_ID,
      { name: "Clara Berger", email: "clara@example.com" },
      NOW,
    );

    expect(result).toEqual({
      ok: false,
      errors: { email: PARTICIPANT_ERRORS.emailTaken },
    });
  });

  it("laesst die Einladung gelten, auch wenn die Mail nicht rausgeht", async () => {
    const pool = createTestDb();
    const stiller = { send: async () => false };

    const result = await inviteUser(
      pool,
      stiller,
      ACCOUNT_ID,
      { name: "Clara Berger", email: "clara@example.com" },
      NOW,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // Link und QR-Code werden zusaetzlich angezeigt und lassen sich ueber
    // jeden anderen Kanal weitergeben (req-023).
    const token = new URL(result.invitation.url).searchParams.get("token")!;
    expect(await consumeAccessLink(pool, token, NOW)).toBe(
      result.participant.id,
    );
    expect(await findParticipantById(pool, result.participant.id)).toBeNull();
  });
});
