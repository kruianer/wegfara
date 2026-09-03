import type { Participant } from "./types";

/** So viel einer Person, wie zum Benennen gebraucht wird. */
type NamedParticipant = Pick<Participant, "name" | "nickname">;

/**
 * Wie eine Person in der Oberflaeche benannt wird (req-020): der Nickname,
 * sofern einer hinterlegt ist, sonst der Name. Ueberall dort zu verwenden,
 * wo eine Person benannt wird -- ausser bei einer Bankverbindung oder
 * Zahlung, dort gilt participantPaymentName.
 */
export function participantDisplayName(participant: NamedParticipant): string {
  const nickname = participant.nickname?.trim() ?? "";
  return nickname.length > 0 ? nickname : participant.name;
}

/**
 * Wie eine Person dort benannt wird, wo ihre Bankverbindung oder eine
 * Zahlung steht (req-020): immer der volle Name, damit er zum Kontoinhaber
 * passt -- auch wenn ein Nickname hinterlegt ist. Gilt fuer die
 * Teilnehmerverwaltung und jede spaetere Darstellung von Zahlungen.
 */
export function participantPaymentName(participant: NamedParticipant): string {
  return participant.name;
}
