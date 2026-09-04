import { getPool } from "@/lib/db/pool";
import { requestLoginLink } from "@/lib/auth/login";
import { normalizeEmail } from "@/lib/auth/email";
import {
  LOGIN_LINK_MAX_ATTEMPTS,
  LOGIN_LINK_WINDOW_MS,
  createRateLimiter,
} from "@/lib/auth/rate-limit";
import { LOGIN_LINK_NOTICE } from "@/lib/auth/messages";
import { smtpMailer } from "@/lib/mail/smtp-mailer";

export const dynamic = "force-dynamic";

/**
 * Ohne Anmeldung erreichbar und versendet Mails -- deshalb gebremst. Drei
 * Anfragen je Adresse in einer Stunde reichen fuer jeden ehrlichen Gebrauch
 * (req-037).
 */
const limiter = createRateLimiter(
  LOGIN_LINK_MAX_ATTEMPTS,
  LOGIN_LINK_WINDOW_MS,
);

export async function POST(request: Request) {
  let email = "";
  let weiter = "";
  try {
    const body = (await request.json()) as {
      email?: unknown;
      weiter?: unknown;
    };
    if (typeof body.email === "string") email = body.email;
    if (typeof body.weiter === "string") weiter = body.weiter;
  } catch {
    email = "";
  }

  const now = new Date();
  if (limiter.allow(normalizeEmail(email), now)) {
    await requestLoginLink(getPool(), smtpMailer, email, now, weiter);
  }

  // Immer dieselbe Antwort — auch bei unbekannter Adresse und auch dann,
  // wenn die Bremse gegriffen hat (req-016).
  return Response.json({ notice: LOGIN_LINK_NOTICE });
}
