// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  LOGIN_LINK_SUBJECT,
  loginLinkMail,
  loginLinkSubject,
} from "./login-link-mail";

const URL_MIT_TOKEN = "https://dev.wegfara.com/anmeldung/link?token=abc123";

describe("loginLinkMail", () => {
  it("richtet sich an die angefragte Adresse", () => {
    expect(loginLinkMail("uwe@kremmel.org", URL_MIT_TOKEN).to).toBe(
      "uwe@kremmel.org",
    );
  });

  it("traegt einen erkennbaren Betreff", () => {
    expect(loginLinkMail("uwe@kremmel.org", URL_MIT_TOKEN).subject).toBe(
      LOGIN_LINK_SUBJECT,
    );
  });

  it("enthaelt den Anmeldelink in beiden Fassungen", () => {
    const mail = loginLinkMail("uwe@kremmel.org", URL_MIT_TOKEN);

    expect(mail.text).toContain(URL_MIT_TOKEN);
    expect(mail.html).toContain(`href="${URL_MIT_TOKEN}"`);
  });

  it("nennt die Gueltigkeit von 15 Minuten (req-016)", () => {
    const mail = loginLinkMail("uwe@kremmel.org", URL_MIT_TOKEN);

    expect(mail.text).toContain("15 Minuten");
    expect(mail.html).toContain("15 Minuten");
  });

  it("gibt ausser der Anmeldung nichts preis", () => {
    const mail = loginLinkMail("uwe@kremmel.org", URL_MIT_TOKEN);

    expect(mail.text).not.toMatch(/Reise|Kremmel/);
  });

  it("maskiert Sonderzeichen in der HTML-Fassung", () => {
    const mail = loginLinkMail(
      "uwe@kremmel.org",
      'https://x/anmeldung/link?token=a"><script>',
    );

    expect(mail.html).not.toContain("<script>");
    expect(mail.html).toContain("&lt;script&gt;");
  });
});

describe("loginLinkSubject (req-037)", () => {
  it("nennt die Umgebung, damit eine dev-Mail auffaellt", () => {
    // Beide Umgebungen verschicken unter derselben Absenderadresse.
    expect(loginLinkSubject("dev")).toBe(`[dev] ${LOGIN_LINK_SUBJECT}`);
  });

  it("laesst prod ohne Zusatz", () => {
    expect(loginLinkSubject(null)).toBe(LOGIN_LINK_SUBJECT);
  });

  it("traegt den Zusatz auch in der fertigen Nachricht", () => {
    expect(loginLinkMail("uwe@kremmel.org", URL_MIT_TOKEN, "dev").subject).toBe(
      `[dev] ${LOGIN_LINK_SUBJECT}`,
    );
  });
});
