import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const eslintConfig = [
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    // delivery/ enthaelt Requirements, Bugs und die HTML/JS-Vorlagen der
    // Design-Uebergabe — keine Anwendungsquellen; sie sollen die
    // Lint-Stufe des Quality-Gates nicht blockieren.
    ignores: [".next/**", "node_modules/**", "delivery/**"],
  },
];

export default eslintConfig;
