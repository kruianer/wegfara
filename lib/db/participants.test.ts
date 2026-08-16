// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  PARTICIPANT_EMAIL,
  PARTICIPANT_ID,
  createTestDb,
} from "../../tests/test-db";
import { ACCOUNT_ID } from "../account";
import { findParticipantByEmail, findParticipantById } from "./participants";

describe("findParticipantByEmail", () => {
  it("findet das Konto des Betreibers (req-016)", async () => {
    const pool = createTestDb();

    const participant = await findParticipantByEmail(pool, PARTICIPANT_EMAIL);

    expect(participant).toEqual({
      id: PARTICIPANT_ID,
      accountId: ACCOUNT_ID,
      name: "Uwe Kremmel",
      email: PARTICIPANT_EMAIL,
    });
  });

  it("findet das Konto unabhaengig von der Schreibweise", async () => {
    const pool = createTestDb();

    const participant = await findParticipantByEmail(pool, " Uwe@Kremmel.ORG ");

    expect(participant?.id).toBe(PARTICIPANT_ID);
  });

  it("liefert null fuer eine unbekannte Adresse", async () => {
    const pool = createTestDb();

    expect(await findParticipantByEmail(pool, "fremd@example.com")).toBeNull();
  });
});

describe("findParticipantById", () => {
  it("liefert den Mandanten mit, an dem die Reisedaten haengen", async () => {
    const pool = createTestDb();

    const participant = await findParticipantById(pool, PARTICIPANT_ID);

    expect(participant?.accountId).toBe(ACCOUNT_ID);
  });

  it("liefert null fuer eine unbekannte Id", async () => {
    const pool = createTestDb();

    expect(
      await findParticipantById(pool, "00000000-0000-0000-0000-000000000000"),
    ).toBeNull();
  });
});
