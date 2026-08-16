import { Figtree, Playfair_Display } from "next/font/google";
import { getPool } from "@/lib/db/pool";
import { requireSession } from "@/lib/auth/current-session";
import { listCredentials } from "@/lib/db/credentials";
import { countUnusedRecoveryCodes } from "@/lib/db/recovery-codes";
import { KontoView } from "./konto-view";

// Haengt an der Sitzung des Aufrufers — nie statisch vorrendern.
export const dynamic = "force-dynamic";

const playfairDisplay = Playfair_Display({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-heading",
});

const figtree = Figtree({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-body",
});

export default async function KontoPage() {
  const session = await requireSession();
  const db = getPool();
  const [passkeys, offeneNotfallcodes] = await Promise.all([
    listCredentials(db, session.participant.id),
    countUnusedRecoveryCodes(db, session.participant.id),
  ]);

  return (
    <div className={`${playfairDisplay.variable} ${figtree.variable}`}>
      <KontoView
        email={session.participant.email}
        passkeys={passkeys.map((passkey) => ({
          id: passkey.id,
          label: passkey.label,
        }))}
        offeneNotfallcodes={offeneNotfallcodes}
      />
    </div>
  );
}
