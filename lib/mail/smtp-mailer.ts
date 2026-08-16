import nodemailer, { type Transporter } from "nodemailer";
import type { Mailer, MailMessage } from "./mailer";

/**
 * Zugangsdaten des SMTP-Postfachs bei All-Inkl. Sie liegen ausschliesslich
 * in den Umgebungsvariablen der jeweiligen Umgebung, nie im Repo (siehe
 * Constraints in req-016).
 */
export interface SmtpSettings {
  host: string;
  port: number;
  user: string;
  password: string;
  from: string;
}

const DEFAULT_PORT = 587;

/** Liest die Einstellungen aus der Umgebung; null, wenn sie unvollstaendig sind. */
export function smtpSettingsFromEnv(
  env: Record<string, string | undefined> = process.env,
): SmtpSettings | null {
  const host = env.SMTP_HOST?.trim();
  const user = env.SMTP_USER?.trim();
  const password = env.SMTP_PASSWORD;
  const from = env.SMTP_FROM?.trim();
  if (!host || !user || !password || !from) return null;

  const port = Number(env.SMTP_PORT ?? DEFAULT_PORT);
  return {
    host,
    port: Number.isFinite(port) && port > 0 ? port : DEFAULT_PORT,
    user,
    password,
    from,
  };
}

/**
 * Port 465 ist von Anfang an verschluesselt; auf 587 wird die Verbindung
 * per STARTTLS hochgestuft. Unverschluesselt wird nie versandt.
 */
export function createSmtpTransport(settings: SmtpSettings): Transporter {
  return nodemailer.createTransport({
    host: settings.host,
    port: settings.port,
    secure: settings.port === 465,
    requireTLS: settings.port !== 465,
    auth: { user: settings.user, pass: settings.password },
  });
}

export function createSmtpMailer(
  settingsSource: () => SmtpSettings | null = smtpSettingsFromEnv,
  transportFactory: (
    settings: SmtpSettings,
  ) => Transporter = createSmtpTransport,
): Mailer {
  let transport: Transporter | undefined;
  let transportKey: string | undefined;

  return {
    async send(message: MailMessage): Promise<boolean> {
      const settings = settingsSource();
      if (!settings) {
        console.error("SMTP ist nicht konfiguriert — keine Mail versandt.");
        return false;
      }
      try {
        // Die Verbindung wird wiederverwendet, solange sich die
        // Einstellungen nicht geaendert haben.
        const key = JSON.stringify(settings);
        if (!transport || transportKey !== key) {
          transport = transportFactory(settings);
          transportKey = key;
        }
        await transport.sendMail({
          from: settings.from,
          to: message.to,
          subject: message.subject,
          text: message.text,
          html: message.html,
        });
        return true;
      } catch (error) {
        // Der Grund gehoert ins Log, nie in die Antwort an den Browser:
        // sie darf nicht verraten, ob es die Adresse gibt (req-016).
        console.error("Mailversand fehlgeschlagen", error);
        return false;
      }
    },
  };
}

export const smtpMailer: Mailer = createSmtpMailer();
