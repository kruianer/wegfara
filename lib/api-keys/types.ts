/**
 * Die Zugangsschluessel eines Accounts (req-028). Genau zwei Arten -- mehr
 * sind ausdruecklich nicht Teil des Requirements.
 */
export const API_KEY_KINDS = ["ki_suche", "google"] as const;

export type ApiKeyKind = (typeof API_KEY_KINDS)[number];

/** Wie die Karte "Zugangsschluessel" die beiden benennt (req-028, GUI). */
export const API_KEY_LABEL: Record<ApiKeyKind, string> = {
  ki_suche: "KI-Suche",
  google: "Import aus Google",
};

/**
 * Was von einem hinterlegten Schluessel je wieder nach aussen geht: dass er
 * gesetzt ist, und seine letzten vier Zeichen zur Unterscheidung. Der
 * Schluessel selbst wird nach dem Speichern nie wieder ausgegeben --
 * Ersetzen ist moeglich, Auslesen nicht (req-028).
 */
export interface ApiKeyState {
  kind: ApiKeyKind;
  /** Die letzten vier Zeichen; null heisst "Nicht gesetzt". */
  lastFour: string | null;
}

export function isApiKeyKind(value: unknown): value is ApiKeyKind {
  return (
    typeof value === "string" && API_KEY_KINDS.includes(value as ApiKeyKind)
  );
}

/** Die letzten vier Zeichen eines Schluessels -- mehr wird nie gezeigt. */
export function lastFourOf(key: string): string {
  return key.slice(-4);
}

/**
 * Der Zustand beider Arten, auch der nicht hinterlegten: die Karte zeigt
 * immer beide Zeilen, eine davon eben mit "Nicht gesetzt".
 */
export function apiKeyStates(gesetzt: ApiKeyState[]): ApiKeyState[] {
  return API_KEY_KINDS.map((kind) => ({
    kind,
    lastFour: gesetzt.find((state) => state.kind === kind)?.lastFour ?? null,
  }));
}

/** Ob fuer diese Art ein Schluessel hinterlegt ist. */
export function hasApiKey(states: ApiKeyState[], kind: ApiKeyKind): boolean {
  return states.some((state) => state.kind === kind && state.lastFour !== null);
}

/** Der Zustand als Text in der Karte (req-028, GUI). */
export function apiKeyStateText(state: ApiKeyState): string {
  return state.lastFour === null
    ? "Nicht gesetzt"
    : `Gesetzt (…${state.lastFour})`;
}

/**
 * Der Hinweis an der gesperrten Funktion: er nennt den fehlenden Schluessel
 * als Grund und verweist auf den Ort, an dem er hinterlegt wird (req-028) --
 * seit req-032 der Bereich "Mein Bereich" (bis req-036 "Account").
 */
export function apiKeyMissingHint(kind: ApiKeyKind): string {
  return `Für „${API_KEY_LABEL[kind]}“ ist kein Zugangsschlüssel hinterlegt. Ein Bereichs-Admin hinterlegt ihn im Bereich „Mein Bereich“.`;
}
