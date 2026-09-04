import { Figtree, Playfair_Display } from "next/font/google";
import { getPool } from "@/lib/db/pool";
import { requireSession } from "@/lib/auth/current-session";
import { listCredentials } from "@/lib/db/credentials";
import { formatDeviceMoment } from "@/lib/auth/devices";
import { countUnusedRecoveryCodes } from "@/lib/db/recovery-codes";
import { leadsAnyTrip } from "@/lib/db/trip-participants";
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
  // Notfallcodes gibt es nur fuer Reiseleiter (req-023): Teilnehmer haben
  // immer jemanden, der sie mit einer neuen Einladung wieder hereinholt.
  const [passkeys, offeneNotfallcodes, reiseleiter] = await Promise.all([
    listCredentials(db, session.participant.id),
    countUnusedRecoveryCodes(db, session.participant.id),
    leadsAnyTrip(db, session.participant.id),
  ]);

  return (
    <div className={`${playfairDisplay.variable} ${figtree.variable}`}>
      <KontoView
        email={session.participant.email}
        // Die Zeitpunkte werden hier formatiert und als fertiger Text
        // weitergereicht (req-037): die Kontoseite wird auch serverseitig
        // gerendert, und eine im Browser gebildete Ortszeit koennte davon
        // abweichen.
        passkeys={passkeys.map((passkey) => ({
          id: passkey.id,
          label: passkey.label,
          hinzugefuegtAm: formatDeviceMoment(passkey.createdAt),
          zuletztVerwendet: passkey.lastUsedAt
            ? formatDeviceMoment(passkey.lastUsedAt)
            : null,
        }))}
        offeneNotfallcodes={offeneNotfallcodes}
        notfallcodesVerfuegbar={reiseleiter}
      />
    </div>
  );
}
