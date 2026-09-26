import { Caveat, Figtree, Playfair_Display } from "next/font/google";

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
 * Die Handschrift des Slogans in der Seitenleiste (req-077) -- dieselbe, die
 * LivingGardenTwin dort traegt. `next/font/google` laedt sie beim Bauen
 * herunter und liefert sie aus dem eigenen Bundle aus (siehe .next/static):
 * im Browser wird kein fremder Dienst angesprochen, wie es
 * delivery/stack.md verlangt. Ihr Rueckfall steht im Stylesheet -- "Segoe
 * Script" auf Windows, "Bradley Hand" auf Apple-Geraeten.
 */
const caveat = Caveat({
  subsets: ["latin"],
  weight: ["500", "600"],
  variable: "--font-hand",
});

export default function PlanLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      className={`${playfairDisplay.variable} ${figtree.variable} ${caveat.variable}`}
    >
      {children}
    </div>
  );
}
