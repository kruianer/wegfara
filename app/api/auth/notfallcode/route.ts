import { NextResponse } from "next/server";
import { getPool } from "@/lib/db/pool";
import { loginWithRecoveryCode } from "@/lib/auth/login";
import { connectionIsSecure } from "@/lib/auth/cookies";
import {
  writeRecoveryCookie,
  writeSessionCookie,
} from "@/lib/auth/cookie-store";
import { normalizeEmail } from "@/lib/auth/email";
import { createRateLimiter } from "@/lib/auth/rate-limit";
import { safeRedirectTarget } from "@/lib/auth/redirect-target";
import { LOGIN_FAILED_NOTICE } from "@/lib/auth/messages";
import { RECOVERY_CODES_PATH } from "@/lib/auth/paths";

export const dynamic = "force-dynamic";

/** Bremst das Durchprobieren von Notfallcodes. */
const limiter = createRateLimiter(10, 15 * 60 * 1000);

export async function POST(request: Request) {
  let email = "";
  let code = "";
  let weiter = "";
  try {
    const body = (await request.json()) as {
      email?: unknown;
      code?: unknown;
      weiter?: unknown;
    };
    if (typeof body.email === "string") email = body.email;
    if (typeof body.code === "string") code = body.code;
    if (typeof body.weiter === "string") weiter = body.weiter;
  } catch {
    // Eine unlesbare Anfrage wird wie ein Fehlversuch behandelt.
  }

  const now = new Date();
  const target = safeRedirectTarget(weiter);

  const result = limiter.allow(normalizeEmail(email), now)
    ? await loginWithRecoveryCode(getPool(), email, code, now)
    : null;

  if (!result) {
    return NextResponse.json({ error: LOGIN_FAILED_NOTICE }, { status: 401 });
  }

  const secure = connectionIsSecure(
    request.headers.get("x-forwarded-proto"),
    request.url,
  );
  const response = NextResponse.json({
    weiter: result.recoveryCodes
      ? `${RECOVERY_CODES_PATH}?weiter=${encodeURIComponent(target)}`
      : target,
  });
  writeSessionCookie(response, result.token, secure);
  if (result.recoveryCodes) {
    writeRecoveryCookie(response, result.recoveryCodes, secure);
  }
  return response;
}
