import type { Metadata, Viewport } from "next";
import { currentSession } from "@/lib/auth/current-session";
import { restoreInProgress } from "@/lib/backup/maintenance";
import { FremderAccountBalken } from "@/components/fremder-account-balken";
import { WartungsHinweis } from "@/components/wartungs-hinweis";
import {
  ICON_APPLE_GROESSE,
  ICON_TAB_GROESSE,
  iconPfad,
} from "@/lib/icon/icon-pfade";
import { APP_BESCHREIBUNG, APP_NAME } from "@/lib/marke";
import styles from "./layout.module.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "wegfara",
  description: APP_BESCHREIBUNG,
  // Der Name unter dem Icon auf dem Homescreen von iPad und iPhone
  // (req-065). Android nimmt ihn aus dem Manifest (app/manifest.ts), Apple
  // aus diesem Hinweis -- ohne ihn stuende dort der Titel des Tabs.
  appleWebApp: {
    title: APP_NAME,
  },
  // Die Kompassrose im Browser-Tab und bei den Lesezeichen (req-065). Sie
  // kommt aus der Anwendung statt aus public/, weil ihre Farbe von der
  // Umgebung abhaengt (siehe app/icon/[groesse]/route.tsx).
  icons: {
    icon: [
      {
        url: iconPfad(ICON_TAB_GROESSE),
        type: "image/png",
        sizes: `${ICON_TAB_GROESSE}x${ICON_TAB_GROESSE}`,
      },
    ],
    // Das Icon auf dem Homescreen von iPad und iPhone. Es liegt auf einer
    // deckenden Flaeche -- Apple fuellt Durchsichtiges mit Schwarz.
    apple: [
      {
        url: iconPfad(ICON_APPLE_GROESSE),
        type: "image/png",
        sizes: `${ICON_APPLE_GROESSE}x${ICON_APPLE_GROESSE}`,
      },
    ],
  },
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
  // Waehrend einer Wiederherstellung ist die App gesperrt und zeigt allen
  // einen Hinweis (req-053) -- vor jeder Abfrage der Datenbank, die gerade
  // zurueckgeschrieben wird.
  if (restoreInProgress()) {
    return (
      <html lang="de">
        <body>
          <WartungsHinweis />
        </body>
      </html>
    );
  }

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
