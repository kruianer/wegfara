import { getPool } from "@/lib/db/pool";
import { currentSession } from "@/lib/auth/current-session";
import { unauthorized, forbidden } from "@/lib/auth/api-guard";
import { createAccountWithFirstPerson } from "@/lib/accounts/create-account";
import {
  ACCOUNT_ERRORS,
  toAccountInput,
  validateAccountDraft,
  type AccountDraft,
  type AccountFieldErrors,
} from "@/lib/accounts/validate";

export const dynamic = "force-dynamic";

/**
 * Legt einen Account samt seiner ersten Person an (req-025). Ein Account
 * entsteht ausschliesslich durch den Gesamt-Admin -- eine
 * Selbstregistrierung gibt es nicht. Ohne angemeldete Person wird der
 * Zugriff zurueckgewiesen, ohne die Kennzeichnung ebenfalls.
 *
 * Die Pruefung der Eingaben liegt in lib/accounts/validate.ts und ist damit
 * dieselbe wie in der Oberflaeche: ein Aufruf an ihr vorbei kann keinen
 * unzulaessigen Account anlegen.
 */

function textOf(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(request: Request) {
  const session = await currentSession();
  if (!session) return unauthorized();
  if (!session.superAdmin) return forbidden();

  let body: Record<string, unknown>;
  try {
    const parsed = await request.json();
    if (typeof parsed !== "object" || parsed === null) {
      return Response.json({ error: "invalid body" }, { status: 400 });
    }
    body = parsed as Record<string, unknown>;
  } catch {
    return Response.json({ error: "invalid body" }, { status: 400 });
  }

  const draft: AccountDraft = {
    name: textOf(body.name),
    personName: textOf(body.personName),
    personEmail: textOf(body.personEmail),
  };

  const errors = validateAccountDraft(draft);
  if (Object.keys(errors).length > 0) {
    return Response.json({ errors }, { status: 400 });
  }

  const account = await createAccountWithFirstPerson(
    getPool(),
    toAccountInput(draft),
    new Date(),
  );
  if (!account) {
    const taken: AccountFieldErrors = {
      personEmail: ACCOUNT_ERRORS.emailTaken,
    };
    return Response.json({ errors: taken }, { status: 400 });
  }

  return Response.json({ account }, { status: 201 });
}
