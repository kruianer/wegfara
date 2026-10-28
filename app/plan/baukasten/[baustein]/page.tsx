import { notFound } from "next/navigation";
import { requireSuperAdmin } from "@/lib/auth/super-admin";
import { findeBaustein } from "@/lib/design/baukasten";
import { BausteinSeite } from "../bausteine";

// Haengt an der Sitzung des Aufrufers -- nie statisch vorrendern.
export const dynamic = "force-dynamic";

/**
 * Ein einzelner Baustein (req-089) -- die Seite, die der Katalog in seinen
 * drei Rahmen zeigt. Sie steht fuer sich, damit jeder Rahmen seine eigene
 * Fensterbreite hat: nur so greift eine Media Query bei 375 px, waehrend
 * daneben 1280 px gelten. Wie der Katalog nur fuer den Gesamt-Admin.
 */
export default async function BausteinPage({
  params,
  searchParams,
}: {
  params: Promise<{ baustein: string }>;
  searchParams: Promise<{ zustand?: string }>;
}) {
  await requireSuperAdmin();
  const baustein = findeBaustein((await params).baustein);
  if (!baustein) notFound();
  const { zustand } = await searchParams;
  return <BausteinSeite id={baustein.id} zustand={zustand ?? null} />;
}
