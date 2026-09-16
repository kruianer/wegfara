import type { MetadataRoute } from "next";
import { APP_BESCHREIBUNG, APP_NAME } from "@/lib/marke";
import {
  ICON_APPLE_GROESSE,
  ICON_TAB_GROESSE,
  iconPfad,
} from "@/lib/icon/icon-pfade";

/**
 * Das Web-App-Manifest unter /manifest.webmanifest (req-065). Der Browser
 * liest daraus, was beim Ablegen auf dem Homescreen zu sehen ist: das Icon
 * und den Namen darunter.
 *
 * Es traegt denselben Namen wie der Passkey-Dialog und dieselbe Kompassrose
 * wie der Browser-Tab -- beide kommen aus einer Quelle, damit auf dem
 * Homescreen nichts anderes steht als in der App.
 *
 * Die middleware laesst die Adresse offen (sie endet auf ".webmanifest" und
 * ist damit von ihrem matcher ausgenommen): der Browser holt das Manifest,
 * lange bevor sich jemand angemeldet hat.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    // "name" steht im Installationsdialog, "short_name" unter dem Icon.
    // Beide sagen dasselbe -- der Name ist kurz genug.
    name: APP_NAME,
    short_name: APP_NAME,
    description: APP_BESCHREIBUNG,
    lang: "de",
    start_url: "/",
    icons: [
      {
        src: iconPfad(ICON_TAB_GROESSE),
        sizes: `${ICON_TAB_GROESSE}x${ICON_TAB_GROESSE}`,
        type: "image/png",
      },
      {
        src: iconPfad(ICON_APPLE_GROESSE),
        sizes: `${ICON_APPLE_GROESSE}x${ICON_APPLE_GROESSE}`,
        type: "image/png",
      },
    ],
  };
}
