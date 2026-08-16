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

function FlugIcon() {
  return (
    <svg {...iconProps()}>
      <path d="M10.5 3.2a1.5 1.5 0 0 1 3 0V9l7.5 4.4v2.2l-7.5-2.3v4.3l2.5 1.9v1.7L12 20.4l-4 .8v-1.7l2.5-1.9v-4.3L3 15.6v-2.2L10.5 9V3.2Z" />
    </svg>
  );
}

function BahnIcon() {
  return (
    <svg {...iconProps()}>
      <rect x="5" y="3" width="14" height="13" rx="3" />
      <path d="M5 10h14" />
      <circle cx="8.5" cy="13" r="1" />
      <circle cx="15.5" cy="13" r="1" />
      <path d="m8 16-2.5 5M16 16l2.5 5M7.5 21h9" />
    </svg>
  );
}

function FaehreIcon() {
  return (
    <svg {...iconProps()}>
      <path d="M3 15h18l-2.4 5.5H5.4L3 15Z" />
      <path d="M5 15v-4h14v4" />
      <rect x="8" y="5" width="8" height="6" rx="1" />
      <path d="M12 2v3" />
    </svg>
  );
}

const ICON: Record<Transfer["mode"], () => JSX.Element> = {
  fuss: FussIcon,
  auto: AutoIcon,
  bus: BusIcon,
  boot: BootIcon,
  flug: FlugIcon,
  bahn: BahnIcon,
  faehre: FaehreIcon,
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
