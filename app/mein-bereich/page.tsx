import { Figtree, Playfair_Display } from "next/font/google";
import { getPool } from "@/lib/db/pool";
import { requireSession } from "@/lib/auth/current-session";
import { listCredentials } from "@/lib/db/credentials";
import { formatDeviceMoment } from "@/lib/auth/devices";
import { countUnusedRecoveryCodes } from "@/lib/db/recovery-codes";
import { leadsAnyTrip } from "@/lib/db/trip-participants";
import { listParticipants } from "@/lib/db/participants";
import { listAccountUsers, listOpenInvitations } from "@/lib/db/account-users";
import { accountApiKeyStates } from "@/lib/api-keys/account-keys";
import { MeinBereichView } from "./mein-bereich-view";

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

/**
 * "Mein Bereich" (req-043): alles zu mir und meinem Account an einer
 * Stelle. Die Seite liegt ausserhalb von /plan und /go, weil beide Bereiche
 * sie brauchen -- der Passkey wird meist auf dem Smartphone eingerichtet.
 *
 * Was dem ganzen Account gehoert -- Personen, Einladungen und
 * Zugangsschluessel -- wird nur fuer einen Bereichs-Admin ueberhaupt
 * geladen (req-043). Der Mandant ergibt sich aus der Sitzung, nie aus der
 * Anfrage (req-024, req-025).
 */
export default async function MeinBereichPage() {
  const session = await requireSession();
  const db = getPool();
  const accountId = session.accountId;
  const now = new Date();

  // Notfallcodes gibt es nur fuer Reiseleiter (req-023): Teilnehmer haben
  // immer jemanden, der sie mit einer neuen Einladung wieder hereinholt.
  const [passkeys, offeneNotfallcodes, reiseleiter] = await Promise.all([
    listCredentials(db, session.participant.id),
    countUnusedRecoveryCodes(db, session.participant.id),
    leadsAnyTrip(db, session.participant.id),
  ]);

  const [participants, users, invitations, apiKeys] = session.accountAdmin
    ? await Promise.all([
        listParticipants(db, accountId),
        listAccountUsers(db, accountId),
        listOpenInvitations(db, accountId, now),
        // Nur der Zustand der Zugangsschluessel, nie die Schluessel selbst
        // (req-028).
        accountApiKeyStates(db, accountId),
      ])
    : [[], [], [], []];

  return (
    <div className={`${playfairDisplay.variable} ${figtree.variable}`}>
      <MeinBereichView
        email={session.participant.email}
        // Die Zeitpunkte werden hier formatiert und als fertiger Text
        // weitergereicht (req-037): die Seite wird auch serverseitig
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
        accountAdmin={session.accountAdmin}
        participants={participants}
        selfParticipantId={session.participant.id}
        users={users}
        invitations={invitations}
        apiKeys={apiKeys}
      />
    </div>
  );
}
