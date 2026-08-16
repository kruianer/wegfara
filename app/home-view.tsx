"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { PLANNER_MIN_WIDTH_PX } from "@/lib/plan/viewport";
import { CompassIcon } from "@/components/compass-icon";
import { useWindowWidth } from "./use-window-width";
import styles from "./home-view.module.css";

/** Die Startseite (siehe req-015): reiner Einstieg in die drei Bereiche,
 * ohne Reisedaten und ohne Themenwahl. */
export function HomeView() {
  const windowWidth = useWindowWidth();
  const plannerReachable = windowWidth >= PLANNER_MIN_WIDTH_PX;
  const [inviteCode, setInviteCode] = useState("");
  const [voteNoticeVisible, setVoteNoticeVisible] = useState(false);

  function confirmInviteCode(event: FormEvent) {
    event.preventDefault();
    setVoteNoticeVisible(true);
  }

  return (
    <div className={styles.page}>
      <div className={styles.center}>
        <div className={styles.brand}>
          <span className={styles.logo}>
            <CompassIcon />
          </span>
          <h1 className={styles.wordmark}>Wegfara</h1>
          <div className={styles.tagline}>KI · Reiseplanung</div>
          <p className={styles.lead}>
            Dein Reisebegleiter: von der KI geplant, unterwegs an deiner Seite.
          </p>
        </div>
        <div className={styles.ways}>
          {plannerReachable ? (
            <Link href="/plan" className={styles.card}>
              <h2 className={styles.cardTitle}>Planer</h2>
              <p className={styles.cardText}>
                Für die Planung am großen Bildschirm.
              </p>
            </Link>
          ) : (
            <div className={`${styles.card} ${styles.cardDisabled}`}>
              <h2 className={styles.cardTitle}>Planer</h2>
              <p className={styles.cardText}>
                Für die Planung am großen Bildschirm.
              </p>
              <p className={styles.cardHint}>
                Benötigt einen breiteren Bildschirm (mindestens{" "}
                {PLANNER_MIN_WIDTH_PX} Pixel).
              </p>
            </div>
          )}
          <Link href="/go" className={styles.card}>
            <h2 className={styles.cardTitle}>Begleiter</h2>
            <p className={styles.cardText}>Für unterwegs.</p>
          </Link>
          <div className={styles.card}>
            <h2 className={styles.cardTitle}>Abstimmung</h2>
            <p className={styles.cardText}>Für Reiseteilnehmer.</p>
            <form className={styles.inviteForm} onSubmit={confirmInviteCode}>
              <label className={styles.inviteLabel} htmlFor="invite-code">
                Einladungscode
              </label>
              <input
                id="invite-code"
                className={styles.inviteInput}
                type="text"
                value={inviteCode}
                onChange={(event) => setInviteCode(event.target.value)}
              />
              <button type="submit" className={styles.inviteButton}>
                Bestätigen
              </button>
            </form>
            {voteNoticeVisible && (
              <p className={styles.inviteHint}>
                Die Abstimmung ist noch nicht verfügbar.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
