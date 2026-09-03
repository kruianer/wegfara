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
  redeemAccessLink,
  redeemLoginLink,
  requestLoginLink,
} from "./login";
import {
  createParticipant,
  findParticipantByEmail,
  findParticipantById,
} from "../db/participants";
import { createAccessLink } from "../db/access-links";
import { assignTripParticipant } from "../db/trip-participants";
import type { Participant } from "../participants/types";
import { ACCOUNT_ID } from "../account";

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

const SUEDITALIEN_ID = "d5fda5ea-65e7-4b47-8096-62618599a288";

/**
 * Clara Berger -- eine Mitreisende ohne E-Mail-Adresse, der Reise als
 * Teilnehmerin zugeordnet (req-023).
 */
async function claraInSueditalien(
  pool: ReturnType<typeof createTestDb>,
): Promise<Participant> {
  const clara = await createParticipant(
    pool,
    ACCOUNT_ID,
    {
      name: "Clara Berger",
      nickname: null,
      email: null,
      phone: null,
      iban: null,
    },
    NOW,
  );
  await assignTripParticipant(
    pool,
    ACCOUNT_ID,
    SUEDITALIEN_ID,
    clara.id,
    "teilnehmer",
  );
  return clara;
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

  it("verschickt nichts an eine erfasste Person ohne Zugang (req-019)", async () => {
    const pool = createTestDb();
    const mailer = recordingMailer();
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

    await requestLoginLink(pool, mailer, "clara@example.com", NOW);

    expect(mailer.sent).toEqual([]);
    expect(clara.loginEnabled).toBe(false);
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

  // req-023: Teilnehmer bekommen keine Notfallcodes -- sie haben immer
  // jemanden, der sie mit einer neuen Einladung wieder hereinholt.
  it("erzeugt fuer einen Teilnehmer keine Notfallcodes (req-023)", async () => {
    const pool = createTestDb();
    const clara = await claraInSueditalien(pool);

    const ergebnis = await beginSession(pool, clara, NOW);

    expect(ergebnis.recoveryCodes).toBeNull();
    expect(await countUnusedRecoveryCodes(pool, clara.id)).toBe(0);
  });
});

describe("redeemAccessLink (req-023)", () => {
  it("meldet als genau die eingeladene Person an", async () => {
    const pool = createTestDb();
    const clara = await claraInSueditalien(pool);
    await createAccessLink(pool, clara.id, "zugang-1", NOW);

    const ergebnis = await redeemAccessLink(pool, "zugang-1", NOW);

    expect(ergebnis?.session.participant.id).toBe(clara.id);
    expect(ergebnis?.session.participant.name).toBe("Clara Berger");
  });

  it("gibt der Person damit Zugang -- auch ohne E-Mail-Adresse", async () => {
    const pool = createTestDb();
    const clara = await claraInSueditalien(pool);
    expect(clara.email).toBeNull();
    await createAccessLink(pool, clara.id, "zugang-1", NOW);

    await redeemAccessLink(pool, "zugang-1", NOW);

    expect((await findParticipantById(pool, clara.id))?.loginEnabled).toBe(
      true,
    );
  });

  it("meldet beim zweiten Aufruf desselben Links niemanden an", async () => {
    const pool = createTestDb();
    const clara = await claraInSueditalien(pool);
    await createAccessLink(pool, clara.id, "zugang-1", NOW);
    await redeemAccessLink(pool, "zugang-1", NOW);

    expect(await redeemAccessLink(pool, "zugang-1", NOW)).toBeNull();
  });

  it("meldet mit einem erfundenen Token niemanden an", async () => {
    const pool = createTestDb();

    expect(await redeemAccessLink(pool, "ausgedacht", NOW)).toBeNull();
  });

  // req-023: niemand bleibt dauerhaft ausgesperrt. Wer seinen Passkey
  // verloren hat, bekommt vom Reiseleiter einen neuen Zugangslink.
  it("holt mit einer neuen Einladung zurueck, wer ausgesperrt ist", async () => {
    const pool = createTestDb();
    const clara = await claraInSueditalien(pool);
    await createAccessLink(pool, clara.id, "zugang-1", NOW);
    await redeemAccessLink(pool, "zugang-1", NOW);

    await createAccessLink(pool, clara.id, "zugang-2", NOW);
    const zweite = await redeemAccessLink(pool, "zugang-2", NOW);

    expect(zweite?.session.participant.id).toBe(clara.id);
  });

  // req-023: der Anmeldelink an die hinterlegte Adresse ist der Weg fuer
  // Geraete ohne Passkey.
  it("erlaubt danach den Anmeldelink an die hinterlegte Adresse", async () => {
    const pool = createTestDb();
    vi.stubEnv("APP_URL", "https://dev.wegfara.com");
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
    await createAccessLink(pool, clara.id, "zugang-1", NOW);
    await redeemAccessLink(pool, "zugang-1", NOW);
    const mailer = recordingMailer();

    await requestLoginLink(pool, mailer, "clara@example.com", NOW);

    expect(mailer.sent).toHaveLength(1);
    expect(mailer.sent[0].to).toBe("clara@example.com");
  });

  // req-023: ohne hinterlegte Adresse steht dieser Weg nicht zur Verfuegung.
  it("laesst ohne hinterlegte Adresse keinen Anmeldelink zu", async () => {
    const pool = createTestDb();
    const max = await claraInSueditalien(pool);
    await createAccessLink(pool, max.id, "zugang-1", NOW);
    await redeemAccessLink(pool, "zugang-1", NOW);
    const mailer = recordingMailer();

    await requestLoginLink(pool, mailer, "max@example.com", NOW);

    expect(mailer.sent).toEqual([]);
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
