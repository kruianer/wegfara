import styles from "./theme-button.module.css";

export function ThemeButton({ onOpen }: { onOpen: () => void }) {
  return (
    <button
      type="button"
      className={styles.button}
      onClick={onOpen}
      aria-label="Farbwelt wählen"
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="9" />
        <path d="M12 3a9 9 0 0 0 0 18Z" fill="currentColor" stroke="none" />
      </svg>
    </button>
  );
}
