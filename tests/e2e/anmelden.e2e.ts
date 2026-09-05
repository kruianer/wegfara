import { expect, test } from "./fixtures";

/**
 * Fluss 4 (req-047): mit Passkey anmelden und eine geschuetzte Seite
 * erreichen.
 *
 * Der Passkey wird zuvor auf demselben Weg eingerichtet wie nach einer
 * Einladung (req-023) -- er gehoert zum Geraet, also zu genau diesem
 * Browser. Dafuer bekommt Chromium einen virtuellen Authenticator: er
 * beantwortet die WebAuthn-Aufforderungen so, wie es sonst Face ID, Touch ID
 * oder Windows Hello taeten.
 */

test("Anmelden: mit Passkey auf eine geschützte Seite", async ({
  seite,
  context,
  baseURL,
}) => {
  const cdp = await context.newCDPSession(seite);
  await cdp.send("WebAuthn.enable");
  const { authenticatorId } = await cdp.send(
    "WebAuthn.addVirtualAuthenticator",
    {
      options: {
        protocol: "ctap2",
        transport: "internal",
        // Der Passkey muss auf dem Geraet auffindbar sein und die
        // Nutzerpruefung nachweisen -- beides verlangt die Anwendung
        // ausdruecklich (req-037).
        hasResidentKey: true,
        hasUserVerification: true,
        isUserVerified: true,
        automaticPresenceSimulation: true,
      },
    },
  );

  /** Ob das Geraet eine Entsperrung von sich aus beantwortet. */
  const entsperrungBeantworten = (enabled: boolean) =>
    cdp.send("WebAuthn.setAutomaticPresenceSimulation", {
      authenticatorId,
      enabled,
    });

  // Einrichten: derselbe Bildschirm wie direkt nach einer Einladung.
  await seite.goto("/einladung/passkey");
  await seite.getByRole("button", { name: "Passkey einrichten" }).click();
  await expect(seite).toHaveURL(`${baseURL}/`);

  // Abmelden, damit die Anmeldung wirklich ueber den Passkey laeuft.
  await seite.goto("/plan");
  await seite.getByRole("button", { name: "Abmelden" }).click();
  await expect(seite).toHaveURL(`${baseURL}/`);

  // Solange nichts beantwortet wird, bleibt die Anmeldeseite stehen: sonst
  // meldete die Anmeldung, die dort von selbst laeuft (Conditional UI,
  // req-037), schon vor dem Griff zum Knopf an -- und welcher der beiden
  // Wege trug, waere nicht mehr zu erkennen.
  await entsperrungBeantworten(false);

  // Ohne Sitzung fuehrt die geschuetzte Seite auf die Anmeldung.
  await seite.goto("/plan");
  await expect(seite).toHaveURL(/\/anmeldung/);

  await seite.getByRole("button", { name: "Mit Passkey anmelden" }).click();
  await entsperrungBeantworten(true);

  await expect(seite).toHaveURL(`${baseURL}/plan`);
  await expect(
    seite.getByRole("navigation", { name: "Planer-Bereiche" }),
  ).toBeVisible();
});
