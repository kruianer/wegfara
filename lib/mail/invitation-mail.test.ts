// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  INVITATION_SUBJECT,
  invitationMail,
  invitationSubject,
} from "./invitation-mail";

const URL_MIT_TOKEN = "https://dev.wegfara.com/einladung?token=abc123";

describe("invitationMail (req-038)", () => {
  it("richtet sich an die eingeladene Adresse", () => {
    expect(
      invitationMail("eva@example.com", "Eva Huber", URL_MIT_TOKEN).to,
    ).toBe("eva@example.com");
  });

  it("enthaelt den Zugangslink in beiden Fassungen", () => {
    const mail = invitationMail("eva@example.com", "Eva", URL_MIT_TOKEN);

    expect(mail.text).toContain(URL_MIT_TOKEN);
    expect(mail.html).toContain(`href="${URL_MIT_TOKEN}"`);
  });

  it("nennt die Gueltigkeit von sieben Tagen (req-023)", () => {
    const mail = invitationMail("eva@example.com", "Eva", URL_MIT_TOKEN);

    expect(mail.text).toContain("7 Tage");
    expect(mail.html).toContain("7 Tage");
  });

  it("gibt ausser dem Zugang nichts preis", () => {
    const mail = invitationMail("eva@example.com", "Eva", URL_MIT_TOKEN);

    expect(mail.text).not.toMatch(/Reise|Süditalien|Ausgabe/);
  });

  it("maskiert Sonderzeichen in der HTML-Fassung", () => {
    const mail = invitationMail(
      "eva@example.com",
      '<script>alert("x")</script>',
      'https://x/einladung?token=a"><script>',
    );

    expect(mail.html).not.toContain("<script>");
    expect(mail.html).toContain("&lt;script&gt;");
  });

  it("nennt die Umgebung im Betreff, damit eine dev-Mail auffaellt", () => {
    expect(invitationSubject("dev")).toBe(`[dev] ${INVITATION_SUBJECT}`);
    expect(invitationSubject(null)).toBe(INVITATION_SUBJECT);
    expect(
      invitationMail("eva@example.com", "Eva", URL_MIT_TOKEN, "dev").subject,
    ).toBe(`[dev] ${INVITATION_SUBJECT}`);
  });
});
