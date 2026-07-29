export type ThemeId =
  | "light"
  | "dark"
  | "notte"
  | "riviera"
  | "aurora"
  | "magma"
  | "blau-dunkel"
  | "lila-dunkel"
  | "orange-anthrazit"
  | "anthrazit-gold";

export type ThemeVars = {
  "--bg": string;
  "--sur": string;
  "--sur2": string;
  "--ink": string;
  "--mut": string;
  "--line": string;
  "--acc": string;
  "--acc-soft": string;
  "--nav-bg": string;
  "--nav-ink": string;
  "--good": string;
  "--good-soft": string;
  "--warn": string;
  "--warn-soft": string;
  "--glass": string;
  "--shadow": string;
};

export type Theme = {
  id: ThemeId;
  name: string;
  vars: ThemeVars;
  /** Drei repräsentative Farben (Hintergrund, Fläche, Akzent) für die Vorschau in der Liste. */
  swatches: [string, string, string];
};
