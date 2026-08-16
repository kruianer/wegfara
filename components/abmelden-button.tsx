"use client";

import { useState } from "react";
import { LOGOUT_API } from "@/lib/auth/paths";
import styles from "./abmelden-button.module.css";

function LogoutIcon() {
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
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}

/**
 * Abmelden ist von jeder Seite aus moeglich (req-016) -- deshalb liegt
 * der Knopf in components/ und nicht in einem der beiden Bereiche.
 * Danach geht es auf die Startseite, die ohne Anmeldung erreichbar ist.
 */
export function AbmeldenButton({
  navigate = (url: string) => window.location.assign(url),
}: {
  navigate?: (url: string) => void;
}) {
  const [busy, setBusy] = useState(false);

  async function logout() {
    setBusy(true);
    try {
      await fetch(LOGOUT_API, { method: "POST" });
    } catch {
      // Auch ohne Verbindung geht es auf die Startseite; dort greift beim
      // naechsten Versuch wieder die Anmeldung.
    }
    navigate("/");
  }

  return (
    <button
      type="button"
      className={styles.button}
      aria-label="Abmelden"
      title="Abmelden"
      onClick={logout}
      disabled={busy}
    >
      <LogoutIcon />
    </button>
  );
}
