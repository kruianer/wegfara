import type { Metadata, Viewport } from "next";
import { currentSession } from "@/lib/auth/current-session";
import { FremderAccountBalken } from "@/components/fremder-account-balken";
import styles from "./layout.module.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "wegfara",
  description: "Adaptiver Reiseplaner",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Solange der Gesamt-Admin in einem fremden Account arbeitet, weist ein
  // Balken darauf hin -- auf jeder Seite, ueber dem Kopfbereich (req-025).
  // Er steht deshalb hier und nicht im Planer.
  //
  // Ohne Sitzungs-Cookie kostet das keine Abfrage: currentSession() geht
  // dann gar nicht erst zur Datenbank.
  const session = await currentSession();
  const fremderAccount = session?.actingAccount ?? null;

  return (
    <html lang="de">
      <body className={fremderAccount ? styles.mitBalken : undefined}>
        {fremderAccount && (
          <FremderAccountBalken accountName={fremderAccount.name} />
        )}
        {children}
      </body>
    </html>
  );
}
