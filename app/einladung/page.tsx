import { Figtree, Playfair_Display } from "next/font/google";
import { redirect } from "next/navigation";
import { getPool } from "@/lib/db/pool";
import { invitationIsOpen } from "@/lib/auth/login";
import { LOGIN_PATH } from "@/lib/auth/paths";
import { protokolliereFehlschlag } from "@/lib/auth/protokoll";
import { EinladungAnnehmenView } from "./einladung-annehmen-view";

// Haengt am Token in der Adresszeile — nie statisch vorrendern.
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

function firstValue(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

/**
 * Die Adresse hinter dem QR-Code und dem Link einer Einladung (req-023).
 *
 * Seit bug-068 entwertet ihr Aufruf nichts mehr: die Link-Vorschau einer
 * QR-App oder eines Messengers ruft sie vorab ab, und genau das hatte die
 * Einladung verbraucht. Die Seite prueft nur, ob die Einladung noch gilt,
 * und schickt sie dann aus dem Browser heraus per POST ab -- erst das
 * loest sie ein.
 */
export default async function EinladungPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const token = firstValue((await searchParams).token);

  if (!(await invitationIsOpen(getPool(), token, new Date()))) {
    protokolliereFehlschlag(
      "einladung-einloesen",
      token ? "zugangslink-abgelaufen-oder-verbraucht" : "kein-token",
    );
    redirect(`${LOGIN_PATH}?fehler=einladung`);
  }

  return (
    <div className={`${playfairDisplay.variable} ${figtree.variable}`}>
      <EinladungAnnehmenView token={token} />
    </div>
  );
}
