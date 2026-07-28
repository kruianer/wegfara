import { Space_Grotesk, Albert_Sans } from "next/font/google";
import styles from "./theme.module.css";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["600", "700"],
  variable: "--font-heading",
});

const albertSans = Albert_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-body",
});

export default function GoLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={`${styles.theme} ${spaceGrotesk.variable} ${albertSans.variable}`}
    >
      {children}
    </div>
  );
}
