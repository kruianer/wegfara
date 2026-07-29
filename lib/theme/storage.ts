import { DEFAULT_THEME_ID, THEMES } from "./themes";
import type { ThemeId } from "./types";

// Geraetegebundene Ablage der gewaehlten Farbwelt (localStorage) - gilt nur
// fuer diese Person an diesem Geraet, wird nicht mit der Reisegruppe
// geteilt und nicht ueber das Backend synchronisiert.
const STORAGE_KEY = "wegfara.go.theme";

function isThemeId(value: string): value is ThemeId {
  return THEMES.some((theme) => theme.id === value);
}

export function loadThemeId(): ThemeId {
  if (typeof window === "undefined") return DEFAULT_THEME_ID;
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return stored !== null && isThemeId(stored) ? stored : DEFAULT_THEME_ID;
}

export function saveThemeId(id: ThemeId): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, id);
}
