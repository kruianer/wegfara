import { Figtree, Playfair_Display } from "next/font/google";
import { requireSession } from "@/lib/auth/current-session";
import { participantDisplayName } from "@/lib/participants/display-name";
import { EinladungPasskeyView } from "./einladung-passkey-view";

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
