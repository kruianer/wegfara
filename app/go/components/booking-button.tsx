import type { JSX } from "react";
import {
  BOOKING_ACTION_COLOR,
  type BookingAction,
  type BookingActionKind,
} from "@/lib/activities/booking";
import { GlobeIcon, MailIcon, PhoneIcon } from "@/components/icons";
import styles from "./booking-button.module.css";

function iconProps() {
  return {
    className: styles.icon,
    width: 13,
    height: 13,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
}

function DocumentIcon() {
  return (
    <svg {...iconProps()}>
      <path d="M7 3h7l5 5v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" />
      <path d="M14 3v5h5M9 13h6M9 17h6" />
    </svg>
  );
}

/**
 * Webseite, E-Mail und Telefon sind dieselben Wege, die die Kachel als Symbole
 * fuehrt (req-079) -- ihre Zeichen stehen deshalb bei den uebrigen Symbolen
 * der Oberflaeche und nicht hier. Auf der Schaltflaeche sind sie kleiner als
 * dort und duerfen neben der Beschriftung nicht schrumpfen.
 */
function Weg({
  Zeichen,
}: {
  Zeichen: (props: { size?: number }) => JSX.Element;
}) {
  return (
    <span className={styles.icon}>
      <Zeichen size={13} />
    </span>
  );
}

const ICON: Record<BookingActionKind, () => JSX.Element> = {
  unterlagen: DocumentIcon,
  buchen: () => <Weg Zeichen={GlobeIcon} />,
  anfragen: () => <Weg Zeichen={MailIcon} />,
  anrufen: () => <Weg Zeichen={PhoneIcon} />,
};

/** Buchungs-Schaltflaeche eines Programmpunkts (siehe req-005). */
export function BookingButton({ action }: { action: BookingAction }) {
  const Icon = ICON[action.kind];
  const style = BOOKING_ACTION_COLOR[action.kind];

  if (action.kind === "unterlagen") {
    // Bewusst ohne Funktion: eine Ablage fuer Reiseunterlagen existiert noch nicht.
    return (
      <span className={styles.pill} style={style}>
        <Icon />
        {action.label}
      </span>
    );
  }

  return (
    <a
      href={action.href}
      className={styles.pill}
      style={style}
      {...(action.kind === "buchen"
        ? { target: "_blank", rel: "noopener noreferrer" }
        : {})}
    >
      <Icon />
      {action.label}
    </a>
  );
}
