import { Figtree, Playfair_Display } from "next/font/google";
import { requireSession } from "@/lib/auth/current-session";
import { safeRedirectTarget } from "@/lib/auth/redirect-target";
import { NotfallcodesView } from "./notfallcodes-view";

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

export default async function NotfallcodesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireSession();
  const params = await searchParams;
  const weiter = safeRedirectTarget(firstValue(params.weiter));

  return (
    <div className={`${playfairDisplay.variable} ${figtree.variable}`}>
      <NotfallcodesView weiter={weiter} />
    </div>
  );
}
