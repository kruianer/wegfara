"use client";

import { useSyncExternalStore } from "react";
import { browserSupportsWebAuthn } from "@simplewebauthn/browser";

// Ob ein Geraet Passkeys beherrscht, weiss erst der Browser. Der Wert
// aendert sich waehrend einer Sitzung nicht, deshalb gibt es nichts zu
// abonnieren.
const subscribe = () => () => {};

// Serverseitig wird Unterstuetzung angenommen, damit der Passkey-Weg beim
// ersten Rendern nicht kurz als gesperrt aufblitzt.
const assumeSupported = () => true;

export function usePasskeySupport(): boolean {
  return useSyncExternalStore(
    subscribe,
    browserSupportsWebAuthn,
    assumeSupported,
  );
}
