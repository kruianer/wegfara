import { Figtree, Playfair_Display } from "next/font/google";
import { redirect } from "next/navigation";
import { currentSession } from "@/lib/auth/current-session";
import { safeRedirectTarget } from "@/lib/auth/redirect-target";
import { AnmeldeView } from "./anmelde-view";

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

function firstValue(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export default async function AnmeldungPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const weiter = safeRedirectTarget(firstValue(params.weiter));

  // Wer bereits angemeldet ist, hat auf der Anmeldeseite nichts zu tun.
  if (await currentSession()) redirect(weiter);

  return (
    <div className={`${playfairDisplay.variable} ${figtree.variable}`}>
      <AnmeldeView
        weiter={weiter}
        linkFehler={firstValue(params.fehler) === "link"}
      />
    </div>
  );
}
