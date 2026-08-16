/**
 * Die Kompassrose der Marke. Startseite und Anmeldeseite teilen sich
 * dasselbe Zeichen (siehe GUI in req-015 und req-016).
 */
export function CompassIcon({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M12 2.5 L14.6 9.4 L21.5 12 L14.6 14.6 L12 21.5 L9.4 14.6 L2.5 12 L9.4 9.4 Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
      <path
        d="M12 5.5 L13.6 10.4 L18.5 12 L13.6 13.6 L12 18.5 L10.4 13.6 L5.5 12 L10.4 10.4 Z"
        fill="currentColor"
      />
    </svg>
  );
}
