import type { JSX } from "react";
import type { Transfer } from "@/lib/transfers/types";
import type { Activity } from "@/lib/activities/types";
import { TRANSFER_MODE_LABEL } from "@/lib/transfers/type-meta";
import { formatTransferMeta } from "@/lib/transfers/format";
import { buildRouteUrl } from "@/lib/transfers/navigation";
import styles from "./transfer-row.module.css";

function iconProps() {
  return {
    width: 16,
    height: 16,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
}

function FussIcon() {
  return (
    <svg {...iconProps()}>
      <circle cx="13" cy="5" r="1.8" />
      <path d="M12 7.5 9 10l1 4-2 6M12 7.5l3 2.5 1 5 3 4M9 14l3-1" />
    </svg>
  );
}

function AutoIcon() {
  return (
    <svg {...iconProps()}>
      <path d="M5 16v-4l1.7-4.5A2 2 0 0 1 8.6 6h6.8a2 2 0 0 1 1.9 1.5L19 12v4" />
      <rect x="3" y="16" width="18" height="3" rx="1.5" />
      <circle cx="7.5" cy="19" r="1.2" />
      <circle cx="16.5" cy="19" r="1.2" />
    </svg>
  );
}

function BusIcon() {
  return (
    <svg {...iconProps()}>
      <rect x="4" y="4" width="16" height="12" rx="2" />
      <path d="M4 10h16M8 4v12M16 4v12" />
      <circle cx="7.5" cy="18.5" r="1.2" />
      <circle cx="16.5" cy="18.5" r="1.2" />
    </svg>
  );
}

function BootIcon() {
  return (
    <svg {...iconProps()}>
      <path d="M4 14h16l-2.2 5H6.2L4 14Z" />
      <path d="M8 14V6h4l4 8" />
      <path d="M12 3v3" />
    </svg>
  );
}

const ICON: Record<Transfer["mode"], () => JSX.Element> = {
  fuss: FussIcon,
  auto: AutoIcon,
  bus: BusIcon,
  boot: BootIcon,
};

/** Zurueckhaltende Zeile fuer den Weg zwischen zwei Programmpunkten (req-006). */
export function TransferRow({
  transfer,
  toActivity,
}: {
  transfer: Transfer;
  toActivity: Activity;
}) {
  const Icon = ICON[transfer.mode];
  const routeUrl = toActivity.position
    ? buildRouteUrl(toActivity.position, transfer.mode)
    : null;

  return (
    <div className={styles.row}>
      <span
        className={styles.icon}
        role="img"
        aria-label={TRANSFER_MODE_LABEL[transfer.mode]}
      >
        <Icon />
      </span>
      <div className={styles.body}>
        <p className={styles.title}>{transfer.title}</p>
        <p className={styles.meta}>{formatTransferMeta(transfer)}</p>
      </div>
      {routeUrl && (
        <a
          href={routeUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={styles.route}
        >
          Route
        </a>
      )}
    </div>
  );
}
