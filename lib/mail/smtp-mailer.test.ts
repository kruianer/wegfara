// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import type { Transporter } from "nodemailer";
import {
  createSmtpMailer,
  createSmtpTransport,
  smtpSettingsFromEnv,
  type SmtpSettings,
} from "./smtp-mailer";

const VOLLSTAENDIG = {
  SMTP_HOST: "smtp.all-inkl.com",
  SMTP_PORT: "587",
  SMTP_USER: "post@wegfara.com",
  SMTP_PASSWORD: "geheim",
  SMTP_FROM: "Wegfara <post@wegfara.com>",
};

const SETTINGS: SmtpSettings = {
  host: "smtp.all-inkl.com",
  port: 587,
  user: "post@wegfara.com",
  password: "geheim",
  from: "Wegfara <post@wegfara.com>",
};

const NACHRICHT = {
  to: "uwe@kremmel.org",
  subject: "Betreff",
  text: "Text",
  html: "<p>Text</p>",
};

/** Ein Transport, der nichts versendet, aber alles mitschreibt. */
function fakeTransport() {
  const sendMail = vi.fn(async () => ({}));
  return { transport: { sendMail } as unknown as Transporter, sendMail };
}

describe("smtpSettingsFromEnv", () => {
  it("liest die Zugangsdaten aus der Umgebung (req-016)", () => {
    expect(smtpSettingsFromEnv(VOLLSTAENDIG)).toEqual(SETTINGS);
  });

  it("faellt ohne Portangabe auf 587 zurueck", () => {
    const ohnePort: Record<string, string | undefined> = {
      ...VOLLSTAENDIG,
      SMTP_PORT: undefined,
    };

    expect(smtpSettingsFromEnv(ohnePort)?.port).toBe(587);
  });

  it.each(["SMTP_HOST", "SMTP_USER", "SMTP_PASSWORD", "SMTP_FROM"])(
    "liefert null, wenn %s fehlt",
    (key) => {
      const unvollstaendig = { ...VOLLSTAENDIG, [key]: "" };

      expect(smtpSettingsFromEnv(unvollstaendig)).toBeNull();
    },
  );
});

describe("createSmtpTransport", () => {
  it("verschluesselt auf 465 von Anfang an", () => {
    const transport = createSmtpTransport({ ...SETTINGS, port: 465 });

    expect(transport.options).toMatchObject({ port: 465, secure: true });
  });

  it("erzwingt auf 587 die Hochstufung per STARTTLS", () => {
    const transport = createSmtpTransport(SETTINGS);

    expect(transport.options).toMatchObject({
      port: 587,
      secure: false,
      requireTLS: true,
    });
  });
});

describe("createSmtpMailer", () => {
  it("versendet mit der hinterlegten Absenderadresse", async () => {
    const { transport, sendMail } = fakeTransport();
    const mailer = createSmtpMailer(
      () => SETTINGS,
      () => transport,
    );

    expect(await mailer.send(NACHRICHT)).toBe(true);
    expect(sendMail).toHaveBeenCalledWith({
      from: SETTINGS.from,
      ...NACHRICHT,
    });
  });

  it("verwendet dieselbe Verbindung erneut", async () => {
    const { transport } = fakeTransport();
    const transportFactory = vi.fn(() => transport);
    const mailer = createSmtpMailer(() => SETTINGS, transportFactory);

    await mailer.send(NACHRICHT);
    await mailer.send(NACHRICHT);

    expect(transportFactory).toHaveBeenCalledTimes(1);
  });

  it("versendet nichts, solange SMTP nicht konfiguriert ist", async () => {
    const { transport, sendMail } = fakeTransport();
    const mailer = createSmtpMailer(
      () => null,
      () => transport,
    );
    const fehler = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(await mailer.send(NACHRICHT)).toBe(false);
    expect(sendMail).not.toHaveBeenCalled();
    fehler.mockRestore();
  });

  it("meldet einen gescheiterten Versand, ohne zu werfen", async () => {
    const transport = {
      sendMail: vi.fn(async () => {
        throw new Error("Postfach nicht erreichbar");
      }),
    } as unknown as Transporter;
    const mailer = createSmtpMailer(
      () => SETTINGS,
      () => transport,
    );
    const fehler = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(await mailer.send(NACHRICHT)).toBe(false);
    fehler.mockRestore();
  });
});
