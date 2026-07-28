import type { JSX } from "react";
import {
  BOOKING_ACTION_COLOR,
  type BookingAction,
  type BookingActionKind,
} from "@/lib/activities/booking";
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

function GlobeIcon() {
  return (
    <svg {...iconProps()}>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg {...iconProps()}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m4 6.5 8 6 8-6" />
    </svg>
  );
}

function PhoneIcon() {
  return (
    <svg {...iconProps()}>
      <path d="M6.5 4h3l1.5 4.5-2 1.5a11 11 0 0 0 5.5 5.5l1.5-2 4.5 1.5v3a2 2 0 0 1-2 2A15.5 15.5 0 0 1 4.5 6a2 2 0 0 1 2-2Z" />
    </svg>
  );
}

const ICON: Record<BookingActionKind, () => JSX.Element> = {
  unterlagen: DocumentIcon,
  buchen: GlobeIcon,
  anfragen: MailIcon,
  anrufen: PhoneIcon,
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
