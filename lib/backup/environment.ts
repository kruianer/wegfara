import { environmentLabel } from "@/lib/auth/environment";

/**
 * Aus welcher Umgebung ein Backup stammt (req-053). Jedes Backup traegt sie
 * bei sich: eines aus einer anderen Umgebung laesst sich einspielen, die
 * Sicherheitsabfrage warnt dann ausdruecklich davor.
 *
 * Abgeleitet wird sie wie die Kennzeichnung der E-Mails aus APP_URL (siehe
 * lib/auth/environment.ts) -- nie aus einem Kopf der Anfrage. Was dort keine
 * Kennzeichnung bekommt, ist prod.
 */
export const PRODUCTION_ENVIRONMENT = "prod";

export function currentEnvironment(): string {
  return environmentLabel() ?? PRODUCTION_ENVIRONMENT;
}
