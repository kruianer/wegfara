import { spaceGrotesk, albertSans } from "@/lib/schriften";
import styles from "./theme.module.css";

export default function GoLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={`${styles.theme} ${spaceGrotesk.variable} ${albertSans.variable}`}
    >
      {children}
    </div>
  );
}
