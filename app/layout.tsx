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
import { APP_BESCHREIBUNG, APP_GRUNDTON, APP_NAME } from "@/lib/marke";
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
    // Vom Homescreen gestartet laeuft die App in einem eigenen Fenster ohne
    // Adresszeile. Das ergibt <meta name="mobile-web-app-capable">.
    capable: true,
    // Die Statusleiste bleibt, wo sie ist, und der Inhalt beginnt darunter:
    // "black-translucent" schoebe die Seite unter die Uhr.
    statusBarStyle: "default",
  },
  other: {
    // Denselben Hinweis unter dem Namen, den Safari seit jeher liest. Next
    // schreibt von sich aus nur die neuere Schreibweise; aeltere iPads
    // oeffneten damit weiterhin ein Browser-Fenster samt Adresszeile.
    "apple-mobile-web-app-capable": "yes",
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
  // Die Farbe der Leisten um das Fenster der vom Homescreen gestarteten App
  // (req-065) -- derselbe Grundton, den auch die Seite selbst traegt.
  themeColor: APP_GRUNDTON,
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
