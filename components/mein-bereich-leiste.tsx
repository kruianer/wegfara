import Link from "next/link";
import { MEIN_BEREICH_PATH } from "@/lib/auth/paths";
import { AbmeldenButton } from "./abmelden-button";
import styles from "./abmelden-button.module.css";

function PersonIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

/**
 * Zugang zu "Mein Bereich" und zum Abmelden -- in beiden Bereichen
 * derselbe (req-016, seit req-043 unter diesem Namen). Der Passkey wird
 * dort eingerichtet, und das geschieht meist auf dem Smartphone, also im
 * Begleiter.
 */
export function MeinBereichLeiste() {
  return (
    <>
      <Link
        className={styles.button}
        href={MEIN_BEREICH_PATH}
        aria-label="Mein Bereich"
        title="Mein Bereich"
      >
        <PersonIcon />
      </Link>
      <AbmeldenButton />
    </>
  );
}
