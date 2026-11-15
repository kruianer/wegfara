import { figtree, playfairDisplay } from "@/lib/schriften";
import { requireSession } from "@/lib/auth/current-session";
import { participantDisplayName } from "@/lib/participants/display-name";
import { EinladungPasskeyView } from "./einladung-passkey-view";

// Haengt an der Sitzung des Aufrufers — nie statisch vorrendern.
export const dynamic = "force-dynamic";

/**
 * Direkt nach dem Einloesen der Einladung (req-023). Bewusst mit
 * requireSession statt requireTripAccess: die eingeladene Person soll ihren
 * Passkey auch dann einrichten koennen, wenn ihre Reise noch auf "In
 * Planung" steht.
 */
export default async function EinladungPasskeyPage() {
  const session = await requireSession();

  return (
    <div className={`${playfairDisplay.variable} ${figtree.variable}`}>
      <EinladungPasskeyView
        name={participantDisplayName(session.participant)}
        hatEmail={session.participant.email !== null}
      />
    </div>
  );
}
