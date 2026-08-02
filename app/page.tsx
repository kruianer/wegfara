import { Figtree, Playfair_Display } from "next/font/google";
import { HomeView } from "./home-view";

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

export default function Home() {
  return (
    <div className={`${playfairDisplay.variable} ${figtree.variable}`}>
      <HomeView />
    </div>
  );
}
