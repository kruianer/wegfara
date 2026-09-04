import { Figtree, Playfair_Display } from "next/font/google";
import { redirect } from "next/navigation";
import { getPool } from "@/lib/db/pool";
import { bootstrapAvailable, bootstrapEmail } from "@/lib/auth/bootstrap";
import { LOGIN_PATH } from "@/lib/auth/paths";
import { ErsteinrichtungView } from "./ersteinrichtung-view";

// Haengt am Zustand der Umgebung — nie statisch vorrendern.
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
 * Die Ersteinrichtung gibt es nur, solange die Umgebung keinen einzigen
 * Teilnehmer kennt (req-037). Geprueft wird das hier und nicht nur auf der
 * Anmeldeseite: sonst bliebe der Weg ueber die direkte URL offen.
 */
export default async function ErsteinrichtungPage() {
  if (!(await bootstrapAvailable(getPool()))) redirect(LOGIN_PATH);

  return (
    <div className={`${playfairDisplay.variable} ${figtree.variable}`}>
      <ErsteinrichtungView email={bootstrapEmail()} />
    </div>
  );
}
