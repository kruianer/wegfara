import Link from "next/link";
import { PLANNER_MIN_WIDTH_PX } from "@/lib/plan/viewport";
import styles from "./narrow-notice.module.css";

export function NarrowNotice() {
  return (
    <div className={styles.notice}>
      <p className={styles.heading}>Bildschirm zu schmal</p>
      <p className={styles.text}>
        Der Planer benötigt einen breiteren Bildschirm (mindestens{" "}
        {PLANNER_MIN_WIDTH_PX} Pixel). Nutze für unterwegs stattdessen den{" "}
        <Link href="/go">Begleiter</Link>.
      </p>
    </div>
  );
}
