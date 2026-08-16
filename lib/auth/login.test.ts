// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  PARTICIPANT_EMAIL,
  PARTICIPANT_ID,
  createTestDb,
} from "../../tests/test-db";
import type { MailMessage, Mailer } from "../mail/mailer";
import { findSessionByToken } from "../db/sessions";
import { countUnusedRecoveryCodes } from "../db/recovery-codes";
import {
  beginSession,
  createRecoveryCodeSet,
  logout,
  loginWithRecoveryCode,
  redeemLoginLink,
  requestLoginLink,
} from "./login";
import { findParticipantByEmail } from "../db/participants";

const NOW = new Date("2026-08-16T12:00:00Z");

function minutesLater(minutes: number): Date {
  return new Date(NOW.getTime() + minutes * 60 * 1000);
}

/** Ein Mailversand, der nichts verschickt, aber alles mitschreibt. */
function recordingMailer(): Mailer & { sent: MailMessage[] } {
  const sent: MailMessage[] = [];
  return {
    sent,
    async send(message) {
      sent.push(message);
      return true;
    },
  };
}

/** Zieht den Token aus dem Anmeldelink der zuletzt verschickten Mail. */
function tokenFrom(message: MailMessage): string {
  const match = message.text.match(/token=([A-Za-z0-9_%-]+)/);
  return decodeURIComponent(match?.[1] ?? "");
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("requestLoginLink", () => {
  it("verschickt einen Anmeldelink an eine bekannte Adresse (req-016)", async () => {
    const pool = createTestDb();
    const mailer = recordingMailer();
    vi.stubEnv("APP_URL", "https://dev.wegfara.com");

    await requestLoginLink(pool, mailer, PARTICIPANT_EMAIL, NOW);

    expect(mailer.sent).toHaveLength(1);
    expect(mailer.sent[0].to).toBe(PARTICIPANT_EMAIL);
    expect(mailer.sent[0].text).toContain(
      "https://dev.wegfara.com/anmeldung/link?token=",
    );
  });

  it("verschickt nichts an eine unbekannte Adresse und verraet das nicht", async () => {
    const pool = createTestDb();
    const mailer = recordingMailer();

    // Dieselbe Rueckmeldung fuer beide Faelle: die Funktion liefert in
    // beiden nichts zurueck, woraus sich ein Unterschied ablesen liesse.
    const bekannt = await requestLoginLink(
      pool,
      mailer,
      PARTICIPANT_EMAIL,
      NOW,
    );
    const unbekannt = await requestLoginLink(
      pool,
      mailer,
      "fremd@example.com",
      NOW,
    );

    expect(unbekannt).toEqual(bekannt);
    expect(mailer.sent.map((message) => message.to)).toEqual([
      PARTICIPANT_EMAIL,
    ]);
  });

  it("nimmt das gemerkte Ziel in den Link auf", async () => {
    const pool = createTestDb();
    const mailer = recordingMailer();
    vi.stubEnv("APP_URL", "https://dev.wegfara.com");

    await requestLoginLink(pool, mailer, PARTICIPANT_EMAIL, NOW, "/go");

    expect(mailer.sent[0].text).toContain("&weiter=%2Fgo");
  });

  it("nimmt kein fremdes Ziel in den Link auf", async () => {
    const pool = createTestDb();
    const mailer = recordingMailer();
    vi.stubEnv("APP_URL", "https://dev.wegfara.com");

    await requestLoginLink(
      pool,
      mailer,
      PARTICIPANT_EMAIL,
      NOW,
      "//fremde-seite.example",
    );

    expect(mailer.sent[0].text).not.toContain("weiter=");
  });

  it("verschickt nichts an eine unsinnige Adresse", async () => {
    const pool = createTestDb();
    const mailer = recordingMailer();

    await requestLoginLink(pool, mailer, "keine-adresse", NOW);

    expect(mailer.sent).toHaveLength(0);
  });
});

describe("redeemLoginLink", () => {
  it("meldet an, wer den Link aufruft (req-016)", async () => {
    const pool = createTestDb();
    const mailer = recordingMailer();
    await requestLoginLink(pool, mailer, PARTICIPANT_EMAIL, NOW);

    const result = await redeemLoginLink(
      pool,
      tokenFrom(mailer.sent[0]),
      minutesLater(1),
    );

    expect(result?.session.participant.email).toBe(PARTICIPANT_EMAIL);
    expect(
      await findSessionByToken(pool, result!.token, minutesLater(1)),
    ).not.toBeNull();
  });

  it("meldet beim zweiten Aufruf desselben Links niemanden an (req-016)", async () => {
    const pool = createTestDb();
    const mailer = recordingMailer();
    await requestLoginLink(pool, mailer, PARTICIPANT_EMAIL, NOW);
    const token = tokenFrom(mailer.sent[0]);
    await redeemLoginLink(pool, token, minutesLater(1));

    expect(await redeemLoginLink(pool, token, minutesLater(2))).toBeNull();
  });

  it("meldet nach 15 Minuten niemanden mehr an (req-016)", async () => {
    const pool = createTestDb();
    const mailer = recordingMailer();
    await requestLoginLink(pool, mailer, PARTICIPANT_EMAIL, NOW);

    expect(
      await redeemLoginLink(pool, tokenFrom(mailer.sent[0]), minutesLater(16)),
    ).toBeNull();
  });

  it("meldet mit einem erfundenen Token niemanden an", async () => {
    const pool = createTestDb();

    expect(await redeemLoginLink(pool, "ausgedacht", NOW)).toBeNull();
  });

  it("zeigt bei der ersten Anmeldung acht Notfallcodes (req-016)", async () => {
    const pool = createTestDb();
    const mailer = recordingMailer();
    await requestLoginLink(pool, mailer, PARTICIPANT_EMAIL, NOW);

    const result = await redeemLoginLink(
      pool,
      tokenFrom(mailer.sent[0]),
      minutesLater(1),
    );

    expect(result?.recoveryCodes).toHaveLength(8);
  });

  it("zeigt die Notfallcodes bei jeder weiteren Anmeldung nicht erneut (req-016)", async () => {
    const pool = createTestDb();
    const mailer = recordingMailer();
    await requestLoginLink(pool, mailer, PARTICIPANT_EMAIL, NOW);
    await redeemLoginLink(pool, tokenFrom(mailer.sent[0]), minutesLater(1));

    await requestLoginLink(pool, mailer, PARTICIPANT_EMAIL, minutesLater(2));
    const zweite = await redeemLoginLink(
      pool,
      tokenFrom(mailer.sent[1]),
      minutesLater(3),
    );

    expect(zweite?.recoveryCodes).toBeNull();
  });
});

describe("loginWithRecoveryCode", () => {
  async function ersteAnmeldung() {
    const pool = createTestDb();
    const mailer = recordingMailer();
    await requestLoginLink(pool, mailer, PARTICIPANT_EMAIL, NOW);
    const result = await redeemLoginLink(
      pool,
      tokenFrom(mailer.sent[0]),
      minutesLater(1),
    );
    return { pool, codes: result!.recoveryCodes! };
  }

  it("meldet mit einem notierten Notfallcode an (req-016)", async () => {
    const { pool, codes } = await ersteAnmeldung();

    const result = await loginWithRecoveryCode(
      pool,
      PARTICIPANT_EMAIL,
      codes[0],
      minutesLater(2),
    );

    expect(result?.session.participant.id).toBe(PARTICIPANT_ID);
  });

  it("meldet mit demselben Code kein zweites Mal an (req-016)", async () => {
    const { pool, codes } = await ersteAnmeldung();
    await loginWithRecoveryCode(
      pool,
      PARTICIPANT_EMAIL,
      codes[0],
      minutesLater(2),
    );

    expect(
      await loginWithRecoveryCode(
        pool,
        PARTICIPANT_EMAIL,
        codes[0],
        minutesLater(3),
      ),
    ).toBeNull();
  });

  it("verbraucht mit einer Anmeldung genau einen Code", async () => {
    const { pool, codes } = await ersteAnmeldung();

    await loginWithRecoveryCode(
      pool,
      PARTICIPANT_EMAIL,
      codes[0],
      minutesLater(2),
    );

    expect(await countUnusedRecoveryCodes(pool, PARTICIPANT_ID)).toBe(7);
  });

  it("erzeugt beim Anmelden per Notfallcode keinen neuen Satz", async () => {
    const { pool, codes } = await ersteAnmeldung();

    const result = await loginWithRecoveryCode(
      pool,
      PARTICIPANT_EMAIL,
      codes[0],
      minutesLater(2),
    );

    expect(result?.recoveryCodes).toBeNull();
  });

  it("meldet mit einem erfundenen Code niemanden an", async () => {
    const { pool } = await ersteAnmeldung();

    expect(
      await loginWithRecoveryCode(
        pool,
        PARTICIPANT_EMAIL,
        "AAAA-BBBB-CCCC",
        minutesLater(2),
      ),
    ).toBeNull();
  });

  it("meldet mit einer unbekannten Adresse niemanden an", async () => {
    const { pool, codes } = await ersteAnmeldung();

    expect(
      await loginWithRecoveryCode(
        pool,
        "fremd@example.com",
        codes[0],
        minutesLater(2),
      ),
    ).toBeNull();
  });
});

describe("createRecoveryCodeSet", () => {
  it("ersetzt den alten Satz durch einen neuen (req-016)", async () => {
    const pool = createTestDb();
    const alt = await createRecoveryCodeSet(pool, PARTICIPANT_ID, NOW);

    const neu = await createRecoveryCodeSet(pool, PARTICIPANT_ID, NOW);

    expect(neu).toHaveLength(8);
    expect(
      await loginWithRecoveryCode(pool, PARTICIPANT_EMAIL, alt[0], NOW),
    ).toBeNull();
    expect(
      await loginWithRecoveryCode(pool, PARTICIPANT_EMAIL, neu[0], NOW),
    ).not.toBeNull();
  });
});

describe("beginSession", () => {
  it("erzeugt den Satz Notfallcodes nur beim allerersten Mal (req-016)", async () => {
    const pool = createTestDb();
    const participant = (await findParticipantByEmail(
      pool,
      PARTICIPANT_EMAIL,
    ))!;

    const erste = await beginSession(pool, participant, NOW);
    const zweite = await beginSession(pool, participant, minutesLater(1));

    expect(erste.recoveryCodes).toHaveLength(8);
    expect(zweite.recoveryCodes).toBeNull();
  });
});

describe("logout", () => {
  it("beendet die Sitzung sofort (req-016)", async () => {
    const pool = createTestDb();
    const participant = (await findParticipantByEmail(
      pool,
      PARTICIPANT_EMAIL,
    ))!;
    const { token } = await beginSession(pool, participant, NOW);

    await logout(pool, token);

    expect(await findSessionByToken(pool, token, minutesLater(1))).toBeNull();
  });
});
