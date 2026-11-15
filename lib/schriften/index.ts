import localFont from "next/font/local";

/**
 * Die fuenf Schriftfamilien der App (bug-075). Die Dateien liegen hier im
 * Repo, statt dass `next/font/google` sie bei jedem Build von
 * fonts.googleapis.com holt: Dort hing jeder Lauf am Netz, und drei Deploys
 * in zwei Tagen sind an einer kurzen Stoerung gescheitert -- bei
 * unveraendertem Code.
 *
 * Ausgeliefert werden sie weiter aus dem eigenen Bundle (siehe
 * .next/static): im Browser wird kein fremder Dienst angesprochen, wie es
 * delivery/stack.md verlangt.
 *
 * Jede Datei ist die variable Schrift von Google Fonts, Teilmenge "latin" --
 * dieselbe, die der Build zuvor geholt hat. Eine Datei traegt alle Staerken
 * ihres Bereichs; `weight` nennt den Bereich, den die App davon nutzt.
 * Lizenz: SIL Open Font License, je Familie in der *-OFL.txt daneben.
 *
 * `next/font` verlangt die Aufrufe hier oben im Modul und mit festen Werten;
 * die Seiten binden nur noch `.variable` ein.
 */

/** Ueberschriften auf dem Planer und den Seiten rund um die Anmeldung. */
export const playfairDisplay = localFont({
  src: [
    { path: "./PlayfairDisplay.woff2", weight: "500 700", style: "normal" },
    {
      path: "./PlayfairDisplay-Italic.woff2",
      weight: "500 700",
      style: "italic",
    },
  ],
  variable: "--font-heading",
  adjustFontFallback: "Times New Roman",
});

/** Fliesstext auf dem Planer und den Seiten rund um die Anmeldung. */
export const figtree = localFont({
  src: "./Figtree.woff2",
  weight: "400 700",
  variable: "--font-body",
});

/**
 * Die Handschrift des Slogans in der Seitenleiste (req-077) -- dieselbe, die
 * LivingGardenTwin dort traegt. Ihr Rueckfall steht im Stylesheet -- "Segoe
 * Script" auf Windows, "Bradley Hand" auf Apple-Geraeten.
 */
export const caveat = localFont({
  src: "./Caveat.woff2",
  weight: "500 600",
  variable: "--font-hand",
});

/** Ueberschriften im Begleiter (/go). */
export const spaceGrotesk = localFont({
  src: "./SpaceGrotesk.woff2",
  weight: "600 700",
  variable: "--font-heading",
});

/** Fliesstext im Begleiter (/go). */
export const albertSans = localFont({
  src: "./AlbertSans.woff2",
  weight: "400 700",
  variable: "--font-body",
});
